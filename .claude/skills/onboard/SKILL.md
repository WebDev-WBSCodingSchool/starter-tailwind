---
name: onboard
description: Run the kickoff — the group's huddle, where this repo has one, that produces PLAN.md — and the checks that confirm a clone is set up right. Use when a student runs /onboard, when PLAN.md does not exist yet, when a write is refused because the plan is not settled, or when someone has just cloned the fork.
---

# Onboard

## Which shape this repo is

Read `.harness/config.json` first.

- **`onboarding: true`** — a group assignment. Run the huddle, then the checks.
  `PLAN.md` is the gate and nothing is written until it passes.
- **`onboarding: false`** — the student is **working alone**. There is no huddle, no
  `PLAN.md`, no split, and `--issues` has nothing to derive from. **The preflight
  checks still run**, and they earn their place for one student exactly as for four:
  at the repo root, git email set, and Pull Requests pointing at their own fork
  rather than the repo they forked from.

  Where the brief carries an interpretation question, ask it — once, before any
  code. Solo, the assumption that would have been argued about gets made silently
  instead, which is worse, not better.

Where this repo has a `PLAN.md`, the group meets once, on a call with one screen
shared, and writes it together: their git emails, and the tasks, each carrying an
email. Then everyone clones and runs the check below — solo, that is just you.

**You facilitate. You write none of it.** `PLAN.md` is denied to you, and that is
deliberate — it is the file that is checked, so writing it would mean clearing
your own way.

Start by looking:

```
node .claude/hooks/onboard.mjs --check
```

That prints what the check currently sees, plus three preflight checks: they are
at the repo root, their git email is in the plan, and their Pull Requests point at
their own fork rather than at the repo they forked from. The last one it fixes
while it is there — a line of local git config, nothing committed. Safe to run as
often as you like.

Two of its failures mean *you are in the wrong repo*, and both are worth stopping
for — everything written before it is fixed is work that has to be moved:

- **read access only** — they cloned the repo they were meant to fork.
- **"the repo everybody else forked"** — they own it, so pushes will succeed and
  land where nobody is looking. This one has no error message of its own anywhere
  in git, so it is worth saying out loud that nothing is broken and nothing is
  lost; the branch is simply in the other repo.

## Two situations

### `PLAN.md` does not exist — run the huddle

This is a conversation, not a form. Ask **one thing at a time** and let them
answer; the point is that four people discover they meant four different things.

1. **What are you building?** In their words, not the brief's.
2. **Who uses it?** If they name the course — the instructor, the presentation —
   ask who would use it if it were not an assignment.
3. **What does *done* look like?** Concretely enough to disagree about.
4. **Take the requirement most open to interpretation — what did each of you
   think it meant?** Ask each member separately, out
   loud, before anyone hears the others. This is the highest-value question in the
   whole huddle — it is the one that reliably surfaces a split assumption while it
   is still cheap.
5. **Then the tasks.** Walk the requirements and let them claim work until
   everyone has at least one. If they stall, ask what the next thing that has to
   exist is.

Say plainly, once, that this is one to have with everyone present. A plan written
by one member alone leaves the other three's assumptions uncollected, which is the
entire thing it exists to surface.

**What to say about the shape.** They need their git emails in it — the address
`git config user.email` prints, because that is what their progress is filed under — and
each person's address again on the task they took. That is all the structure there
is. Any format: a list, a table, prose. German or English.

When they have it written, run `--check` and read out what it says.

### `PLAN.md` exists — check it and get out of the way

Run `--check`, report what it found, and offer the issues (below). Then stop.

**Say what looks thin, once, and proceed either way.** Load lopsided, someone
blocked on two other people's work, two of them landing in the same function —
name it and move on. Two people in the same function is a merge conflict they will
resolve together, and in this project the conflicts are the lesson: say so, do not
engineer it away.

The question is whether a plan exists, never whether it was any good. **A sketch is
enough, and it is allowed to change later.** Do not hold them here.

## The issues

Optional, and worth offering once:

```
node .claude/hooks/onboard.mjs --issues
```

One issue per task line, assigned by email where GitHub knows the address. Safe to
run twice — it matches on title and will not post duplicates. If `gh` is missing or
not logged in it says so and stops; that costs nothing, because the split is in
`PLAN.md` and that is the copy that counts. **Do not talk them into installing
anything.**

It prints which repo the issues went into. **Read that line out** — a fork's issues
default to the repo it was forked from, and this is where that shows. It also turns
the Issues tab on if it is off, which on a fresh fork it always is.

From then on the issues are the live version and `PLAN.md` is the kickoff
snapshot. Nothing syncs the two and nothing needs to.

## When a write was refused because of `PLAN.md`

The message names the person, quotes the line, and gives both exits — give
them a task, or take them off the member list if they are not on this project.
Read it out and help them fix the line. **They edit `PLAN.md`; you do not.**

It re-reads the file on the next write, so there is nothing to re-run and nothing
to refresh. Say that — otherwise it looks like a thing they have to appease.

If someone has genuinely left the group, taking them out of the member list is the
right answer and not a slight. Say so, so nobody invents busywork for an absent
teammate.

## Never

- Write `PLAN.md`, or any part of it, or dictate a line for someone to paste.
- Offer a task title, or a breakdown, or a suggested split.
- Suggest turning the check off. It is a config line and it is not yours.
- Treat the huddle as a planning workshop. Project management is a side-benefit
  of this course, not its subject — keep it proportionate.
