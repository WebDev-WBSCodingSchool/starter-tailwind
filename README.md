# Figma and Tailwind CSS — 003 Intro to JS

Five days (full time) / ten days (part time). Group project, mandatory
presentation at the end.

This repo is your starting point. **Fork it once for your group** and add your
team members as collaborators — one fork, everyone works in it, every change
merges to `main` through a Pull Request.

**Pick your design first, before anything else.** Three ways to go, and they are
worth the same:

- Design your own wireframe in Figma. Header with navigation, a main part built
  out of sections, a footer.
- Re-create the [Find Your Dream Home
  template](https://www.figma.com/design/cJMWiom7k05yqZVF5F5ztJ/Find-Your-Dream-Home-Website-UI-Template--Community-?node-id=0-1)
  as closely as you can. The tasks below are named after its sections, so this is
  the path of least friction.
- Bring a design you found somewhere else — check with your instructor first, who
  will mostly say yes if it is not wildly out of scope.

If you go your own way, the eight tasks below still fit: rename them after your
own sections and keep the count roughly the same.

## Where you are

Five stages. Each one says what ends it, because that is the part nobody can see
from inside it.

1. **Fork it, clone it, run `/onboard`.** Ends when the only thing the check still
   objects to is `PLAN.md` — that one is stage 2, and it stays red until you get
   there. Everything above it should be a tick.
2. **Meet, and write `PLAN.md` together.** Ends when the check is green: every
   member listed has a task line, and your own git email is one of them. Until
   then the agent writes no code for anyone in the group.
3. **Pick a task, cut a branch.** `git switch -c <task-id>-<short-name>`. Ends when
   you have somewhere to put the work that is not `main`.
4. **Write it, commit it, explain it.** Ends when the sign-off records — it tells
   you what just opened up.
5. **Open a Pull Request.** Ends when it is merged. Then back to 3 with the next
   task.

## The requirements

| id | what it asks for |
| --- | --- |
| FR001 | A design settled before you write markup — your own Figma wireframe, the Dream Home template, or something else your instructor has okayed. |
| FR002 | One public GitHub repo for the whole project, so the code can be read. No instructors added as collaborators. |
| FR003 | The finished site published on GitHub Pages. |
| **FR004** | The page structured with semantic HTML — elements chosen for what the content *is*, not for how it will look. |
| FR005 | Tailwind CSS doing the styling, loaded from the CDN. Already wired up in `index.html`. |
| **FR006** | Mobile-first. The phone layout is the one you write plainly; wider screens are prefixed variants on top of it. |
| FR007 | Every change to `main` arrives through a Pull Request. |
| FR008 | The design personalised — your own copy, colours and images, not a grey template with the placeholder text still in it. |
| **FR009** | Layout chosen deliberately. Flexbox and Grid both, wherever each one fits, the way a real project mixes them — but able to say why, section by section. |

**Bold = you type this one yourself.** The others the agent can write with you from
day one.

FR004, FR006 and FR009 are not one person's job — they apply to all eight sections
at once. So they are not what gets split up. What gets split up is the **sections**:

| id | the section |
| --- | --- |
| **T1** | Header and navigation |
| **T2** | Hero and property search bar |
| **T3** | "We help you find" section with the stats row |
| **T4** | "Why choose us" feature cards |
| **T5** | Popular residences — the property cards |
| **T6** | Testimonials |
| **T7** | Get-help call to action, with its form |
| **T8** | Footer |

**These eight are the tasks**, and wherever the rest of this page says "the tasks
marked in bold", it means these. Every one of them is markup *and* styling, and
every one of them has to satisfy FR004, FR006 and FR009 on its own. They all live
in `index.html`.

Eight tasks, two to four of you. Nobody hand-writes all eight: **the first one you
sign off opens the rest**, so the agent works on the remaining sections with you.
Take at least one each, and take it early — the group is blocked on nobody having
gone first.

Designing your own? Rename these after your own sections and keep roughly this
many.

## The setup

This project is HTML files, Tailwind pulled in from the CDN in a `<script>` tag,
and your own images — nothing that has to be installed. No `npm install`, no build
step, no Tailwind CLI. The moment one of you adds one, every other clone stops
working until everyone has run the install, and finding that out on day three
costs the group a day it does not have. If you get there on your own and want a
small library from a CDN — a date picker, a bit of animation — that is still one
`<script>` tag and nothing to install, so it is fine. JavaScript is not what this
project is for: the site has to stand up without it. The current year in the
footer, a library you dropped in, some whimsy — cherries on top, after the pages
are done.

**Install the Tailwind CSS IntelliSense extension** (`bradlc.vscode-tailwindcss`)
in VS Code. It autocompletes utility names and shows you the actual CSS behind one
when you hover it, which is the fastest way to stop guessing. It needs a stylesheet
carrying the Tailwind directive to switch itself on, which is why `styles.css`
exists and is linked — that file is also where anything Tailwind cannot express
belongs.

Nothing in this project is created locally and kept out of git. Everything you
make, including your images, is committed.

## What you type, and what the agent types

Two things are yours. **The markup** — which element each part of the page is made
of, and how they nest. And **the styling** — the utility classes that turn that
markup into the design, including the responsive and state variants, plus any
hand-written CSS in `styles.css` for what Tailwind cannot say. That is the whole
module: a page whose structure means something, dressed by classes you chose.
Neither is a thing you learn by reading someone else's, which is why the agent
will not write either one for you until you have written a section yourself.

The two are separate categories, and the agent will name whichever one it is
declining. They open together, though: the first task you sign off opens markup,
utility classes and plain CSS for you at once, everywhere in the project — not
just in the section you wrote.

**Everything else the agent can write, from day one:**

- Getting GitHub Pages turned on and working out why it is serving a blank page.
- Anything git: branches, Pull Requests, review comments, merge conflicts, and
  getting back work that looks lost.
- Your copy — headlines, section text, the words on the buttons.
- Finding images, sizing them, writing their `alt` text.
- Colour and type choices, and talking you out of the bad ones.
- Reading your markup back to you and telling you what is wrong with it —
  accessibility, heading order, an element doing a job it was not made for.
- Explaining what any Tailwind class does, what a breakpoint prefix means, and
  why one approach to a layout will fight you later.
- Your own notes, `PLAN.md` aside, and the presentation.

**The agent waits to be asked.** It will not start building because a file is empty
or because your plan is finished — none of this is a to-do list it works through on
its own. Ask it for what you want, and expect it to ask you back when there is
something to decide.

Yes, this tells you exactly what you could paste into a browser chat instead. You
are being told the rule rather than fenced in by it, because a rule you can read is
one you can decide to keep.

## Write it, commit it, explain it

When you have written one of the tasks marked in bold above:

```
1. Write it.
2. Commit it.   git add <your file> && git commit --signoff -m "<task id>: <what it does>"
3. Explain it.  The agent asks what your commit does, then a few short questions.
```

**Step 3 is the one worth having.** Explaining code you have just written is how
you find out whether you understood it, and it works the same whether anyone is
listening or not. Expect one question about what your commit does and up to three
short follow-ups: more for a big commit, fewer for a small one. Nothing is graded
and nothing you say is written down — the commit ahead of it in the history is
already the record of who wrote what.

**What changes afterwards.** Once you have written and explained one piece of a
given kind of code, the agent will write that kind with you for the rest of the
project — including in features that are nowhere in the requirements.

Which of the tasks marked in bold you have done is kept in a small file under
`.claude/harness/progress/`, filed under your git email. The agent writes it once you
have explained your commit; you commit it like anything else. Ask it where you
stand whenever you want to know.

### Signing your commits

`git commit --signoff` adds one line to the commit message:

```
Signed-off-by: Lea Müller <lea.mueller@example.com>
```

It means **I wrote this code**. It is an ordinary git trailer — you will meet it in
real projects. Nothing here checks it, and it is worth doing anyway.

Use it on your own work throughout the project, not only on the tasks marked in
bold. When the agent wrote or helped write something, the commit carries a
`Co-Authored-By: Claude …` line instead, which it adds itself. Between the two,
`git log` shows who wrote what — which is more use to all of you than trying to
remember in week three.

### Reviewing a teammate's code counts

If a teammate wrote one of their tasks, post a real review on their Pull Request
and answer the agent's questions about their code, and the agent will write
markup and utilities with you too — even after the PR has merged. Tell it which
PR; it records the same way.

It is capped: you can never have more reviewed tasks than written ones, so the
first one is always your own. Nobody can sit out the writing, and everyone reads
every part of the project rather than just their own two tasks.

## Before any of that: `PLAN.md`

**The agent writes no code for anyone in the group until `PLAN.md` exists and
every member listed in it has at least one task.** Meet first — one call, one
screen shared — and write it together.

Two halves. First, a short restatement **in your own words**: what you are
building, who uses it, and what "done" looks like.

While you are all there, talk these four through **together**. Nobody is being
put on the spot and there is no going round the room — they are here because they
are the things a group usually discovers it disagreed about on day four:

- **How do you actually start mobile-first in Tailwind?** Which classes carry the
  phone layout, and which ones only come in at a breakpoint?
- **Which parts of this design will need the most rework at phone width?** Look at
  the wireframe and name them now.
- **Where do your breakpoints go?** Pick them once, together, so eight sections do
  not arrive with eight different ideas of "tablet".
- **What does *done* mean for one section?** Concretely enough that you know when
  to open the Pull Request rather than keep polishing.

Write down what you land on. It does not have to be right — it has to be shared.

Then the split. Everyone's **git email** — the address `git config user.email`
prints — and each of you again on the task you took:

```markdown
## Who's in the group
- Jane Student — jane.student@mail.com
- Mo Ahmadi — mo.ahmadi@mail.com

## The split
- Login page (T1) — Jane
- Settings page (T2) — Mo Ahmadi
```

That is the whole format. A list, a table, prose, German, English — it does not
care. Each of you has to turn up twice: once in the member list with your **git**
email, and again on the task you took. On the task line your name is enough — the
address is only needed once, because that is what your progress is filed under.

Run `/onboard` and the agent will run the conversation, ask the awkward questions,
and check the file. **It will not write a word of it** — `PLAN.md` is what the
check reads, so an agent that could write it could clear its own way.

**The check is live.** Edit `PLAN.md` so that someone has no task and the agent
stops writing code for everyone until the line is fixed. There is nothing to
re-run: it reads the file again on the next write. That is the accountability
part, and it is meant to be visible rather than clever. If someone has actually
left the group, take them off the member list — that is the right answer, not a
slight.

A sketch is enough and it is allowed to change. The question is whether you have a
plan, never whether it was any good.

## Splitting the work

`PLAN.md` is the kickoff snapshot. **From then on your tasks are GitHub Issues on
your fork** — `/onboard` can create them from your task lines, or make them by
hand; the issues are the live version and nothing syncs them back.

Write them yourselves either way — the agent will not hand you a breakdown. Once
you have a draft it will tell you if the load looks lopsided, if something is
blocked on two other people, or if two of you are about to land in the same
function.

That last one will happen. It is a single-page site, so all eight sections live in
`index.html` and every one of you is editing that file all week — this is the
project in the whole course most likely to give you merge conflicts, and there is
no arrangement of the work that designs them away. Keep your sections in the order
the page has them, pull `main` before you start and again before you open the PR,
and expect to meet in the middle of that file anyway. Resolve them together; that
is the point.

Ask for help if you are stuck for more than 30 minutes. Use the daily stand-ups.

## Running it

Open **this folder** in VS Code and start Claude Code from the repo root. Starting
it from a subfolder silently drops this folder's settings, which mostly means the
agent starts writing code it should be helping you write.

Your progress is filed under your git email, so set it once and use the same one
on every machine you work from — otherwise the work you did in the lab and the
work you did at home end up in two separate records, and neither counts for the
other.

**If you want the agent to talk differently** — simpler language, shorter answers,
more or less detail — say so, and ask it to save that as a personal skill in
`~/.claude/skills/`. It travels with you to the next project, so you only have to
ask once. It changes how the agent talks, not what it may write.

Inline suggestions (Copilot-style ghost text) are turned off for this folder in
`.vscode/settings.json`. That file is read-only, and the agent cannot write to it
at all — otherwise it could hand ghost text back in a single edit, and ghost text
is the one form of help that arrives without being asked for.

**This file is read-only too**, along with `CLAUDE.md`. This page is the
requirements: it is what the agent reads to work out what it may write for you and
what it may only talk you through, so it is not a page the agent gets to reword.
`PLAN.md` is read-only to the agent as well, for a different reason: it is yours,
and it is what the check reads. Your own writing about your project goes in files
you make — `PLAN.md`, your Issues, whatever else you want.

If you think a requirement is wrong or unclear, say so to your instructor. That is
a conversation, not a diff.

None of these locks is a cage, and you should know that up front: read-only here
means VS Code refuses the keystroke, and there is a setting that turns that off, and
there are other editors. What none of it can do is happen quietly. Every file named
above is committed, so however you go about changing one, it lands in your PR with
your name on it. That is the whole mechanism — not "you can't", but "it's visible".
