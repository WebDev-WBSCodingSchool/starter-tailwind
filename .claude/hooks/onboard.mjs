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
// the Issues tab, if it happens to be off), and `--check` points `gh` at the repo
// you are standing in — one line of local git config, never committed, in case the
// clone left it pointed somewhere else.

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
// Each group creates its own repo from the WBS CODING SCHOOL GitHub template
// (the "Use this template" button), so unlike a fork there is no parent repo
// `gh` could resolve instead of origin. The one real failure mode left is a
// student who cloned the WBS CODING SCHOOL template directly instead of
// creating and cloning their own copy: they have read-only access there, so a
// push fails at once and a Pull Request would target the wrong repository.
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
    gh(["repo", "view", "--json", "nameWithOwner,viewerPermission,hasIssuesEnabled"]),
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
// The third was two for a while. It joined them because every assignment is
// distributed as a GitHub template, so every assignment ships with a risk that
// `gh` is pointed at the WBS CODING SCHOOL template instead of the group's own.
//
// Two things print here that are NOT checks and never fail: who can push to the
// repo, and which branch they are on. Both are things the group has to know and
// neither is something a script gets to have an opinion about — who is in the
// group is theirs, and standing on the integration branch at kickoff is correct.

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
      // They cloned the repo they were meant to create their own copy from. No
      // setting fixes this: the work is in a repo they cannot push to, and the
      // longer they go the more there is to move.
      console.log(`  ✗ this is ${repo.nameWithOwner}, and you only have read access to it`);
      console.log(`    That is the WBS CODING SCHOOL template, not your group's copy. Create`);
      console.log(`    your own repo from it ("Use this template" on GitHub), add your group`);
      console.log(`    as collaborators, and clone that — your commits here have nowhere to`);
      console.log(`    push, and a Pull Request from here goes to somebody else's repository.`);
      failed = true;
    } else {
      console.log(`  ✓ ${repo.nameWithOwner} — issues and Pull Requests go there`);

      // Who else can push here? The whole group works in ONE repo, so a member
      // who was never added as a collaborator is not blocked by anything
      // visible — they find out at their first push, which is days in and never
      // at a convenient moment. Reported, never a failure: who belongs in the
      // group is the group's business and this script cannot know it. Listing
      // collaborators needs push access itself, so a student on a repo that is
      // not theirs simply gets nothing here, which is the right amount.
      try {
        const who = JSON.parse(gh(["api", `repos/${repo.nameWithOwner}/collaborators`, "--jq", "[.[].login]"]));
        console.log(`    ${who.length === 1 ? "1 person can" : `${who.length} people can`} push here: ${who.join(", ")}`);
        console.log(`    Everyone in the group belongs on that list, working in this one repo.`);
      } catch {
        /* no push access to ask with, offline, rate limited — all the same silence */
      }
    }
  } catch (err) {
    // No gh, not logged in, offline, no origin yet. Nothing else depends on this,
    // so it is not a failure — but the warning is worth saying anyway.
    console.log(`  – couldn't check where your Pull Requests would go (${ghWhy(err)})`);
    console.log(`    Make sure you cloned your group's own repo, not the WBS CODING SCHOOL`);
    console.log(`    template.`);
  }

  // 4. Wire the pre-commit hook. Local, per clone, never committed — same shape as
  //    the gh base fix above. A committed hook nothing points at does nothing;
  //    git will not use .claude/githooks unless it is told to, and it cannot be told to
  //    by a committed file.
  try {
    git(["config", "core.hooksPath", ".claude/githooks"]);
    console.log(`  ✓ git will run this repo's pre-commit check`);
  } catch (err) {
    console.log(`  – couldn't wire the pre-commit check (${err.message})`);
  }
  console.log();

  // Nothing here about writing the plan: check 2 fails whenever it is missing, so
  // reaching this line already means it exists and names this student. Telling
  // them to go and write it would be advice that can only arrive too late.
  //
  // The branch is the last thing setup owes them: every change reaches the
  // integration branch through a Pull Request, so work started on the integration
  // branch itself has nowhere to go. Which of the two lines below prints is the
  // whole difference between "you are set up" and "you are working".
  if (!failed) {
    let branch = null;
    try {
      branch = git(["rev-parse", "--abbrev-ref", "HEAD"]);
    } catch {
      /* no commits yet, or detached — treated as "no branch of their own" below */
    }
    if (branch && branch !== (config.integrationBranch ?? "main")) {
      console.log(`Next: you are on ${branch}, so you have somewhere to work. Write the task,`);
      console.log(`      commit it with --signoff, then ask the agent to go through it with you.\n`);
    } else {
      console.log(`Next: pick a task and cut a branch for it:`);
      console.log(`      git switch -c <task-id>-<short-name>\n`);
    }
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
  // resolves the same base as `gh pr create`, so a stale gh default would file
  // the group's whole split in the wrong repo. Six issues in somebody else's
  // tracker is six things to undo by hand.
  //
  // The Issues tab may also be off. The WBS CODING SCHOOL template ships it
  // off, and a repo created from a template does not necessarily inherit that
  // setting — so this does not assume either way, it reads the flag and fixes
  // it if needed.
  let repo = null;
  try {
    repo = useOriginAsBase();
    if (!repo.hasIssuesEnabled) {
      gh(["repo", "edit", "--enable-issues"]);
      console.log(`Turned the Issues tab on for ${repo.nameWithOwner} — it was switched off.`);
    }
  } catch (err) {
    // Not an admin here, offline, no origin. Carry on: the calls below fail with
    // their own messages if this was the reason, and stopping here would also
    // stop the case where the base was already right.
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
