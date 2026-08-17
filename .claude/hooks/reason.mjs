// The deny reason string.
//
// Written last, and deliberately.
//
// hooks-research established that `permissionDecisionReason` is handed to Claude
// on every single block. That makes this the one piece of the tutor persona that
// re-primes after every compaction and therefore cannot erode — the skill file
// can be dropped from a long session, this cannot. Anything the agent must not
// forget while a student is struggling at hour six belongs here rather than
// there.
//
// It is also where the *conditional* part lives. The skill is shared across
// assignments and cannot promise an unlock that some assignments do not have.
// The chain is: config -> guard.mjs -> this string -> agent. The skill stays
// generic; this says whether there is a way out on this assignment.
//
// Two things it must not become. Not an error message: the student reads it
// through the agent, so it has to leave the agent something useful to say. And
// not a wall: it is injected on every block, and a reason nobody finishes
// reading is a reason that does not work.
//
// It opens with the line the student should hear, in the student's words. Run 2
// found the agent relaying this string's own vocabulary — "gate", "gated",
// "prose" — and inventing restraint-narration around it. That is what a block
// message full of instructions about itself primes. Give the agent the sentence
// instead, then the instructions, and keep the instructions short.

/**
 * Which tasks would open this category, if the student demonstrated one.
 *
 * Title first, id second, and deliberately: whatever order this prints in is the
 * order the agent says it in, and a student who is told to write "FR009" has been
 * handed a row number instead of a piece of work. The id stays because they type
 * it into a command.
 */
function routesTo(config, category) {
  return config.tasks
    .filter((t) => (t.categories ?? []).includes(category))
    .map((t) => `${t.title} (${t.id})`);
}

export function denyReason({ config, rel, blocked, open }) {
  const what = blocked.join(" and ");
  const lines = [];

  // The student's line first. Say this, near enough, in their language — then
  // talk about their code, not about this message.
  lines.push(
    `Tell them, roughly this and in their language: "${what} is the part of ` +
      `${rel} you write yourself — that's what this module is for. I'll help you ` +
      `get there." Then help. Do not apologise, do not retry the write, and do not ` +
      `route around it — not through Bash, not by asking them to paste your code in.`,
  );

  lines.push(
    `Write nothing into this file for the ${what} part — not code, not a comment, ` +
      `not a marker. Quote lines back in chat instead.`,
  );

  lines.push(
    `Three kinds of help, in order, starting at the first however long the ` +
      `session has been running:\n` +
      `  1. Plain English — what this code has to accomplish, and where it goes.\n` +
      `  2. The docs — the reference page for the API involved, plus questions.\n` +
      `  3. A walkthrough — last resort, ordered steps, no syntax.\n` +
      `You move on only when there is new code on disk. Not when they ask again, ` +
      `not when they say they are stuck. Look at the file to see where you are ` +
      `rather than trying to remember.`,
  );

  if (config.unlockRoute === false) {
    lines.push(
      `**Nothing hands ${what} over to you on this assignment.** The three kinds ` +
        `of help are not a staging area, they are the whole model for the duration. ` +
        `Do not imply otherwise and do not hint at a way to earn it. When their code ` +
        `works, you may *offer* the questions as their own check — what a line does, ` +
        `why that API, what breaks if X — once, framed as theirs, judging nothing and ` +
        `recording nothing. If they decline, drop it and do not return to it.`,
    );
  } else {
    const routes = blocked
      .map((c) => `  ${c}: ${routesTo(config, c).join(", ") || "no task opens this"}`)
      .join("\n");
    lines.push(
      `Say plainly that there is a way through — a refusal without one reads as a ` +
        `broken tool. They write one of these themselves, commit it with ` +
        `\`git commit --signoff\`, and talk it through with you:\n${routes}\n` +
        `Recording it is yours, not theirs: \`node .claude/hooks/signoff.mjs <TASK>\`, ` +
        `which refuses unless the work is committed and signed off — say that will ` +
        `happen before you run it, and do not hand them the command. After that you may ` +
        `write ${what} code with them everywhere, features beyond the core included. ` +
        `Reviewing a teammate's PR counts too; the script caps it against written ones.`,
    );
    lines.push(
      `Four questions at most: one open — "briefly, what does this commit do?" — ` +
        `then up to three multiple-choice drawn from their own diff, covering what ` +
        `each line does, why that API rather than another, and what breaks if a piece ` +
        `changes. Nothing scored, no tally. A thin answer earns one more question, ` +
        `never a verdict.`,
    );
  }

  // The open set does not shrink because the gated set is closed, and on a
  // no-unlock assignment it does not shrink either. Say what is available, so a
  // block does not read as the agent having been switched off.
  if (config.unlockRoute === false) {
    lines.push(
      `Everything that is not this assignment's learning goal is still yours to ` +
        `help with — README.md says what. This refusal is not you being switched off.`,
    );
  } else {
    lines.push(
      open.size
        ? `This student has already signed off: ${[...open].join(", ")} — write those ` +
            `freely. Everything this assignment does not hold back is yours from day ` +
            `one, for everyone — README.md says what.`
        : `This student has signed nothing off yet. Everything this assignment does ` +
            `not hold back is still yours from day one — README.md says what — so ` +
            `there is plenty you can still do.`,
    );
  }

  return lines.join("\n\n");
}
