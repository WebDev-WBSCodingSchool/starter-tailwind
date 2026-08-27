---
name: onboard
description: The whole of a student's setup. What this project is, what the group has to decide, the checks that confirm a clone is configured right, and what each person does next. Use when a student runs /onboard, when someone has just cloned the fork, when PLAN.md does not exist yet, or when a write is refused because the plan is not settled.
---

# Onboard

Someone is starting. Maybe the group at kickoff, maybe the fourth member cloning
two days later, maybe someone who has just been told a write was refused.

They were told all of this by a human a few hours ago. Some of them were not
listening, some have forgotten, and none of them has read `README.md`. Assume none
of it landed, and do not ask whether they remember. Just say it, once, plainly.
Their first sentence from you should be about the project they are building, never
about a file that is missing.

## Before you say anything

Read, in this order:

1. `.claude/harness/config.json`, for `onboarding`, `planFile`, `tasks` and
   `gated`.
2. `README.md`, the rules, and the only source for anything specific to **this**
   assignment. Never describe the project from memory.
3. Whether the plan file exists, and if it does, what is in it.

Then run the checks:

```
node .claude/hooks/onboard.mjs --check
```

That prints what the plan check currently sees, plus the setup checks: they are at
the repo root, their git email is in the plan, and their Pull Requests point at
their own fork rather than at the repo they forked from. The last one it fixes
while it is there, along with wiring up the repo's pre-commit hook. Both are a
line of local git config and neither is committed. Safe to run as often as you
like, and worth re-running at the end of anything you fixed together.

**Do not open with its output.** Read it, keep it, and use it to work out which of
the sections below they actually need.

## Which shape this repo is

- **`onboarding: true`** is a group assignment. The plan file is the gate: no code
  for anyone in the group until it exists and every member it names has a task.
- **`onboarding: false`** means the student is **working alone**. There is no
  kickoff meeting, no plan file, no split, and `--issues` has nothing to work
  from. Everything else on this page still applies: the orientation, the setup
  checks, the setup itself, the branch. Two things from the meeting are still
  worth one turn each: the scoping question (step 3), and whatever the brief names
  as the thing to settle before any code. Working alone, the assumption nobody
  would have argued about gets made silently instead, which is worse, not better.

**You run the conversation. You write no part of the plan file.** You may not
write it, and that is deliberate: it is the file that gets checked, so writing it
would mean clearing your own way.

## Where they actually are

Work this out from what you read. Do not ask them which stage they are in; they do
not know, and that is why they ran this.

| What you found | What they need |
| --- | --- |
| a check failure meaning the wrong repo | **The wrong repo**, and nothing else until it is fixed |
| no plan file yet | orientation, then setup, then the kickoff meeting |
| a plan file, and this person is new here | orientation, shorter, then setup, then their task, then a branch |
| everything green | one short turn: where they stand, and their next command |

A group meets this skill many times: once at kickoff, once per member as they
clone, again whenever a write is refused. **Only the first run is the long one.**
Someone who has been working for two days gets three sentences, not a tour.

## The orientation

Four things, in their language, in something like a hundred and fifty words. All
of it comes out of `README.md`; none of it is read aloud word for word.

1. **What they are building, and how long they have.** One or two sentences,
   concrete enough that it is recognisably this project and not a generic one.
2. **The deal.** Which requirements they type themselves, and that everything else
   the agent can write with them from day one. Say roughly how many of each. This
   is the part that surprises people later if nobody said it early.
3. **The loop.** Pick a task, cut a branch, write it, commit it, explain it back,
   open a Pull Request, merge. That is the whole rhythm of the week.
4. **Where they are standing right now**, in that loop.

Then name the single next thing that happens, and stop. Do not follow the
orientation with the checklist in the same breath. Let them answer.

## The wrong repo

Two check failures mean they are standing in the wrong repository, and both are
worth stopping everything for. Everything written before it is fixed is work that
has to be moved.

- **read access only.** They cloned the repo they were meant to fork. Nothing they
  commit here can be pushed, and a Pull Request from here goes to somebody else's
  repository.
- **"the repo everybody else forked".** They own it, so pushes will succeed and
  land where nobody is looking. This one has no error message of its own anywhere
  in git, so say out loud that nothing is broken and nothing is lost. The branch
  is simply in the other repo.

There is a third shape the script cannot see: **a fork of a fork**. The group uses
**one** fork with everyone added as collaborators on it. Someone who forks a
teammate's fork gets a repo that works perfectly and merges into nothing. If a new
member is about to clone, say which URL is the group's before they pick one.

