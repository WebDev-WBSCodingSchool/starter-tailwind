#!/usr/bin/env node
//
// PreToolUse hook on Bash: close the documented hole in the file-tool guard.
//
// hooks-research found that permission rules and file-tool hooks do not touch
// arbitrary subprocesses, so `node -e "fs.writeFileSync('main.js', ...)"` sails
// straight past guard.mjs. This does not re-implement the content floor — it
// cannot, since the content is inside a shell string it would have to interpret.
// It removes the *routes*: eval flags, and shell writes into the files the floor
// protects.
//
// Same exit-code contract as guard.mjs: non-zero fails OPEN, so never throw.
//
// This is a speed bump and is meant to read as one. A student who wants to run
// `node -e` in their own terminal always can; what this stops is the agent
// quietly doing it on the student's behalf when a write was already refused.

import { loadConfig, lockedPaths } from "./harness.mjs";

// Eval flags: no legitimate use in this project, and the canonical bypass.
const EVAL = /\b(node|deno|bun|python3?|perl|ruby)\b[^|;&]*?\s(-e|--eval|-p|--print|-c)\b/;

// `signoff.mjs` is how a signed-off task gets recorded and `onboard.mjs` is how
// the group's plan gets checked. Both must survive.
//
// The syntax check the tutor runs must survive too, but it is language-specific,
// so it comes from `config.syntaxCheck` rather than being named here — this file
// should not need editing to move to an assignment in another language.
const ALWAYS_OK = [/\bnode\s+[^|;&]*(signoff|onboard)\.mjs\b/];

function writesInto(command, exts) {
  const e = exts.map((x) => x.replace(".", "\\.")).join("|");
  return [
    // redirection:  > main.js   >> journal.js
    new RegExp(String.raw`>>?\s*['"]?[\w./\\-]+(${e})\b`, "i"),
    // tee, in-place sed/perl, and copy/move of a scratch file over a guarded one
    new RegExp(String.raw`\btee\b[^|;&]*(${e})\b`, "i"),
    new RegExp(String.raw`\b(sed|perl)\b[^|;&]*\s-i\b`, "i"),
    new RegExp(String.raw`\b(cp|mv|install|rsync)\b[^|;&]*(${e})\b`, "i"),
  ].some((re) => re.test(command));
}

const WRITE_VERBS = String.raw`tee|cp|mv|install|rsync|truncate|touch`;

/**
 * A shell write into a locked path — the harness's own files, and the brief.
 *
 * This is separate from writesInto() and matches on the PATH, not the extension,
 * because the locked set is mostly not source: `README.md`, `CLAUDE.md` and
 * `.harness/config.json` are none of them in guardedExtensions, so before this
 * existed `echo x > README.md` and `echo {} > .harness/config.json` both went
 * straight past the shell guard while the identical Edit was denied. A guard the
 * agent can step around by changing tools is not a guard.
 *
 * Adding `.md`/`.json` to guardedExtensions would NOT have been the fix: that
 * list also drives the content detectors, and running them over markdown would
 * start blocking a student's own notes for containing the word localStorage.
 * `PLAN.md` is locked by name instead, through neverWritable.
 */
function writesIntoLocked(command, locked) {
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // A directory entry (".harness/") matches anything beneath it; a file entry
  // matches itself. Both tolerate a leading "./" and surrounding quotes.
  const targets = locked
    .map((p) => (p.endsWith("/") ? `${esc(p)}[\\w./-]*` : esc(p)))
    .join("|");
  if (!targets) return false;
  const target = String.raw`['"]?(?:\./)?(?:${targets})['"]?`;

  return [
    // redirection:  > README.md   >> .harness/config.json
    new RegExp(String.raw`>>?\s*${target}`, "i"),
    new RegExp(String.raw`\b(${WRITE_VERBS})\b[^|;&]*${target}`, "i"),
    new RegExp(String.raw`\b(sed|perl)\b[^|;&]*\s-i\b[^|;&]*${target}`, "i"),
  ].some((re) => re.test(command));
}

function deny(reason, studentMessage) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: reason,
      },
      systemMessage: studentMessage,
    }),
  );
  process.exit(0);
}

const chunks = [];
for await (const c of process.stdin) chunks.push(c);

let event;
try {
  event = JSON.parse(Buffer.concat(chunks).toString("utf8"));
} catch {
  process.exit(0); // envelope is Claude Code's, not the agent's — see guard.mjs
}

try {
  const command = event?.tool_input?.command;
  if (typeof command !== "string" || !command.trim()) process.exit(0);
  if (ALWAYS_OK.some((re) => re.test(command))) process.exit(0);

  const config = loadConfig();
  const exts = config.guardedExtensions ?? [".js"];
  const syntaxCheck = typeof config.syntaxCheck === "string" ? config.syntaxCheck : null;
  // The whole command, not a substring of it. `includes` meant that
  // `node --check main.js; echo x > main.js` skipped every check below — the
  // exemption is for running the project's own check, not for carrying it.
  if (syntaxCheck && new RegExp(`^\\s*${syntaxCheck.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+[\\w./\\\\-]+\\s*$`).test(command)) {
    process.exit(0);
  }

  if (EVAL.test(command)) {
    deny(
      `Blocked: inline scripts (\`-e\`/\`--eval\`/\`-p\`/\`-c\`) are closed off here — they ` +
        `are the one route that can write project files without passing the guard, so they ` +
        `are refused whatever they do. Reading something? Read the file directly. Running ` +
        `the project's own check? That one is allowed by name` +
        (syntaxCheck ? `: \`${syntaxCheck} <file>\`.` : `.`) +
        ` So is \`node .claude/hooks/signoff.mjs\`.`,
      `Harness: blocked an inline-eval command.`,
    );
  }

  if (writesIntoLocked(command, lockedPaths(config))) {
    deny(
      `Blocked: that command writes into a file the harness locks — either its own ` +
        `machinery or the assignment brief. Both are denied to you through Edit and ` +
        `Write, and the shell is not a way around that. If the student wants the ` +
        `requirements changed, that is their instructor's call, not a diff you make ` +
        `for them.`,
      `Harness: blocked a shell write into a locked file.`,
    );
  }

  if (writesInto(command, exts)) {
    deny(
      `Blocked: writing project source through the shell skips the guard that reads ` +
        `what is being written. Use Edit or Write so the check can run. If it refuses, ` +
        `that refusal is the answer — explain the code in chat instead.`,
      `Harness: blocked a shell write into project source.`,
    );
  }

  process.exit(0);
} catch (err) {
  deny(
    `The harness could not check this command, so it denied it. This is a fault in ` +
      `the harness, not a judgement about the command. Tell the student and suggest ` +
      `they mention it to their instructor: ${err?.message ?? err}`,
    `Harness: bash guard error, command denied (failing closed). ${err?.message ?? err}`,
  );
}
