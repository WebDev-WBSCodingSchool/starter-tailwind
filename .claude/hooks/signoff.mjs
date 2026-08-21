#!/usr/bin/env node
//
// signoff.mjs — the only thing that writes the progress record.
//
//   node .claude/hooks/signoff.mjs FR011
//   node .claude/hooks/signoff.mjs FR011 --review --pr <url> --author <name>
//   node .claude/hooks/signoff.mjs --done      (only where there is no unlock route)
//   node .claude/hooks/signoff.mjs --status
//
// The agent invokes this after an explain-back it judged a pass. It cannot write
// the record directly — guard.mjs denies writes to .claude/harness/ — so this script is
// the whole of the write path, and every rule that has to be *enforced* rather
// than merely described lives here rather than in the skill.
//
// Two of those rules:
//
//   Committed, and the branch is the evidence. The work must be committed before
//   this is recorded, so git history shows a hand-written commit followed by
//   agent-assisted ones, in that order, attributed and public. That ordering is
//   the evidence the harness produces; the record itself is only the guard's
//   state. What is checked and stored is the branch and every commit on it that
//   touched the task's file — a first go and its fixes, not just the last of
//   them — which is more use to a reader than a single SHA and needs nothing
//   further from the student to hold up.
//
//   Reviewed never exceeds written. Reviewing a teammate's code is a real second
//   route to unlocking a task, but uncapped it would let one member write all six
//   tasks while three others unlocked everything by reviewing — the exact failure
//   this project exists to catch. The cap makes each student's first unlock
//   necessarily a written one, and holds 1:1 after that.
//
// A student can run this from their own terminal without ever explaining
// anything. That bypass is known, deliberate, and left in: engineering it away
// would mean pretending the harness can certify authorship, which it cannot.

import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  root,
  git,
  loadConfig,
  taskById,
  readProgress,
  writeProgress,
  studentKey,
  progressPath,
  demonstrated,
  coverage,
  branchState,
} from "./harness.mjs";

function fail(message) {
  console.error(`\n${message}\n`);
  process.exit(1);
}

function arg(flag) {
  const i = process.argv.indexOf(flag);
  return i === -1 ? null : process.argv[i + 1] ?? null;
}

const config = loadConfig();
const key = studentKey();

// --- --status --------------------------------------------------------------

if (process.argv.includes("--status")) {
  const unlocks = readProgress(config);
  const open = demonstrated(config, unlocks);
  console.log(`\nStudent: ${key}`);
  console.log(
    config.unlockRoute === false
      ? `On this assignment nothing gets handed over — the code below stays yours throughout.`
      : `On this assignment, signing off a task lets the agent write that kind of code with you.`,
  );
  console.log(`\nTasks:`);
  for (const t of config.tasks) {
    const row = unlocks.find((u) => u.task === t.id);
    const mark = row ? `signed off (${row.route}, ${row.commits.at(-1).slice(0, 7)})` : "not yet";
    console.log(`  ${t.title.padEnd(24)} ${t.id}  ${mark}`);
  }
  console.log(`\nThe agent can write these with you: ${[...open].join(", ") || "none of them yet"}`);
  console.log(`Still yours to type: ${(config.gated ?? []).filter((c) => !open.has(c)).join(", ") || "nothing"}`);

  // The group line, and the only place the agent can read it. README.md states
  // what this project is built out of; until the core is covered, the tutor holds
  // that ceiling rather than adding machinery a teammate would have to install.
  const core = coverage(config);
  const coreLabel = config.onboarding === false ? "Core hand-written by you" : "Core hand-written by the group";
  console.log(
    `\n${coreLabel}: ${
      core.complete
        ? "yes — the setup ceiling in README.md is a remark from here on, not a hold"
        : config.unlockRoute === false
          ? "not yet (run --done when you have finished and committed)"
          : `not yet — still to be written by someone: ${core.missing
              .map((id) => `${taskById(config, id)?.title ?? id} (${id})`)
              .join(", ")}`
    }`,
  );
  if (core.unreadable.length) {
    console.log(`Unreadable progress files (conflict markers?): ${core.unreadable.join(", ")}`);
  }
  console.log();
  process.exit(0);
}

// --- --done ----------------------------------------------------------------
//
// The completion state for an assignment with no unlock route. Nothing is being
// earned here and nothing is judged: the student says the exercise is finished,
// the same commit-first rule applies, and the gated set opens. The explain-back
// is still offered as their own self-check and is still theirs to decline — it is
// deliberately NOT a precondition of this, because the moment it gates something
// it stops being a self-check.
//
// No trailer check here: --done covers the whole tree rather than one task's file,
// so there is no single commit to check. Revisit when the daily prototype exists
// and there is something real to check it against.