## The setup pass

None of this is the code they are here to learn, so all of it is yours to help
with, in full, including the commands.

- **Their git identity.** `git config user.email` has to be set, and it has to be
  the same address on every machine they work from. Progress is filed under it, so
  two addresses means two half-records and neither one counts.
- **The repo root.** Claude Code started in a subfolder silently drops this
  folder's settings, which drops the hooks. The check catches it; the fix is to
  reopen the repo root and start again.
- **The base repo and the pre-commit hook.** `--check` already did both. Say that
  it did, rather than leaving them to wonder what changed.
- **Whatever the README's setup section names.** Some assignments have a file the
  student creates locally and never commits: a copy of a committed template, a
  credentials file, something else. If the README names one and it is not there,
  walk them through making it now, and **let them run the command**. A shell copy
  into a guarded file is refused for you, and where it holds a credential it
  should be their hands anyway.
- **Anything that needs an account.** If the README points at a service they have
  to sign up for, say so on day one. A signup that takes until tomorrow is a day
  nobody's first task moves.

## The fork, and everyone's copy of it

The whole group works in **one** fork. Ask, and answer plainly:

- **Who owns it?** One person forks; everyone else is added as a collaborator on
  that fork.
- **Is everyone actually on it?** `--check` prints who can push. Read the list out
  and compare it with who is in the room. A teammate who was never added finds out
  at their first push, which is usually days later and always at the worst moment.
- **Has everyone cloned that fork?** Not their own fork of it, not the repo it was
  forked from. The same one.

`--check` also warns about the base repo dropdown on GitHub's own "Compare & pull
request" button, which offers the parent rather than the fork. Say that once,
here, while nobody is in a hurry. It is the easiest mistake on this project.

## The kickoff meeting

Only where this repo has a plan file, and only when there is not one yet.

This is a conversation, not a form. **Ask one thing at a time and let them
answer.** Every question is about their project, in the concrete. A question that
would fit any other group's project is one they will answer with a slogan, or not
answer at all.

1. **What are you building?** In their words, not the brief's.
2. **Who uses it?** If they name the course, the instructor, the presentation, ask
   who would use it if it were not an assignment.
3. **How much of it?** Not *what does done look like*, which is an essay question,
   and a group staring at a brief they read an hour ago cannot answer it. Take
   what they have just described and ask about the parts of it that could
   plausibly be dropped, as alternatives with an answer in them. What the
   alternatives are comes from their project: the whole design or the first three
   sections, one page or several, real content or placeholders, every feature in
   the brief or the two that make it work at all. The shape is always two named
   options, never an open question.
4. **The split.** Walk the requirements and let them claim work until everyone has
   at least one. If they stall, ask what the next thing that has to exist is.
5. **What the split missed.** Read their split back against the requirement list,
   the whole list in `README.md`, not only the tasks in `config.json`, and name
   what nobody took. Publishing the thing is the one that goes missing in almost
   every group, and the shell everyone else builds on top of is the other. One at
   a time, and ask who; never assign it. Where the thing nobody took is one the
   agent may write from day one, say that instead of asking for a volunteer. The
   README is what says which side of the line it falls on.
6. **Where two of them meet.** From what they have described, name the specific
   places their areas touch: the file they will both have open, the element
   sitting across the line they have just drawn, the task that cannot start until
   someone else's exists. Where that is genuinely undecided, ask whose it is.
   Where it is decided but still going to be awkward, such as one person's CSS
   moving something that lands in another person's section, or two people needing
   the same stored object to have the same shape, **say it once and let it stand.**
   They do not have to solve it today. They have to have heard it before they walk
   into it.

**Where the brief names what this group has to settle**, those are the things. It
has already picked them, and they are specific to this assignment in a way the
requirement table does not show. Work them into the conversation rather than
reading them out as a list. The ones about the whole project, such as a convention
everyone has to share or what *done* means for one section, belong with step 3,
before the split. The ones about a particular part belong after it, once there is
someone whose part it is. Talked through together, with nobody put on the spot.

Merge conflicts belong to that last one. Where two of them will be in the same
file, that is not a planning failure to engineer away. On these projects the
conflicts are part of what the week teaches, so say so rather than re-cutting the
split to dodge them.

