# `.claude/harness/`

State and configuration for the harness. **Students don't edit anything in here**,
and neither does the agent: `guard.mjs` refuses agent writes to this whole
directory.

## `config.json`

This assignment written as data. The scripts in `.claude/hooks/` carry the
mechanism; this file carries the facts that change from one assignment to the
next.

| key                 | what it is                                                                                                                                                                                                              |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `assignment`        | The module and project name. Descriptive only: no script reads it. It is here so whoever is reading this config knows which assignment it belongs to.                         |
| `variant`           | Which named variant of the assignment this is, where a module has more than one retelling of the same requirements. Nothing in the harness reads it either, and it can be deleted where an assignment has no variant. |
| `unlockRoute`       | Whether anything gated can become open _within_ this assignment. `true` on a project: tasks unlock gated categories as they are signed off, tracked in a progress file. `false` on a short hand-coding daily, where there is nothing to earn task by task, so `signoff.mjs` offers `--done` instead of per-task sign-off and opens everything gated at once.                         |
| `onboarding`        | Whether the `PLAN.md` gate applies at all. `true` on a group project: no code for anyone until `PLAN.md` exists and every member it lists has a task, checked live on every guarded write. `false` on a solo assignment, where there is no group to plan with, so the gate and `onboard.mjs --check`'s plan-related item are both skipped rather than failed.                         |
| `planFile`          | Which file the onboarding gate reads as the group's plan. `"PLAN.md"` unless changed. `guard.mjs` locks this exact path so only the check, never the agent, can pass it.                                              |
| `gated`             | Which content categories are closed until demonstrated. Names, not patterns. Each one maps to a detector function in `guard.mjs`.                                                                                      |
| `syntaxCheck`       | The command the tutor runs to decide whether a file is a syntax error rather than merely wrong, in this assignment's language. It lives in data because it is language-specific: `bash-guard.mjs` always allows it, and the tutor skill skips that step when it is absent.                          |
| `guardedExtensions` | Which files the content detectors run against. `.html` is included so an inline `<script>` isn't a free pass.                                                                                                           |
| `neverWritable`     | The scripts themselves. Paths the agent may not write whatever the content: its own gate, the progress files, the `.vscode/` lockdown, and `.claude/skills/`. The skill is the script for the refusal, so an agent that can rewrite it keeps the refusal and drops the behaviour that goes with it. |
| `writableExceptions` | Holes in the above, for an assignment whose topic *is* the locked thing. A module on writing skills needs `.claude/skills/<theirs>/` open. Empty by default. Content gating still applies inside an exempt path.       |
| `canonical`         | The brief. `README.md` and the `CLAUDE.md` that imports it: the text the agent is held to, and therefore not text the agent may rewrite. Same lock as `neverWritable`, different reason given when it refuses. |
| `tasks`             | The core tasks, by FR id. `file` is where the work lands. `signoff.mjs` checks _that_ file for uncommitted changes and walks every commit that touched it, not the whole tree. `categories` is what the task exercises, and therefore what unlocking it opens. |
| `preScaffold`       | Set when a task's `file` is not expected to exist yet by design, because the student sets the tree up themselves (an `npm create vite`, say) before any task file can exist. Read only by the generator's `verify.mjs`, which then skips its "task file already exists" check while still checking the extension and category coverage of every task. |
| `localFile`         | The file a student creates locally, from a committed template, and never commits. A `config.js` holding an API key, say. No hook here reads it; only the generator's `verify.mjs` does, to confirm the name it names is actually listed in `.gitignore`. Absent where the assignment has no such file. |
| `integrationBranch` | The branch feature branches are cut from and merged back into. `"main"` unless the group works on a `dev` branch. Read by `signoff.mjs` to decide which commits belong to this task, and by the branch checks to spot a stale base. |
| `branchDiscipline`  | `"block" \| "warn" \| "off"`. What happens when work is on `main`, on a stale base, on an already-merged branch, or on a branch a previous sign-off already used. `"warn"` reports, and at commit time asks whether to go ahead anyway; `"block"` refuses. Either way it applies only where `PLAN.md` names two or more people. Branches exist so somebody else can read the work first, and a solo student has nobody to wait for, so for them this is off whatever it says here. This is the help that fades: early assignments block, mid-term ones warn, late ones turn it off. |
| `progressDir`       | Where per-student progress files live, one JSON file per student. `".claude/harness/progress"` unless changed. Read and written by `harness.mjs`'s progress functions. This is what `signoff.mjs` updates and what `--status` and the guard read back to decide what is unlocked. |
| `transcripts`       | Whether `transcript.mjs` copies each session's Claude Code transcript into `.claude/harness/transcripts/` and commits it. `false` is the shipped default and the only one a public student repo should ever run with. See the `transcripts/` section below. |

Two things are deliberately **not** here:

- **The open set.** The guard refuses only what matches a gated detector, so it
  never needs a list of what is allowed. Listing where students may ask for agent
  help would turn a cautious floor into "everything is refused unless listed",
  which is a much harsher design. The open set is documentation and lives in
  `README.md`.
- **Regexes.** `gated` names detectors that live in `guard.mjs`, where they can be
  tested. A bad pattern in a data file is a live gate failure on a student's
  machine.