if (process.argv.includes("--done")) {
  if (config.unlockRoute !== false) {
    fail(
      `Not on this assignment. Tasks are signed off one at a time here — write it, ` +
        `commit it with --signoff, and talk it through:\n\n` +
        `  node .claude/hooks/signoff.mjs ${config.tasks[0]?.id ?? "<TASK>"}\n\n` +
        `--done exists for short exercises where nothing is earned task by task.`,
    );
  }

  const unlocks = readProgress(config);
  if (unlocks.some((u) => u.route === "done")) {
    fail(`Already marked done. Nothing to do.`);
  }

  let head;
  try {
    head = git(["rev-parse", "HEAD"]);
  } catch {
    fail(`This repo has no commits yet. Commit your work, then run this again.`);
  }

  // Tracked changes only: a scratch file the student never added should not stand
  // between them and the end of the exercise.
  let dirty = "";
  try {
    dirty = git(["status", "--porcelain", "--untracked-files=no"]);
  } catch (err) {
    fail(`Couldn't ask git for the status of this repo: ${err.message}`);
  }
  if (dirty) {
    fail(
      `You have uncommitted changes. Commit them first, then run this again.\n\n` +
        `  git add -A\n  git commit -m "done"\n\n` +
        `Same reason as everywhere else here: your version goes into the history ` +
        `before any assisted version does.`,
    );
  }

  unlocks.push({ at: new Date().toISOString(), route: "done", commit: head });
  writeProgress(config, unlocks);

  console.log(`\nMarked done. Recorded in ${progressPath(config).replace(root, ".")}`);
  const gated = config.gated ?? [];
  console.log(
    gated.length
      ? `The agent can now write ${gated.join(", ")} with you. Build what you like on top of what you wrote.`
      : `Nothing was gated on this assignment, so nothing was ever withheld. Build what you like on top of what you wrote.`,
  );
  console.log(`Commit that file along with your work.\n`);
  process.exit(0);
}

// --- Preconditions ---------------------------------------------------------

if (config.unlockRoute === false) {
  fail(
    `Nothing gets handed over on this assignment. Writing a task and explaining it ` +
      `changes nothing here — that code stays yours for the whole exercise.\n\n` +
      `When you have finished and committed it:\n\n` +
      `  node .claude/hooks/signoff.mjs --done`,
  );
}

const id = process.argv[2];
if (!id || id.startsWith("--")) {
  fail(
    `Which task? e.g.  node .claude/hooks/signoff.mjs ${config.tasks[0]?.id ?? "<TASK>"}\n` +
      `Tasks: ${config.tasks.map((t) => t.id).join(", ")}\n` +
      `Run with --status to see where you are.`,
  );
}

const task = taskById(config, id);
if (!task) {
  fail(`"${id}" is not a task on this assignment. Tasks: ${config.tasks.map((t) => t.id).join(", ")}`);
}

const unlocks = readProgress(config);
if (unlocks.some((u) => u.task === task.id)) {
  fail(`${task.id} is already signed off. Nothing to do.`);
}

const reviewed = process.argv.includes("--review");

// --- The proportional cap --------------------------------------------------

if (reviewed) {
  const written = unlocks.filter((u) => u.route === "written").length;
  const reviews = unlocks.filter((u) => u.route === "reviewed").length;
  if (reviews + 1 > written) {
    fail(
      `Not yet — reviewed tasks can't outnumber written ones, and you have ` +
        `${written} written / ${reviews} reviewed. Write one of your own tasks first.\n\n` +
        `This is the balance rule, not a judgement of the review. It exists so that a ` +
        `group can't have one person write everything while everyone else reviews.`,
    );
  }
  const pr = arg("--pr");
  const author = arg("--author");
  if (!pr || !author) {
    fail(
      `A reviewed sign-off needs the PR and whose code it was:\n` +
        `  node .claude/hooks/signoff.mjs ${task.id} --review --pr <url> --author <github-username>\n\n` +
        `The review has to be posted on GitHub, by you. That is what makes it readable ` +
        `from the repo without anyone needing special access.`,
    );
  }
}

// --- Committed, and signed off ---------------------------------------------

let head;
try {
  head = git(["rev-parse", "HEAD"]);
} catch {
  fail(`This repo has no commits yet. Commit your work, then run this again.`);
}