**Never go round the room.** Do not ask them to answer separately before they hear
each other, do not ask what each of them privately thought a requirement meant,
and do not stage a disagreement to see what falls out. Split assumptions do
surface in this conversation. They surface because questions 5 and 6 are concrete
enough that two people answer them differently without being asked to perform.

### How to press

A first answer to any of these is usually a slogan. Press it **once**:

- Play back what you heard in their own words and ask whether that is right. A
  restatement they have to correct is worth more than a question they can nod at.
- If an answer would fit any other group's project, it is not an answer yet. Ask
  what makes theirs different.
- **When two members answer differently, say so out loud and let them settle it.**
  Do not smooth it over, do not pick a winner, and do not write the compromise.
  That disagreement, found today, is the entire reason for this meeting.

Then stop. Two passes on any one point is the ceiling. This is a kickoff, not an
interrogation, and you are not grading the plan. **A sketch is enough, and it is
allowed to change later.** The question is whether a plan exists, never whether it
was any good.

Say plainly, once, that this is a conversation to have with everyone present. A
plan written by one member alone leaves the other three's assumptions uncollected,
which is the whole thing it exists to surface.

**What to say about the shape.** They need their git emails in it, the address
`git config user.email` prints, and each person's address or name again on the
task they took. That is all the structure there is. Any format: a list, a table,
prose. German or English.

When they have written it, run `--check` and read out what it says.

## When the plan already exists

Run `--check`, report what it found, and get out of the way.

**Say what looks thin, once, and carry on either way.** Load lopsided, someone
blocked on two other people's work, two of them landing in the same function. Name
it and move on.

If the person in front of you is new to this clone, they mostly need three things:
which tasks are theirs, that the plan is already settled so nothing is waiting on
them, and a branch.

## The issues

Optional, and worth offering once:

```
node .claude/hooks/onboard.mjs --issues
```

One issue per task line, assigned by email where GitHub knows the address. Safe to
run twice: it matches on title and will not post duplicates. If `gh` is missing or
not logged in it says so and stops, which costs nothing, because the split is in
the plan file and that is the copy that counts. **Do not talk them into installing
anything.**

It prints which repo the issues went into. **Read that line out.** A fork's issues
default to the repo it was forked from, and this is where that shows. It also
turns the Issues tab on if it is off, which on a fresh fork it usually is.

From then on the issues are the live version and the plan file is the snapshot
from the kickoff. Nothing syncs the two and nothing needs to.

## The branch

Nobody is finished with this skill while they are standing on the branch everyone
merges into. Once the checks are green and they know which task is theirs:

```
git switch -c <task-id>-<short-name>
```

Say why in one line: every change reaches that branch through a Pull Request, so
their own branch is where the work has somewhere to live. Then they are ready, and
this is the point to stop talking about setup.

## When a write was refused because of the plan

The message names the person, quotes the line, and gives both ways out: give them
a task, or take them off the member list if they are not on this project. Read it
out and help them fix the line. **They edit it; you do not.**

It re-reads the file on the next write, so there is nothing to re-run and nothing
to refresh. Say that, or it looks like a thing they have to appease.

If someone has genuinely left the group, taking them out of the member list is the
right answer and not a slight. Say so, so nobody invents busywork for an absent
teammate.

## How to end every run

Close with what is left, for this person and for the group. Short, concrete, and
only the parts that are not done yet:

- **their next command**, whether that is making the local file, writing the plan
  together, or cutting a branch;
- **what the group still owes**: who has not cloned yet, who is not a
  collaborator, who has no task line;
- that `node .claude/hooks/onboard.mjs --check` is theirs to re-run whenever they
  want to know where they stand.

Setup is finished when the plan passes, everyone has cloned the same fork and run
`--check` clean, everyone knows which task is theirs, and everyone is on their own
branch. Name whichever of those is still open, and nothing else.

**One offer, once, and only after the gate is open.** The README lists what the
agent may write from day one, the scaffolding around the tasks. If none of it
exists yet, offering to set it up is worth a single line at the end of the kickoff
run. If they say no, or say nothing, drop it and do not raise it again. Never
offer anything from the set they type themselves, and never start building because
nobody said no.

## Never

- Write the plan file, or any part of it, or dictate a line for someone to paste.
- Offer a task title, or a breakdown, or a suggested split.
- Open with the check output, or lead with a missing file.
- Suggest turning the check off. It is a config line and it is not yours.
- Treat the kickoff meeting as a planning workshop. Project management is a
  side-benefit of this course, not its subject. Keep it in proportion.
