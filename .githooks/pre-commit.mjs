// The only surface in this harness that sees the student's own commits.
// guard.mjs sees what the agent writes and nothing else, so a student hand-typing
// on main is invisible to everything but this.
//
// Wired per clone by `/onboard --check`, with one line of local git config:
//   git config core.hooksPath .githooks
// Local, never committed — the same idiom base-repo-check used for the gh base.
//
// git does not run this file directly — it runs the sibling `pre-commit` (a
// POSIX sh script), which is where the fail-open guarantee actually lives now.
// That script exits 0 (commit proceeds) unless this file exits with exactly 9,
// its one deliberate "block this commit" signal; every other outcome here —
// the warn path's 0, an uncaught exception, a syntax error, `node` itself not
// being on PATH — reaches git as a passed commit. So there is nothing to
// fail-open *inside* this file: a crash before a single line below runs is
// already handled by the wrapper, not by a try/catch here.
//
// That is also why the import below can be a plain static `import`, unlike
// the workaround this file used to need: this file's own extension is `.mjs`,
// which settles its module mode (ESM) unconditionally — no package.json in
// this tree, or a later one, changes what a `.mjs` file is. (It used to be
// extensionless, with module mode decided by whichever package.json the repo
// it's vendored into happens to ship; that ambiguity is why the import used
// to be dynamic. Giving the file an extension removed the ambiguity instead
// of working around it.)

import { loadConfig, branchState } from "../.claude/hooks/harness.mjs";

const state = branchState(loadConfig());

if (state.problems.length) {
  for (const p of state.problems) process.stderr.write(`\n  ${p.text}\n`);

  if (state.mode === "block") {
    process.stderr.write(
      `\n  This commit was not made. Fix the above and commit again — nothing is lost, ` +
        `everything you staged is still staged.\n` +
        `  If you know what you are doing: git commit --no-verify.\n\n`,
    );
    process.exit(9);
  }
  process.stderr.write(`\n  Committed anyway — this is a warning, not a wall.\n\n`);
}
process.exit(0);
