// Copies this session's transcript into the repo so it lands in git.
//
// Off unless `.harness/config.json` says `"transcripts": true`, and the README
// says so where the student reads it — a log nobody was told about is the one
// thing on this map that a student could not see happening.
//
// Two events, one script. `Stop` copies after every agent turn, so a killed
// terminal still leaves the file on disk. `SessionEnd` copies and commits, so
// there is exactly one transcript commit per session rather than one per turn —
// `git log` is the evidence surface everywhere else here and drowning it would
// cost more than the logging is worth.
//
// Everything fails open. Unlike guard.mjs, the worst case here is a missing
// sample, not a student who cannot work.

import { copyFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { root, loadConfig, git, studentKey } from "./harness.mjs";

const DIR = ".harness/transcripts";

let event = {};
try {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  event = JSON.parse(Buffer.concat(chunks).toString("utf8"));
} catch {
  process.exit(0);
}

let config;
try {
  config = loadConfig();
} catch {
  process.exit(0);
}
if (config.transcripts !== true || !event.transcript_path) process.exit(0);

try {
  mkdirSync(join(root, DIR), { recursive: true });
  copyFileSync(event.transcript_path, join(root, DIR, `${studentKey()}-${event.session_id}.jsonl`));
} catch {
  process.exit(0);
}

// `git commit -- <path>` commits that path and nothing else, leaving whatever the
// student has staged staged. It exits non-zero when there is nothing to commit,
// and during a merge or rebase — both are fine, the next session picks the file
// up.
if (event.hook_event_name === "SessionEnd") {
  try {
    git(["add", "--", DIR]);
    git(["commit", "-q", "-m", "Session transcript", "--", DIR]);
  } catch {
    /* nothing to commit, or git is busy. The file is on disk either way. */
  }
}
