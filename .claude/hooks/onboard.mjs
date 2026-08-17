#!/usr/bin/env node
//
// onboard.mjs — what the group runs once, together, before any code.
//
//   node .claude/hooks/onboard.mjs            what the gate sees right now
//   node .claude/hooks/onboard.mjs --check    ...plus the two preflight checks
//   node .claude/hooks/onboard.mjs --issues   derive GitHub issues from PLAN.md
//
// This script REPORTS. It is not the gate — guard.mjs is, and it reads PLAN.md
// live on every write, so nothing here has to be run for the gate to open. That
// is the point: there is no verdict file to refresh and no state to get stale.
// A group that fixes a line has fixed the gate whether or not they run this.
//
// It writes nothing into the repo. Both exceptions are about the group's own copy
// on GitHub, and both only when asked: `--issues` creates the issues (and turns on
// the Issues tab, which forks ship with off), and `--check` points `gh` at the repo
// you are standing in — one line of local git config, never committed, on a setting
// whose shipped default sends your first Pull Request to the wrong repository.

import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { root, git, loadConfig, planFile, checkPlan, planBlock, taskLines } from "./harness.mjs";

const config = loadConfig();
const plan = planFile(config);
const planAt = join(root, plan);
const text = existsSync(planAt) ? readFileSync(planAt, "utf8") : null;

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);

// --- Which repo is the base? -----------------------------------------------
//
// Three separate ways work lands in the wrong repository. Only the first is
// preventable from here; the other two are caught rather than stopped.
//
// ONE: `gh` resolves exactly one repo as "the base" for `pr create`, `issue
// create` and `issue list`, and on a fork that is not the fork:
//
//   gh repo clone <fork>   adds an `upstream` remote pointing at the parent and
//                          writes remote.upstream.gh-resolved=base
//
// So in a gh-cloned fork every `gh` command targets the repo the group forked
// FROM, before anyone types anything. Verified 2026-08-07 against gh 2.97 and a
// real fork. A plain `git clone` leaves no gh-resolved and `gh` then resolves to
// origin, so only the gh-cloned path is preset wrongly — but the fix is the same
// either way and costs nothing where it is already right, so it runs
// unconditionally rather than detecting which clone happened.
//
// TWO: after a push to a fork, GitHub's own "Compare & pull request" button
// opens a compare view with the base set to the PARENT. That is a website
// default. No git config reaches it, `gh repo set-default` does not change it,
// and nothing here can prevent it — so this warns before, and looks for the
// result after (an open PR on the parent whose head is this fork).
//
// THREE, and this is the one run 2 reported: **a push that succeeds into the
// wrong repo, silently.** `git push` follows `branch.<name>.remote`, which is
// origin, so the only question is whether origin is where the group works. A
// student who cloned the assignment repo finds out at once — 403, nothing
// happens, and the message says so. Someone who can WRITE to it does not: the
// branch lands in a repo nobody else is looking at, git prints success, and the
// group hunts for a branch that is not where they expect it.
//
// `viewerPermission` cannot see that one, because the person pushing has every
// permission there is. The signal is the repo's shape instead: **no parent, but
// forks.** You are standing in the repo everybody else forked. Checked below,
// and it is the branch with no `git` symptom at all — nothing errors, nothing
// warns, and the only evidence is a branch that is not where it should be.
//
// `set-default` only accepts a repo that is already a git remote, so this cannot
// point anywhere the student did not clone from. It writes
// remote.origin.gh-resolved into .git/config — per clone, uncommitted, and about
// their machine rather than about the project. That is why it is automated
// rather than reported: there is no decision here to take away from them.
//
// Throws if `gh` is missing, unauthenticated, offline, or there is no `origin`.