## Porting this to another assignment

Change `config.json`; don't fork the scripts. A new _category_ (React types, say)
needs a new detector in `guard.mjs`, which is an addition, and the assignment
stays data.

## Writing the skills

The skills are read by an agent that is about to speak, and it does not reliably
tell a question it should ask from a note about what to do with the answer. Both
sit in the same position on the page, so it says both. Observed: a question
written as *"Who uses it? If the answer is X, ask again"* reached the student
whole, and they heard a verdict on an answer they had not given yet.

So **anything written where the agent expects a line to say has to be safe to say
out loud.** A qualifier of the question is fine, because it survives being voiced.
A direction about how to handle the reply is not: put it in prose, or in the
skill's `## Never` list, never appended to the question. The point is that there
is nothing quotable to leak, rather than a rule telling the agent not to quote.

This bites hardest in English. A student writing in another language forces every
sentence to be re-generated, which hides a badly drafted line instead of fixing it.

## `progress/<student>.json`

Guard state, one file per student, committed. The filename is the part of their
git email before the `@`, lowercased. Written **only** by `signoff.mjs`, and read
on every gated write to decide the agent's permitted level of help.

Every field is a git fact or a state flag: `task`, `at`, `route`, `branch`,
`commits`, plus `pr` and `author` on a reviewed one. `branch` is the branch the
work was written on. `commits` is every commit on it that touched the task's file,
in sum the evidence for a solved task, a first go and its fixes rather than just
the last of them. On a reviewed row `branch` is empty and `commits` holds only the
reviewer's HEAD at review time, because the work is the author's, not the
reviewer's, and `pr` plus `author` carry that provenance instead. `route` is
`written`, `reviewed`, or `done`. The last only appears where `unlockRoute` is
`false`, and carries no task, because a short exercise is finished all at once
rather than piece by piece.

`coverage()` reads **all** of these files, not just this student's, to answer one
question: has the group hand-written the core? Only `written` rows count toward
it, so a task cannot be covered by the people who reviewed it. It gates nothing.
The agent reads it through `signoff.mjs --status` to decide whether the setup
limit in `README.md` is still a block.

Nothing in it is prose about a student, and nothing you said while explaining your
work is stored here. That is the test to apply if anyone ever proposes adding a
field, and the reason transcript logging below is a separate file, a separate
flag, and off by default rather than a column in this one.

Nothing renders this. It's committed because a local-only file evaporates on a
fresh clone or a second laptop, which would punish the student working in the
evening.

## `transcripts/` — development only, off by default

**This exists for building the harness and it does not ship.** The repos students
use for real are public, where logging conversations would be indefensible, so
`false` is the committed default, a test holds it there, and the whole thing is
built to be deleted rather than configured off. Turn it on in a *run copy*, never
in this starter (see `red-team/README.md`).

Cutting it out, when the prototype is done, is one file and four greps:

```
rm -r .claude/hooks/transcript.mjs .claude/harness/transcripts
# then delete the "Stop" and "SessionEnd" blocks from .claude/settings.json,
# the "transcripts" key from config.json, this section, and the two test
# blocks. `grep -rin transcript` finds every trace; the suite fails if a
# settings.json hook is left pointing at a script that no longer exists.
```

Nothing else imports it. `transcript.mjs` reads `harness.mjs` and nothing reads
`transcript.mjs`, so removing it is a delete rather than an unpicking.

`"transcripts": true` in `config.json` turns on `.claude/hooks/transcript.mjs`,
which copies the session's full Claude Code transcript into
`.claude/harness/transcripts/<student>-<session>.jsonl` after every agent turn and
commits it once per session. It is the whole conversation, word for word, plus
every file the agent read on the way.

**This is for instructor-run test cohorts on a private repo, and it is the only
part of this harness that records what a student said.** Three conditions, and the
flag is off until all three hold:

1. **The repo is private.** The brief asks for a public one, and a public repo
   plus this flag publishes every student's conversation permanently.
2. **Consent is given up front, in person, and the student can decline**, which
   means a run with the flag off has to still be a usable run. It is: nothing else
   reads these files.
3. **`README.md` says it is happening.** The test suite fails if the flag is on
   and the brief does not disclose it, because the harness's whole stance is that
   nothing about it happens quietly. Paste-ready:

   > **This run is being logged.** Your conversations with the agent are copied
   > into `.claude/harness/transcripts/` and committed, so we can see where the
   > harness helps and where it gets in the way. The repo is private and only the
   > instructors read it. It is the full conversation, so treat it like anything
   > else you commit, and say so if you would rather not have it on, which is a
   > fine answer and changes nothing else about the project.

Two things to know before switching it on. Transcripts contain whatever the agent
read, and that includes whatever local credential file the assignment has, so **a
secret the agent reads lands in a committed transcript**. Regenerate it after a
logged run. And the commit is made by a hook rather than by the student, which is
the one write in this repo that nobody asked for. It commits that one path only,
so anything the student has staged stays staged.

Analysis is a script over the `.jsonl`: one JSON object per line, `type` of `user`
or `assistant`, with `timestamp`, `cwd` and `gitBranch` on each. Run 3's word
counts came out of exactly this shape, read out of `~/.claude/projects/`.
