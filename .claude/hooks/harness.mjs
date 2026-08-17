// Shared helpers for guard.mjs and signoff.mjs.
//
// Node only, no dependencies, no shell: student machines are Windows, macOS and
// Linux, and `jq` is not present on all of them. Every function here either
// returns a value or throws — the callers decide what a failure means, because
// the right answer differs (the guard denies, the unlock script explains).

import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

export const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();

export function loadConfig() {
  return JSON.parse(readFileSync(join(root, ".harness", "config.json"), "utf8"));
}

/** Repo-relative, forward-slashed. Windows gives back backslashes otherwise. */
export function relPath(p) {
  return relative(root, resolve(root, p)).split(sep).join("/");
}

/**
 * Is this path locked to the agent, and on what grounds?
 *
 * Two lists, one mechanism, because the *grounds* differ and the grounds are
 * what the agent reads back to the student:
 *
 *   neverWritable — machinery. The gate, its config, the ledger. Editing these
 *                   changes what the harness *does*.
 *   canonical     — the contract. README.md, and the CLAUDE.md that imports it.
 *                   Editing these changes what the harness is *for*. The README
 *                   is the requirements: it is the thing the agent is held to,
 *                   so it is not a thing the agent gets to rewrite.
 *
 * Both are path checks, deliberately: unlike the gated categories, this needs no
 * look at the content, so it is the one part of the floor that cannot be argued
 * with. Shared with bash-guard so the shell route and the file-tool route cannot
 * drift apart about what is locked.
 *
 * `writableExceptions` cuts holes in the above, and exists for exactly one case:
 * an assignment whose *topic* is the locked thing. A module on writing skills
 * needs `.claude/skills/<theirs>/` open or there is no assignment. Empty here,
 * and it should stay empty on any assignment where the skill is the tutor rather
 * than the subject — an exception is a hole, and it is the config's job to make
 * that a decision someone makes on purpose.
 *
 * Returns "machinery" | "canonical" | null.
 */
export function lockedAs(config, rel) {
  const hit = (list) =>
    (list ?? []).some((p) => (p.endsWith("/") ? rel.startsWith(p) : rel === p));
  if (hit(config.writableExceptions)) return null;
  if (hit(config.neverWritable)) return "machinery";
  if (hit(config.canonical)) return "canonical";
  return null;
}

/**
 * Every locked path, both lists, for the shell-side check.
 *
 * The exceptions are NOT subtracted here: the shell check is a coarse "does this
 * command write into locked territory", and a command can name several paths at
 * once. Over-blocking a `cp` into an exempt skill directory is a nuisance the
 * student can work around with Write; under-blocking is a hole. The file-tool
 * guard, which sees exactly one path, is where the exception is honoured.
 */
export function lockedPaths(config) {
  return [...(config.neverWritable ?? []), ...(config.canonical ?? [])];
}

// --- PLAN.md ---------------------------------------------------------------
//
// The group's plan is the only state behind the onboarding gate. There is no
// verdict file and nothing derived: the guard reads PLAN.md live on every write,
// so a group that fixes a line has fixed the gate, with nothing to re-run.
//
// THE RULE, whole:
//
//   An email must CLAIM A TASK at least once. Every occurrence after its first is
//   a claim; a first occurrence is a claim too if it sits in a table row with two
//   or more other filled cells.
//
// The reader matches email addresses and nothing else — no headings, no dash, no
// keywords, no word matching. Everything that had to be true follows from that
// rather than being handled:
//
//   - The task line has no format. Any line, any shape. Strictness lives in WHERE
//     the address appears, not in what surrounds it.
//   - German costs nothing, because no prose is read. Students write in both
//     languages and the reader cannot tell which.
//   - There is no member block to locate, which is what dissolved the German
//     problem and the everything-in-one-table problem together.
//   - The restatement half is unparsed, whatever it contains — code fences, FR
//     tables, headings that look like anchors. Only an email address reaches this.
//
// Two costs, taken knowingly (see wayfinder/tickets/plan-md-shape.md):
//
//   An address mentioned in the restatement prose becomes a phantom member and
//   closes the gate. The block message names it with its line number and the fix
//   is rewording one sentence — cheaper than reintroducing a section boundary.
//
//   The table clause is the only fail-open path here: a member table with a third
//   column reads as a task claim, so a member with no task passes. See isTableClaim.

const EMAIL_RE = "[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,}";
const EMAIL = new RegExp(EMAIL_RE, "gi");
// Separate, non-global: `.test()` on a /g/ regex carries lastIndex between calls.
const HAS_EMAIL = new RegExp(EMAIL_RE, "i");