function gh(args) {
  return execFileSync("gh", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function useOriginAsBase() {
  gh(["repo", "set-default", "origin"]);
  // Read AFTER set-default, so this reports origin rather than whatever the
  // clone had been pointed at.
  return JSON.parse(
    gh(["repo", "view", "--json", "nameWithOwner,parent,forkCount,viewerPermission,hasIssuesEnabled"]),
  );
}

const ghWhy = (err) => String(err.stderr ?? err.message ?? err).trim().split("\n")[0];

// --- The report ------------------------------------------------------------

console.log(`\n${plan}: ${text === null ? "not written yet" : "found"}`);

if (config.onboarding === false) {
  // The daily case. The gate is off, so this is advice, not a verdict — say so
  // rather than printing a pass that means nothing.
  console.log(`The PLAN.md check is off on this assignment. Nothing below stops anything.`);
}

if (text !== null) {
  const { people, unassigned } = checkPlan(text);
  console.log(`\nWho ${plan} names:`);
  for (const p of people) {
    console.log(
      `  ${p.email.padEnd(28)} ${p.claims === 0 ? `no task (only line ${p.at[0].line})` : `${p.claims} task line${p.claims > 1 ? "s" : ""}`}`,
    );
  }
  if (!people.length) console.log(`  nobody — no email addresses in the file`);
}

const block = config.onboarding === false ? null : planBlock(text, plan);
console.log(`\nPLAN.md check: ${block ? "not passing" : "passing"}`);
if (block && text === null) {
  // The no-file message is written for the agent to read out mid-conversation, and
  // it ends by telling them to run /onboard. Printing that to someone who has just
  // run it reads as a loop. They are already here; say what to do next instead.
  console.log(
    `\nWrite ${plan} together before any code: what you are building, in your own\n` +
      `words, then your git emails and the tasks, each carrying one. Ask the agent to\n` +
      `run the conversation — it will ask the questions and write none of it.\n`,
  );
} else if (block) {
  console.log(`\n${block}\n`);
}

// --- --check ---------------------------------------------------------------
//
// Three checks, and only three, because only these three are true of EVERY
// assignment: you are at the repo root, your git email is in the plan, and the
// repo your Pull Requests go to is your group's. What a particular task repo
// needs on top — a config.js here, something else entirely elsewhere — is a
// conversation with an instructor and belongs to the starter-repo generator,
// not to a hardcoded list in here.
//
// The third was two for a while. It joined them because the fork model makes it
// universal: every assignment is distributed as a fork, so every assignment
// ships with `gh` pointed at the repo the student must not write to.

let failed = false;

if (has("--check")) {
  console.log(`Preflight:`);

  // 1. Are we at the repo root? Starting Claude Code in a subfolder silently drops
  //    the project settings, which drops the hooks — the harness is simply absent
  //    and nothing says so. This is the one failure that is invisible from inside.
  let top = null;
  try {
    top = git(["rev-parse", "--show-toplevel"]);
  } catch {
    /* not a git repo, or no git */
  }
  const cwd = process.cwd();
  if (top === null) {
    console.log(`  ✗ this is not a git repository (or git isn't installed)`);
    failed = true;
  } else if (join(top) !== join(cwd)) {
    console.log(`  ✗ you are in ${cwd}`);
    console.log(`    The repo root is ${top}. Open THAT folder and start again from`);
    console.log(`    there — from a subfolder the harness config is silently ignored,`);
    console.log(`    which mostly means the agent starts writing code you should write.`);
    failed = true;
  } else {
    console.log(`  ✓ at the repo root`);
  }

  // 2. Is this student's git email in the plan? Unlocks are filed under it, so an
  //    address that is in PLAN.md but not in git config splits one person's work
  //    across two records and neither opens anything.
  let email = null;
  try {
    email = git(["config", "user.email"]).toLowerCase();
  } catch {
    /* unset */
  }
  if (!email) {
    console.log(`  ✗ git has no user.email set — your unlocks have nowhere to go`);
    console.log(`    git config user.email "you@example.com"`);
    failed = true;
  } else if (config.onboarding === false) {
    // Nothing to check about a plan that this assignment does not have.
    console.log(`  – ${email} — the PLAN.md check is off on this assignment`);
  } else if (text === null) {
    console.log(`  ✗ ${email} — can't check, ${plan} doesn't exist yet`);
    failed = true;
  } else if (!checkPlan(text).people.some((p) => p.email === email)) {
    console.log(`  ✗ ${email} is your git email and it does not appear in ${plan}`);
    console.log(`    Either add it, or set git to the address the group used for you.`);
    console.log(`    Use the same one on every machine you work from.`);
    failed = true;
  } else {
    console.log(`  ✓ ${email} is in ${plan}`);
  }

  // 3. Where would a Pull Request go? See the note above `useOriginAsBase`.
  try {
    const repo = useOriginAsBase();
    const mine = ["ADMIN", "MAINTAIN", "WRITE"].includes(repo.viewerPermission);

    if (!mine) {
      // They cloned the repo they were meant to fork. No setting fixes this: the
      // work is in a repo they cannot push to, and the longer they go the more
      // there is to move.
      console.log(`  ✗ this is ${repo.nameWithOwner}, and you only have read access to it`);
      console.log(`    That is the repo to fork, not a copy of it. Fork it, add your group as`);
      console.log(`    collaborators, and clone the fork — your commits here have nowhere to`);
      console.log(`    push, and a Pull Request from here goes to somebody else's repository.`);
      failed = true;
    } else if (!repo.parent && repo.forkCount > 0) {
      // Case THREE. You can write here, so nothing will ever stop you — and the
      // people who forked this are working somewhere else. Naming the forks is
      // the whole message: one of them is almost certainly the group's, and
      // seeing it listed is faster than any explanation of the fork model.
      console.log(`  ✗ ${repo.nameWithOwner} is the repo everybody else forked`);
      let forks = [];
      try {
        forks = JSON.parse(gh(["api", `repos/${repo.nameWithOwner}/forks`, "--jq", "[.[].full_name]"]));
      } catch {
        /* named below as a count instead */
      }
      if (forks.length) for (const f of forks) console.log(`    fork: ${f}`);
      else console.log(`    ${repo.forkCount} fork${repo.forkCount > 1 ? "s" : ""} exist`);
      console.log(`    You can push here, so nothing will stop you — and that is the problem.`);
      console.log(`    A branch pushed here lands where nobody is looking, git says it worked,`);
      console.log(`    and the group goes hunting for it. Work in the fork instead. If a branch`);
      console.log(`    is already here: git push <the fork's URL> <branch>, then delete it here.`);
      failed = true;
    } else {
      console.log(`  ✓ ${repo.nameWithOwner} — issues and Pull Requests go there`);
      if (repo.parent) {
        // The website's dropdown is not something this script can set. Say it
        // once, name both repos, and let them recognise it when they see it.
        const parent = `${repo.parent.owner.login}/${repo.parent.name}`;
        console.log(`    You forked it from ${parent}, and GitHub's own`);
        console.log(`    "Compare & pull request" button still offers ${parent} as the base.`);
        console.log(`    Check that dropdown says ${repo.nameWithOwner} before you open a`);
        console.log(`    Pull Request on the website. It is the easiest mistake on this project.`);

        // ...and the same thing after the fact, because a warning is all the
        // above can be. This is the half that catches what actually happened: a
        // Pull Request sitting on the parent is invisible from the fork, which is
        // the only page the group ever looks at. Run 2's lasted three minutes
        // because a human happened to notice.
        //
        // Its own try: a parent that has gone private, or a rate limit, must not
        // erase the ✓ above — the base was still fixed either way.
        try {
          const owner = repo.nameWithOwner.split("/")[0];
          const stray = JSON.parse(
            gh(["pr", "list", "-R", parent, "--state", "open", "--json", "url,headRefName,headRepositoryOwner"]),
          ).filter((p) => p.headRepositoryOwner?.login === owner);
          for (const p of stray) {
            console.log(`  ✗ ${p.headRefName} has an open Pull Request against ${parent}`);
            console.log(`    ${p.url}`);
            console.log(`    That is the repo you forked, not yours. Close it, then open the`);
            console.log(`    same one on ${repo.nameWithOwner} — your branch is already pushed,`);
            console.log(`    so nothing is lost and no commit has to be redone.`);
            failed = true;
          }
        } catch {
          // Silent. A group with no stray PR is the normal case, and this line
          // would fire for everyone whose parent stopped being readable.
        }
      }
    }
  } catch (err) {
    // No gh, not logged in, offline, no origin yet. Nothing else depends on this,
    // so it is not a failure — but the warning is worth saying anyway, because
    // the website defaults the same way with or without `gh` installed.
    console.log(`  – couldn't check where your Pull Requests would go (${ghWhy(err)})`);
    console.log(`    If you forked this repo: when you open a PR on GitHub, the base repo`);
    console.log(`    dropdown defaults to the one you forked from. Set it to your own fork.`);
  }

  // 4. Wire the pre-commit hook. Local, per clone, never committed — same shape as
  //    the gh base fix above. A committed hook nothing points at does nothing;
  //    git will not use .githooks unless it is told to, and it cannot be told to
  //    by a committed file.
  try {
    git(["config", "core.hooksPath", ".githooks"]);
    console.log(`  ✓ git will run this repo's pre-commit check`);
  } catch (err) {
    console.log(`  – couldn't wire the pre-commit check (${err.message})`);
  }
  console.log();

  // Nothing here about writing the plan: check 2 fails whenever it is missing, so
  // reaching this line already means it exists and names this student. Telling
  // them to go and write it would be advice that can only arrive too late.
  if (!failed) {
    console.log(`Next: pick a task and cut a branch for it:`);
    console.log(`      git switch -c <task-id>-<short-name>\n`);
  }
}

// --- --issues --------------------------------------------------------------
//
// Optional throughout. No gh, no auth, no network, no Issues tab: no problem and
// no error — the split lives in PLAN.md either way and nothing is lost. Silence
// on absence rather than a complaint about a tool nobody promised to install.

if (has("--issues")) {
  if (text === null) {
    console.log(`Nothing to derive issues from — write ${plan} first.\n`);
    process.exit(failed ? 1 : 0);
  }

  try {
    gh(["auth", "status"]);
  } catch {
    console.log(
      `\`gh\` isn't available or isn't logged in, so I can't create the issues from ` +
        `here.\nThat costs you nothing: the split is in ${plan} and that is the copy ` +
        `that counts.\nMake them by hand on GitHub if you want them.\n`,
    );
    process.exit(failed ? 1 : 0);
  }

  const tasks = taskLines(text);
  if (!tasks.length) {
    console.log(`No task lines found in ${plan}, so there is nothing to create.\n`);
    process.exit(failed ? 1 : 0);
  }

  // This does NOT rely on --check having been run first. `gh issue create`
  // resolves the same base as `gh pr create`, so in a gh-cloned fork it would
  // file the group's whole split in the repo they forked from. Run 2 shows this
  // is survivable rather than certain — its issues landed on the fork correctly,
  // which is what a plain `git clone` produces — but the poisoned case is real
  // and six issues in somebody else's tracker is six things to undo by hand.
  //
  // The Issues tab may also be off. Whether a fork ships that way is NOT settled:
  // six forks checked on 2026-08-07 all had it off, and run 2's fork had it on.
  // Either way the cost of asking is one call and the fix is one more, so this
  // does not depend on knowing which — it reads the flag rather than assuming it.
  let repo = null;
  try {
    repo = useOriginAsBase();
    if (!repo.hasIssuesEnabled) {
      gh(["repo", "edit", "--enable-issues"]);
      console.log(`Turned the Issues tab on for ${repo.nameWithOwner} — it was switched off.`);
    }
  } catch (err) {
    // Not an admin on the fork, offline, no origin. Carry on: the calls below
    // fail with their own messages if this was the reason, and stopping here
    // would also stop the case where the base was already right.
    console.log(`Couldn't confirm which repo to use, so this may land somewhere unexpected:`);
    console.log(`${ghWhy(err)}`);
  }

  // Idempotent, matched on title: running this twice must not post six duplicates.
  // A group WILL run it twice — that is what a second person cloning looks like.
  let existing = [];
  try {
    existing = JSON.parse(gh(["issue", "list", "--state", "all", "--limit", "200", "--json", "number,title"]));
  } catch (err) {
    console.log(`Couldn't list the existing issues, so I stopped rather than risk duplicates.`);
    console.log(`${String(err.stderr ?? err.message).trim()}\n`);
    process.exit(failed ? 1 : 0);
  }
  const byTitle = new Map(existing.map((i) => [i.title.trim().toLowerCase(), i.number]));

  // Email -> GitHub login, best effort. GitHub only knows the address if the person
  // made it public, so a miss is normal and not worth a warning: the issue still
  // gets created and still names the owner in its body.
  const logins = new Map();
  const loginFor = (email) => {
    if (logins.has(email)) return logins.get(email);
    let login = null;
    try {
      login = gh(["api", `search/users?q=${encodeURIComponent(email)}+in:email`, "--jq", ".items[0].login"]).trim();
    } catch {
      /* no match, rate limited, offline — all the same answer */
    }
    logins.set(email, login || null);
    return login || null;
  };

  // Name the repo. It is the one line that would have caught run 2 on the spot.
  console.log(`Issues in ${repo?.nameWithOwner ?? "this repo"} (${tasks.length} task lines in ${plan}):`);
  for (const t of tasks) {
    const owners = t.emails.map((e) => ({ email: e, login: loginFor(e) }));
    const assignees = owners.map((o) => o.login).filter(Boolean);
    const body =
      `From \`${plan}\` line ${t.line}, written by the group at kickoff.\n\n` +
      `Owner: ${owners.map((o) => (o.login ? `@${o.login} (${o.email})` : o.email)).join(", ")}\n\n` +
      `${plan} is the kickoff snapshot; this issue is the live version. Edit it here.`;

    const found = byTitle.get(t.title.toLowerCase());
    try {
      if (found) {
        if (assignees.length) gh(["issue", "edit", String(found), "--add-assignee", assignees.join(",")]);
        console.log(`  = #${found} ${t.title}`);
      } else {
        const args = ["issue", "create", "--title", t.title, "--body", body];
        for (const a of assignees) args.push("--assignee", a);
        const url = gh(args).trim().split("\n").pop();
        console.log(`  + ${url} ${t.title}`);
      }
    } catch (err) {
      // One failure must not take the rest down: a bad assignee (someone not a
      // collaborator yet) is the common case and the issue itself is still wanted.
      console.log(`  ! ${t.title} — ${String(err.stderr ?? err.message).trim().split("\n")[0]}`);
    }
  }
  console.log();
}

process.exit(failed ? 1 : 0);