// For a reviewed sign-off the branch is the reviewer's, not the author's, and `pr`
// and `author` carry the real provenance — GitHub holds both.
let branch = "";
let commits = [head];

if (!reviewed) {
  const file = task.file;
  if (!existsSync(join(root, file))) {
    fail(`${file} doesn't exist yet — ${task.id} is meant to live there.`);
  }
  let dirty = "";
  try {
    dirty = git(["status", "--porcelain", "--", file]);
  } catch (err) {
    fail(`Couldn't ask git about ${file}: ${err.message}`);
  }
  if (dirty) {
    fail(
      `${file} has uncommitted changes. Commit it first, then run this again.\n\n` +
        `  git add ${file}\n  git commit -m "${task.id}: ${task.title}"\n\n` +
        `This isn't bureaucracy. The commit has to happen before the agent is allowed ` +
        `to help refine the code, so that the history shows your version first and the ` +
        `assisted version after it. That ordering is the only record of who wrote what, ` +
        `and it's the reason nothing you said explaining it needs to be stored anywhere.`,
    );
  }
  // Only the task's own file is checked. A student with unrelated scratch edits
  // elsewhere in the tree should not be blocked by them.

  // Every commit on this branch that touched the task's file. In sum they are the
  // evidence for a solved task — a first go and three fixes is what learning looks
  // like, and storing only the last of them threw four fifths of it away.
  branch = "";
  try {
    branch = git(["rev-parse", "--abbrev-ref", "HEAD"]);
  } catch {
    /* a repo git cannot answer about — the list still works. Detached HEAD does
       not land here: git answers "HEAD", and that is what gets stored. */
  }

  const integration = config.integrationBranch ?? "main";
  let range = "HEAD";
  try {
    range = `${git(["merge-base", integration, "HEAD"])}..HEAD`;
  } catch {
    // No such branch, or no common ancestor. Fall through to the whole history:
    // over-collecting here is harmless, and refusing would block a student whose
    // repo is simply shaped differently.
  }

  try {
    commits = git(["rev-list", range, "--", file]).split("\n").filter(Boolean);
  } catch (err) {
    fail(`Couldn't ask git about ${file}: ${err.message}`);
  }

  if (!commits.length) {
    // Branch already merged, or the base was squashed — the range is empty but the
    // work exists. Falling back beats refusing: the student did nothing wrong.
    const sha = git(["log", "-1", "--format=%H", "--", file]);
    if (!sha) {
      fail(`No commit has touched ${file} yet. Commit your work, then run this again.`);
    }
    commits = [sha];
  }
}

// --- Record ----------------------------------------------------------------

const row = {
  task: task.id,
  at: new Date().toISOString(),
  route: reviewed ? "reviewed" : "written",
  branch,
  commits,
};
if (reviewed) {
  row.pr = arg("--pr");
  row.author = arg("--author");
}

const before = demonstrated(config, unlocks);
unlocks.push(row);
const after = demonstrated(config, unlocks);
const opened = [...after].filter((c) => !before.has(c));

// Read before this sign-off's own row lands, not after: branchState()'s
// "reused" check reads the progress file back off disk, and the row this
// call is about to write always carries the current branch — computed after
// the write, a solo student doing exactly the right thing (one branch, one
// task, sign off) would see their own brand-new sign-off reported back as
// "already carries a signed-off task" on every single run. "reused" means a
// LATER task landed on a branch an EARLIER sign-off already used; it says
// nothing about the sign-off this call is itself performing. The record
// still gets written unconditionally below regardless of what happens here —
// this is only about not double-counting the write against itself. branchState()
// is built never to throw, but this script does not take that on faith either:
// same reasoning as guard.mjs's allow(), a nicety must not be able to make a
// real result look broken, so any fault here is silently swallowed.
let bs = { problems: [] };
try {
  bs = branchState(config);
} catch {
  /* see comment above */
}

writeProgress(config, unlocks);

console.log(`\n${task.title} (${task.id}) signed off, ${row.route}. Recorded in ${progressPath(config).replace(root, ".")}`);
console.log(
  opened.length
    ? `The agent can now write ${opened.join(", ")} code with you — including in features beyond the core.`
    : `Nothing new — the agent could already write ${task.categories.join(", ")} with you.`,
);
console.log(`Commit that file along with your work.\n`);
for (const p of bs.problems) console.log(`  ${p.text}\n`);
console.log(`Next: open a Pull Request for this branch, then cut a new one for your next task.\n`);