/**
 * A table row that carries an email AND at least two other filled cells is a task
 * claim on its own, first occurrence or not.
 *
 * This exists for the shape a group writes when nobody told them otherwise: one
 * who-does-what table, `| Priya | priya.n@mail.com | FR009 fetch, FR012 favourites |`,
 * where everyone appears exactly once and the plain count rule would block a group
 * that planned fine. A member table stays a member table — `| Lena | lena.b@mail.de |`
 * has one other cell, not two.
 *
 * ponytail: cell counting, not meaning. A member table with a third column —
 * `| Lena | lena.b@mail.de | Frontend |` — reads as a claim and opens the gate for
 * someone with no task. If a real group hits it, the upgrade is a length floor on
 * the non-email cells, which separates "Frontend" from a task description but not
 * from a very terse one.
 */
// Any filled cell counts, however short. A length floor here would make the
// rule depend on how long someone's name is — "Lea" is three characters and
// "Priya" is five, and nothing about a task hangs on that.
const isFilledCell = (c) => c && !/^[-: ]+$/.test(c) && !HAS_EMAIL.test(c);

function isTableClaim(line) {
  if ((line.match(/\|/g) ?? []).length < 2) return false;
  return line.split("|").map((c) => c.trim()).filter(isFilledCell).length >= 2;
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * The member's name: their defining line with the address, the markdown and the
 * separators taken out. Same strip taskLines() already does to derive a title,
 * for the same reason — whatever they wrote is what it is, nothing is invented.
 */
function nameFrom(line) {
  // A markdown table row starts with a pipe. Requiring that keeps prose carrying
  // a stray `||` out of this branch, where it would lose its list marker.
  if (/^\s*\|/.test(line) && (line.match(/\|/g) ?? []).length >= 2) {
    const cells = line.split("|");
    const at = cells.findIndex((c) => HAS_EMAIL.test(c));
    // Cells after the address are the task, not the name. A row that leads with
    // the address has no name cell — "" is the honest answer, and better than
    // handing Task 4 a requirement id to print where a person's name goes.
    return cells.slice(0, at).map((c) => c.trim()).filter(isFilledCell).pop() ?? "";
  }
  return line
    .replace(EMAIL, "")
    .replace(/^[\s|>*+-]+|[\s|]+$/g, "")
    .replace(/\s*[—–-]\s*$/, "")
    .trim();
}

/**
 * Does this line name that member — full name, or first name, word-boundary,
 * case-insensitive?
 *
 * ponytail: first names collide with ordinary prose, and this is the reader's
 * second fail-open path. "Renke's idea was…" becomes a phantom CLAIM and OPENS
 * the gate, where plan-md-shape's phantom MEMBER closed it. Taken knowingly:
 * people write first names, which is the whole point. Upgrade path if a real
 * group hits it is full-name-only, which costs the thing the ticket asked for.
 */
function namesMember(line, name) {
  if (!name) return false;
  const parts = [name, name.split(/\s+/)[0]].filter((p) => p.length >= 2);
  return parts.some((p) => new RegExp(`\\b${escapeRe(p)}\\b`, "i").test(line));
}

/** Every address in PLAN.md, with its owner's name and where it appeared. */
export function readPlan(text) {
  const lines = text.split(/\r?\n/);
  const people = new Map();

  // Pass 1 — an address defines a member. Unchanged from plan-md-shape: every
  // occurrence after the first is a claim, plus the table exception.
  lines.forEach((line, i) => {
    for (const [match] of line.matchAll(EMAIL)) {
      const email = match.toLowerCase();
      const rec = people.get(email) ?? { email, name: nameFrom(line), count: 0, claims: 0, at: [] };
      rec.count += 1;
      if (rec.count > 1 || isTableClaim(line)) rec.claims += 1;
      rec.at.push({ line: i + 1, text: line.trim() });
      people.set(email, rec);
    }
  });

  // Pass 2 — a later line naming a member claims for them. Their own defining
  // line is skipped, or every member list would clear itself; a line already
  // counted through their address is skipped, or one line would count twice.
  lines.forEach((line, i) => {
    for (const rec of people.values()) {
      if (rec.at[0].line === i + 1) continue;
      if (line.toLowerCase().includes(rec.email)) continue;
      if (namesMember(line, rec.name)) rec.claims += 1;
    }
  });

  return [...people.values()];
}

/** `{ ok, people, unassigned }` — unassigned is the set difference the gate needs. */
export function checkPlan(text) {
  const people = readPlan(text);
  const unassigned = people.filter((p) => p.claims === 0);
  return { ok: people.length > 0 && unassigned.length === 0, people, unassigned };
}

/** Every line that claims a task, for `onboard.mjs --issues`. */
export function taskLines(text) {
  const seen = new Map();
  const lines = [];
  text.split(/\r?\n/).forEach((line, i) => {
    const emails = [...line.matchAll(EMAIL)].map((m) => m[0].toLowerCase());
    if (!emails.length) return;
    const claim = emails.some((e) => seen.has(e)) || isTableClaim(line);
    for (const e of emails) seen.set(e, true);
    if (!claim) return;
    // The title is the line with the addresses and the markdown taken out. Whatever
    // the group wrote IS the title — this never invents one, per group-referee-stance.
    const title = line
      .replace(EMAIL, "")
      .replace(/^[\s|>*+-]+|[\s|]+$/g, "")
      .replace(/\s*[—–-]\s*$/, "")
      .replace(/\s*\|\s*/g, " · ")
      .trim();
    if (title) lines.push({ title, emails, line: i + 1 });
  });
  return lines;
}

const PLAN_FIX =
  "Give them a task line — their name or their address, either reads — or take " +
  "them out of the member list if they are not on this project. Nothing to re-run: " +
  "`PLAN.md` is read again on the next write.";

const PLAN_TAIL =
  "Until then I'm not writing code for anyone in this group: the plan is the " +
  "group's, so this is too.";

/**
 * The message the gate produces when it is shut. This is the single most important
 * string in the onboarding gate: the gate is live, so this is what stands between
 * "editing PLAN.md is cheap" and "editing PLAN.md is dangerous".
 *
 * Three properties, in every branch. It NAMES the person and QUOTES the line, so
 * nobody hunts. It gives BOTH exits — add a task, or drop them — because "add a
 * task" alone reads as an order to invent busywork for someone who left the course.
 * And it says the gate is LIVE, so the group learns from the message itself that
 * fixing the line is the whole fix.
 *
 * Four branches because "no file", "no addresses", "one person missing" and
 * "nobody claimed anything" are four different diagnoses a group acts on
 * differently. Returns null when the write may proceed.
 */
export function planBlock(text /* null when PLAN.md is absent */, plan = "PLAN.md") {
  if (text === null) {
    return (
      `There is no \`${plan}\` in this repo, so I can't write code yet. That file is ` +
      `the group's plan: your git emails, and a task line for each of you. Write it ` +
      `together — I will ask the questions and tell you what looks thin, but the ` +
      `words are yours. Run \`/onboard\` and I'll start.`
    );
  }

  const { ok, people, unassigned } = checkPlan(text);
  if (ok) return null;

  if (people.length === 0) {
    return (
      `\`${plan}\` exists but contains no email addresses, so I can't tell who is on ` +
      `this project or who is doing what. Each member's **git** email — the one ` +
      `\`git config user.email\` prints — goes in the member list. On the tasks, your ` +
      `name is enough. That address is how your progress gets filed, so it has to be ` +
      `the git one, not a nicer one.`
    );
  }

  // Everyone missing is a different diagnosis from someone missing: it almost always
  // means the tasks aren't written down yet, or are in a shape carrying no names.
  // Telling a group "nobody has a task" would be both wrong and insulting.
  if (unassigned.length === people.length) {
    return (
      `I can see ${people.length} addresses in \`${plan}\` but each of them only once, ` +
      `so I can't tell a member list from a task list — it looks like the tasks ` +
      `aren't written down yet. Each of you needs to turn up twice: once where you ` +
      `list who is in the group, and again on the task you took — ` +
      `by name or by address, whichever you prefer. ` +
      `Nothing to re-run afterwards; the file is read again on the next write.`
    );
  }

  if (unassigned.length === 1) {
    const [p] = unassigned;
    return (
      `\`${plan}\` lists ${p.email} as a member (${people.length} listed), and no task ` +
      `line carries their name or that address — the only mention is line ${p.at[0].line}: ` +
      `"${p.at[0].text}". ${PLAN_FIX} ${PLAN_TAIL}`
    );
  }

  const listed = unassigned.map((p) => `- ${p.email} (line ${p.at[0].line})`).join("\n");
  return (
    `\`${plan}\` lists ${people.length} members, and ${unassigned.length} of them appear ` +
    `nowhere but the member list — no task line carries their name or their address:\n${listed}\n${PLAN_FIX} ${PLAN_TAIL}`
  );
}

export function planFile(config) {
  return config.planFile ?? "PLAN.md";
}

/**
 * The gate, as guard.mjs calls it. Null means proceed.
 *
 * Reads the file every time rather than caching a verdict: a stale verdict is the
 * exact failure that killed `onboarding.json` — a group edits PLAN.md, the gate
 * keeps reading Tuesday's answer, and nothing shows that it has. A readFile per
 * write is the whole cost of never having that problem.
 *
 * Throws on an unreadable PLAN.md, which reaches guard.mjs's catch and denies.
 */
export function onboardingBlock(config) {
  if (config.onboarding === false) return null;
  const plan = planFile(config);
  const p = join(root, plan);
  return planBlock(existsSync(p) ? readFileSync(p, "utf8") : null, plan);
}

export function git(args) {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

/**
 * Which progress file belongs to the person at this keyboard.
 *
 * Keyed on git identity, per repo-split-expression. That is spoofable — but
 * spoofing it also changes commit authorship, which is public, so the bargain is
 * the usual one. The email local part is used rather than the display name
 * because it is ASCII, unique per person, and safe as a filename.
 */
export function studentKey() {
  let raw = "";
  try {
    raw = git(["config", "user.email"]).split("@")[0];
  } catch {
    /* fall through */
  }
  if (!raw) {
    try {
      raw = git(["config", "user.name"]);
    } catch {
      /* fall through */
    }
  }
  const slug = raw
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "unknown";
}

export function progressPath(config, key = studentKey()) {
  return join(root, config.progressDir, `${key}.json`);
}

/**
 * The student's unlock rows. A missing file is not an error — it is a student on
 * day one. A file that exists but does not parse IS an error, and it propagates:
 * the guard must not read a corrupt ledger as "nothing unlocked yet" and it must
 * not read it as "everything unlocked" either.
 */
export function readProgress(config, key = studentKey()) {
  const p = progressPath(config, key);
  if (!existsSync(p)) return [];
  const parsed = JSON.parse(readFileSync(p, "utf8"));
  if (!Array.isArray(parsed?.unlocks)) {
    throw new Error("progress file has no unlocks array");
  }
  return parsed.unlocks;
}

export function writeProgress(config, unlocks, key = studentKey()) {
  const p = progressPath(config, key);
  mkdirSync(join(root, config.progressDir), { recursive: true });
  writeFileSync(p, `${JSON.stringify({ student: key, unlocks }, null, 2)}\n`);
  return p;
}

export function taskById(config, id) {
  return config.tasks.find((t) => t.id.toLowerCase() === String(id).toLowerCase());
}

/**
 * The categories this student has demonstrated, and may therefore get agent help
 * with — anywhere, including on features beyond the core.
 *
 * This is the whole of the guard's dynamic state. It is DERIVED from the recorded
 * tasks rather than stored, so the record stays a list of git facts and the
 * task -> category mapping stays in config where it can be changed per assignment.
 *
 * If unlockRoute is false there is no unlock to derive anything from, so the
 * gated set stays gated — until the student declares the exercise finished with
 * `signoff.mjs --done`, which opens all of it at once. Nothing is earned task by
 * task on a daily, so nothing opens task by task either.
 */
export function demonstrated(config, unlocks) {
  if (config.unlockRoute === false) {
    return unlocks.some((u) => u.route === "done") ? new Set(config.gated ?? []) : new Set();
  }
  const open = new Set();
  for (const row of unlocks) {
    const task = taskById(config, row.task);
    for (const c of task?.categories ?? []) open.add(c);
  }
  return open;
}

/**
 * Has this *group* hand-written the core?
 *
 * Read across every committed progress file, not just this student's, because it
 * backs a ceiling on the project rather than on a person. `README.md` states what
 * this project is built out of — plain script tags, no build step, no npm — and
 * the tutor holds that ceiling until the core is covered. One member finishing
 * their two tasks must not lift it while a teammate has written nothing: a build
 * step added mid-project breaks every other clone in the group.
 *
 * Only `written` rows count toward coverage. A reviewed unlock is a real route to
 * *access*, but three people reviewing one member's FR009 must never add up to
 * "this group wrote FR009".
 *
 * Nothing enforces the result and nothing is meant to. The agent reads it through
 * `signoff.mjs --status`, and the rule it feeds is prose in the tutor skill — the
 * machinery that would enforce it (which paths count as a build step) is different
 * for every assignment, and a per-assignment block list is exactly what the
 * starter-repo generator exists to avoid.
 */
export function coverage(config) {
  const dir = join(root, config.progressDir);
  const written = new Set();
  const unreadable = [];
  let done = false;

  if (existsSync(dir)) {
    for (const f of readdirSync(dir)) {
      if (!f.endsWith(".json")) continue;
      try {
        const parsed = JSON.parse(readFileSync(join(dir, f), "utf8"));
        for (const row of parsed?.unlocks ?? []) {
          if (row?.route === "written") written.add(String(row.task).toLowerCase());
          if (row?.route === "done") done = true;
        }
      } catch {
        // A file that does not parse contributes nothing, which can only make
        // coverage look *less* complete — so skipping is the fail-closed side.
        // Named rather than dropped silently: this repo is designed to produce
        // merge conflicts, and a conflicted ledger should be visible as one.
        unreadable.push(f);
      }
    }
  }

  // A daily has nothing to cover task by task. It is finished when the student
  // says it is, and `--done` is where they say it.
  if (config.unlockRoute === false) return { complete: done, missing: [], unreadable };

  const missing = config.tasks.filter((t) => !written.has(t.id.toLowerCase())).map((t) => t.id);
  return { complete: missing.length === 0, missing, unreadable };
}

/**
 * Where the student's work is sitting, and whether that is somewhere it can be
 * reviewed. One implementation, three callers — the pre-commit hook, the write
 * guard and the sign-off — because a condition worth warning about at commit time
 * is the same condition at write time, and two copies drift.
 *
 * Never throws. A repo git cannot answer about reports no problems rather than a
 * fault: a student on a train with no remote must not be blocked, and a check that
 * cannot run has found nothing.
 */
export function branchState(config) {
  const mode = config.branchDiscipline ?? "off";
  const out = { mode, branch: "", problems: [] };
  if (mode === "off") return out;

  const integration = config.integrationBranch ?? "main";
  const say = (code, text) => out.problems.push({ code, text });

  try {
    out.branch = git(["rev-parse", "--abbrev-ref", "HEAD"]);
  } catch {
    return out;
  }

  if (out.branch === integration) {
    say("on-main", `You are on \`${integration}\`. Work for one task belongs on its own ` +
      `branch, so it can be reviewed before it lands: \`git switch -c my-branch-name\` ` +
      `— anything staged comes along.`);
    return out; // The other three are about feature branches. On main they are noise.
  }

  let base = "";
  try {
    base = git(["merge-base", integration, "HEAD"]);
  } catch {
    return out; // No integration branch here yet. Nothing to compare against.
  }

  // `--is-ancestor` answers through its exit code and prints nothing: 0 = yes,
  // 1 = no. git() throws on non-zero, so the answer is whether it threw. Written
  // out rather than compared against "" — an empty string means both "yes" and
  // "the command printed nothing", and only one of those is true here.
  //
  // Ancestry alone is not enough: `--is-ancestor HEAD integration` also succeeds
  // for a branch that was JUST cut and carries no commits of its own — its tip
  // trivially is an ancestor of the branch it came from. That is "fresh", not
  // "merged", and there is nothing to say about it. What distinguishes the two is
  // the tip: a branch whose tip equals the integration branch's own tip has
  // nothing of its own sitting there yet; a branch that is an ancestor but sits
  // BEHIND that tip is one whose commits have genuinely already landed.
  let merged = false;
  try {
    git(["merge-base", "--is-ancestor", "HEAD", integration]);
    try {
      merged = git(["rev-parse", "HEAD"]) !== git(["rev-parse", integration]);
    } catch {
      merged = false; // can't read one of the tips — nothing to compare
    }
  } catch {
    merged = false;
  }
  if (merged) {
    say("merged", `\`${out.branch}\` is already merged into \`${integration}\`. New work ` +
      `on it will not show up in a new Pull Request — cut a fresh branch first.`);
    // Whenever `merged` can fire, HEAD is an ancestor of integration, and
    // merge-base(integration, HEAD) is then defined to equal HEAD — so `base`
    // below and `rev-parse HEAD` above are the same value, and stale-base's
    // check collapses to this same comparison. A branch whose work has already
    // landed is finished, not stale; telling a student to rebase it contradicts
    // telling them to cut a fresh branch, for what is really one fact.
    return out;
  }

  try {
    if (base !== git(["rev-parse", integration])) {
      say("stale-base", `\`${out.branch}\` was cut from an older \`${integration}\` than ` +
        `the one that is there now. Merging it will be noisier than it needs to be: ` +
        `\`git fetch && git rebase ${integration}\`, or merge ${integration} into it.`);
    }
  } catch {
    /* no such branch locally — nothing to compare against */
  }

  try {
    const used = readProgress(config).some((u) => u.branch && u.branch === out.branch);
    if (used) {
      say("reused", `\`${out.branch}\` already carries a signed-off task. Starting the next ` +
        `one here mixes two tasks into one Pull Request — cut a fresh branch.`);
    }
  } catch {
    /* an unreadable ledger is readProgress's problem to raise, not this one's */
  }

  return out;
}
