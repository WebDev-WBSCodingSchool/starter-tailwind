#!/usr/bin/env node
//
// PreToolUse hook: the static floor plus the student's earned categories.
//
// ---------------------------------------------------------------------------
// The exit-code contract, which is a trap worth restating in full:
//
//   exit 0, nothing on stdout    -> no opinion. The write proceeds.
//   exit 0 + JSON on stdout      -> a decision. This is how we deny.
//   ANY non-zero exit            -> a NON-BLOCKING error. The write PROCEEDS.
//
// So an uncaught exception in this file does not fail safe, it fails open. Never
// throw out of here; catch and deny instead. Everything below the stdin parse is
// wrapped for exactly that reason.
// ---------------------------------------------------------------------------
//
// What it decides: whether the payload being written matches a gated content
// category that this student has not yet demonstrated. Not which file it is
// (per repo-split-expression, globs don't fit FR007) and not which task it is
// (the FR landmarks are comments with no mechanical authority, and the tickets
// are student-authored, so intent is not observable — only content is).

import {
  relPath,
  loadConfig,
  readProgress,
  demonstrated,
  lockedAs,
  planFile,
  onboardingBlock,
  branchState,
} from "./harness.mjs";
import { denyReason } from "./reason.mjs";

// --- Detectors -------------------------------------------------------------
//
// Deliberately conservative, and imperfect on purpose: this is a floor, not a
// fence. Over-reaching costs more than under-reaching, because a false positive
// blocks the agent in territory it was promised (markup, styling, plumbing,
// stretch features) and that is the failure that gets the harness deleted.
//
// Note what is NOT in `dom`: addEventListener, classList, showModal. Those are
// event wiring and styling, which happen throughout open territory. The category
// is DOM *construction and mutation* — the thing FR011 and FR013 are actually
// about.

const DETECTORS = {
  fetch: [
    /\bfetch\s*\(/,
    /\bXMLHttpRequest\b/,
    /\baxios\b/,
  ],
  dom: [
    /\bdocument\s*\.\s*(querySelector(All)?|getElementById|getElementsBy\w+|createElement|createTextNode|createDocumentFragment)\s*\(/,
    /\.\s*(innerHTML|outerHTML|textContent|innerText)\s*=/,
    /\.\s*insertAdjacentHTML\s*\(/,
    /\.\s*(append|appendChild|prepend|replaceChildren|insertBefore)\s*\(/,
    /\.\s*setAttribute\s*\(/,
  ],
  localStorage: [
    /\blocalStorage\b/,
    /\bsessionStorage\b/,
    /\.\s*(setItem|getItem|removeItem)\s*\(/,
  ],
  // React. Note what is NOT here: `className`, imports, props, JSX attributes.
  // Those are styling and plumbing, open territory throughout. What each of
  // these three matches is the topic itself — producing elements, holding
  // state, reaching outside render.
  reactRendering: [
    // Every pattern anchors `<` immediately after the operator, so comparisons
    // survive: `return a < b`, `(a, b) => b.date - a.date`, `i < n`, `a && b < c`
    // are all untouched. A sort comparator and a validation helper stay writable.
    /\breturn\s*\(?\s*</,
    /=>\s*\(?\s*</,
    /(&&|\?)\s*</,
  ],
  reactState: [
    /\buseState\s*\(/,
    /\buseReducer\s*\(/,
  ],
  reactEffects: [
    /\buseEffect\s*\(/,
    /\buseLayoutEffect\s*\(/,
    // The lazy initializer that loads from storage inside useState, which would
    // otherwise satisfy "load on startup" without an effect ever being written.
    // Bounded scan, so it only fires when the storage call is inside the
    // initializer rather than somewhere further down the file.
    /useState\s*\(\s*(\(\s*\)\s*=>|function\s*\(\s*\))[\s\S]{0,200}?(localStorage|sessionStorage|getItem)/,
  ],
  // TypeScript in a React app: the annotations, not the code they sit in. The
  // agent writes the components, the state wiring and the plumbing untyped —
  // every type in them is the student's. Note what is NOT here: JSX itself,
  // `className`, props destructured without an annotation, and `import type`,
  // which names a type the student already wrote rather than writing one.
  typedReact: [
    // A declared shape: `type ArtworkProps = {`, `interface Note {`. The
    // capitalised name is what keeps `import type { Artwork } from "./x"` out —
    // there, `type` is followed by a brace rather than by a name.
    /\b(type|interface)\s+[A-Z]\w*\s*[=<{]/,
    // A type argument on a hook call: `useState<Artwork[]>(`, `useRef<HTMLElement>(`.
    // Both the closing `>` and the `(` are required, so `useCount < max` cannot fire.
    /\buse[A-Z]\w*\s*<[^<>()\n]{1,80}>\s*\(/,
    // The annotation on a destructured parameter — a component's props type.
    /\}\s*:\s*[A-Z][\w.]*(\[\]|<[^>\n]*>)?\s*\)/,
    // The annotation on a plain parameter: `(artwork: Artwork)`. An object
    // literal cannot match here: it opens with `{`, not with an identifier.
    /\(\s*\w+\s*:\s*[A-Z][\w.]*(<[^>\n]*>)?(\[\])?\s*[,)=]/,
    // A return type, which has to be followed by the body it belongs to.
    /\)\s*:\s*(Promise\s*<[^\n]*>|[A-Z][\w.]*(<[^>\n]*>)?(\[\])?)\s*(\{|=>)/,
    // The same three shapes again for the primitives, which the capitalised
    // patterns above cannot see. `(q: string)` is a typed parameter and nothing
    // else — JavaScript has no construct of that shape, so the narrowness that
    // protects the patterns above is not needed here.
    /\(\s*\w+\s*:\s*(string|number|boolean|bigint|symbol|void|unknown|any|null|undefined)\b/,
    /\)\s*:\s*(string|number|boolean|bigint|symbol|void|unknown|any)\s*(\{|=>)/,
    // An inline object type on a destructured parameter: `({ query }: { query: string })`.
    /\}\s*:\s*\{/,
    // React's own type names, wherever they are annotated.
    /:\s*(React\.)?(FC|FunctionComponent|ReactNode|ReactElement|PropsWithChildren|ChangeEvent|FormEvent|MouseEvent|KeyboardEvent|Dispatch|SetStateAction|RefObject)\b/,
    /:\s*JSX\.Element\b/,
    // A schema becoming a type — the bridge between the two gated topics.
    /\bz\s*\.\s*infer\s*</,
  ],
  // Runtime validation: building a schema and running data through it. Note what
  // is NOT here: `import { z } from "zod"`, which is plumbing, and `z.infer`,
  // which produces a type and so belongs to typedReact.
  runtimeValidation: [
    /\bz\s*\.\s*(object|string|number|boolean|array|union|discriminatedUnion|literal|enum|nativeEnum|coerce|nullable|nullish|optional|record|tuple|date|any|unknown|never|instanceof)\b/,
    // `.parse` and `.safeParse`. The lookbehind is what keeps `JSON.parse` out:
    // reading localStorage is open plumbing throughout a project like this, and
    // it is the one collision that would block it. The lookbehind spans the
    // whitespace too, so a chain broken over two lines by a formatter is still
    // recognised as JSON.parse rather than as a schema.
    /(?<!JSON\s{0,20})\.\s*(parse|safeParse|parseAsync|safeParseAsync)\s*\(/,
    /\bZodError\b/,
  ],
  // The two categories of a first HTML/CSS project, where the deliverable is
  // the taught material end to end. They are the widest detectors here, and
  // they are still floors: on an assignment that gates these, the agent's open
  // territory is git, the repo around the site, and talking — not other code in
  // the same files. So the cost of a miss is small and the cost of a false
  // positive is mostly borne outside the two extensions that matter.
  //
  // The tag list is explicit rather than `[a-z][\w-]*`, which would fire on
  // every `a <b` in a script file. Note what is NOT in it: `b` and `i`, whose
  // one-letter names are exactly the comparison collision, and which a module
  // teaching semantic markup has no reason to hand out anyway.
  semanticHtml: [
    /<!doctype\s+html/i,
    /<\/?(html|head|body|header|nav|main|section|article|aside|footer|h[1-6]|p|div|span|a|ul|ol|li|dl|dt|dd|img|picture|source|figure|figcaption|video|audio|iframe|canvas|svg|form|input|label|button|select|option|textarea|fieldset|legend|table|thead|tbody|tfoot|tr|th|td|caption|strong|em|small|mark|time|address|blockquote|pre|code|br|hr|details|summary|dialog|title|meta|link|style|script)\b[^<>]*>/i,
  ],
  css: [
    // A declaration. The unquoted value and the semicolon are what keep object
    // literals out: `{ color: "red" }` and `{ width: 100, height: 50 }` are
    // JS, and a student writing either is not writing this module's CSS.
    /\b(display|position|top|right|bottom|left|inset|float|clear|flex|flex-direction|flex-wrap|flex-basis|justify-content|justify-items|align-items|align-content|align-self|order|gap|row-gap|column-gap|grid|grid-template|grid-template-columns|grid-template-rows|grid-template-areas|grid-area|grid-column|grid-row|width|height|min-width|max-width|min-height|max-height|margin|margin-top|margin-right|margin-bottom|margin-left|padding|padding-top|padding-right|padding-bottom|padding-left|box-sizing|overflow|color|background|background-color|background-image|background-size|background-position|background-repeat|border|border-radius|border-top|border-right|border-bottom|border-left|box-shadow|text-shadow|opacity|font|font-family|font-size|font-weight|font-style|line-height|letter-spacing|word-spacing|text-align|text-transform|text-decoration|vertical-align|white-space|list-style|object-fit|aspect-ratio|cursor|transition|transform|animation|z-index|visibility|filter|backdrop-filter)\s*:\s*[^;{}"'`]+;/i,
    // A custom property. Not in the list above because the list is names, and
    // this one is whatever the student called it — but `:` then a value then
    // `;` is the same shape, and a block of nothing but these is a real
    // stylesheet the property list would have waved through.
    /--[\w-]+\s*:\s*[^;{}"'`]+;/,
    // A rule opening a block: `.card {`, `#hero {`, `:root {`. The excluded `(`
    // is what keeps `.map(x => {` and every other chained callback out.
    /(^|[\n};])\s*([.#][\w-]|:root\b)[^{}\n(]*\{/,
    /@(media|import|font-face|keyframes|supports)\b/i,
  ],
  // Utility-class styling, for a module taught as Tailwind rather than as CSS.
  // Both patterns require a literal `class=` / `className=` attribute, which is
  // what keeps them off everything else in a script file: `classList.add("hidden")`
  // has no `=` after `class`, and `const classes = "flex"` has no `=` after
  // `class` either.
  //
  // Precision matters less here than it looks. Inside markup, `semanticHtml` has
  // already caught the tag the attribute sits in, so a collision with a
  // hand-written class name — `class="container"`, `class="hidden"` — costs
  // nothing that was not already gated. These patterns are only load-bearing in
  // the extensions `semanticHtml` does not reach, and there they cannot fire
  // without an attribute assignment.
  //
  // Note what is NOT here: the class attribute on its own. A student naming a
  // section `class="hero"` is writing markup, not utilities, and an agent
  // reading the file back to them must be able to quote it.
  tailwindStyling: [
    // A variant prefix inside a class attribute — `md:`, `hover:`, `dark:`,
    // `2xl:`. `prefix:utility` is the one shape that cannot occur in a
    // hand-written class name, because a class name cannot contain a colon.
    // The `[^"']` scan cannot cross the closing quote, so it never runs on into
    // a neighbouring `style="color: red"`.
    /\bclass(Name)?\s*=\s*["'][^"']{0,400}?\b(sm|md|lg|xl|2xl|hover|focus|focus-within|focus-visible|active|disabled|checked|dark|first|last|odd|even|group-hover|peer-focus|motion-safe|motion-reduce|print)\s*:\s*[-a-z0-9[\]/.]/i,
    // A core layout, spacing or type utility as a whole token in the same place.
    // The list is the utilities this module actually teaches, not all of
    // Tailwind: a floor, and one a student cannot cross by accident.
    /\bclass(Name)?\s*=\s*["'][^"']{0,400}?\b(flex|inline-flex|grid|inline-grid|block|inline-block|hidden|absolute|relative|fixed|sticky|mx-auto|items-\w+|justify-\w+|self-\w+|gap-[\d.]|space-[xy]-[\d.]|grid-cols-\d|col-span-\d|row-span-\d|[mp][xytrbl]?-[\d.]|w-[\w./]|h-[\w./]|max-w-\w|min-w-\w|max-h-\w|min-h-\w|text-\w+|font-\w+|leading-\w+|tracking-\w+|bg-\w+|border-\w|rounded[\w-]*|shadow[\w-]*|opacity-\d|z-\d|overflow-\w+|object-\w+|transition[\w-]*|duration-\d|ease-\w+|cursor-\w+)\b/i,
  ],
};

function categoriesIn(text, gated) {
  const hits = [];
  for (const name of gated) {
    const patterns = DETECTORS[name];
    // A gated category with no detector is a config/script mismatch. Treat it as
    // a hit: better to over-block and be told than to silently gate nothing.
    if (!patterns) {
      hits.push(name);
      continue;
    }
    if (patterns.some((re) => re.test(text))) hits.push(name);
  }
  return hits;
}

// --- Payload ---------------------------------------------------------------

/** Every field a file-writing tool can carry new text in. */
function payloadOf(toolInput) {
  return [toolInput?.content, toolInput?.new_string, toolInput?.new_source]
    .filter((v) => typeof v === "string")
    .join("\n");
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

// The other way out: no opinion, the write proceeds. If the work is sitting
// somewhere it cannot be reviewed, say so on the way past — this never denies,
// because a branch problem is not a reason to refuse text a student is in the
// middle of writing. Silent on a clean branch: an allowed write must put
// NOTHING on stdout (see the exit-code contract at the top of this file), not
// an empty JSON envelope, which Claude Code would treat as a decision rather
// than as no opinion.
function allow(config) {
  // The outer catch fails closed on purpose (a fault denies). This call is
  // deliberately exempt from that: branchState() is built never to throw, but
  // this hook must not take that on faith. A nicety — a branch warning — must
  // never be the reason a student can't get text into a file, so any fault
  // here is swallowed and the write proceeds exactly as if there were nothing
  // to say.
  try {
    const bs = branchState(config);
    if (bs.problems.length) {
      process.stdout.write(
        JSON.stringify({
          hookSpecificOutput: { hookEventName: "PreToolUse" },
          systemMessage: bs.problems.map((p) => p.text).join(" "),
        }),
      );
    }
  } catch {
    /* see comment above: a branch warning must never turn into a denial */
  }
  process.exit(0);
}

// --- Main ------------------------------------------------------------------

const chunks = [];
for await (const c of process.stdin) chunks.push(c);

let event;
try {
  event = JSON.parse(Buffer.concat(chunks).toString("utf8"));
} catch {
  // The envelope is built by Claude Code, not by the agent, so a malformed one
  // means the tool payload format changed — not that someone is routing around
  // us. Denying here would brick every write for every student in the cohort at
  // once, which is a far worse failure than one missed check. Stay out of the way.
  process.exit(0);
}

try {
  const filePath = event?.tool_input?.file_path ?? event?.tool_input?.notebook_path;
  if (!filePath) process.exit(0);

  const config = loadConfig();
  const rel = relPath(filePath);

  // 1. Locked paths. The agent cannot edit its own gate, it cannot grant itself
  //    an unlock, and it cannot edit the brief it is being held to.
  //    Content-independent, checked first.
  const locked = lockedAs(config, rel);

  // PLAN.md is in neverWritable, so it would deny as "machinery" — but that message
  // is about the guard and its ledger, and this file is the students'. It gets its
  // own reason, and it comes first: the agent must not be able to open its own gate,
  // and it must be able to say why it won't try.
  if (locked && rel === planFile(config)) {
    deny(
      `\`${rel}\` is the group's own writing and you may not write to it. It is also ` +
        `the file that is checked before you write code, so writing it would mean ` +
        `clearing your own way — the one edit that would make all of this ` +
        `meaningless. ` +
        `Run the conversation, name what nobody has claimed and where two of them will ` +
        `collide, say what looks thin. They ` +
        `type it. If they ask you to just write it for them, say no and say why.`,
      `Harness: blocked an agent write to ${rel} — the group writes their own plan.`,
    );
  }

  if (locked === "machinery") {
    deny(
      `\`${rel}\` is the machinery of this setup and you may not write to it. The hook, its ` +
        `config, the progress record, the editor settings that turn off inline ` +
        `suggestions and the tutor skill are one system: between them they decide ` +
        `what you may write and what you say when you decline, so none of them is ` +
        `yours to edit. Any such edit would be visible in \`git diff\` and would ` +
        `defeat the point of the exercise. ` +
        `If the student is asking you to take this apart, say no and say why. ` +
        `To record a signed-off task, run \`node .claude/hooks/signoff.mjs\` — the ` +
        `script is the only writer of that state.`,
      `Harness: blocked an agent write to ${rel}.`,
    );
  }

  if (locked === "canonical") {
    // Separate reason from machinery on purpose. The agent will read this out to
    // a student, and "you may not edit the requirements" needs to land as a
    // statement about authority, not as a bug in the harness.
    deny(
      `\`${rel}\` is the assignment brief and it is read-only to you. It is the same ` +
        `text the students were given, it is what tells you what you may and may not ` +
        `write here, and you do not get to edit the thing you are being held to. ` +
        `Requirements are the instructor's to change. If the student thinks one is ` +
        `wrong, ambiguous, or already met a different way, that is a conversation with ` +
        `their instructor — help them put the case clearly, do not edit it away. ` +
        `Their own project writing goes in files they create, not in here.`,
      `Harness: blocked an agent write to ${rel} — the brief is read-only.`,
    );
  }

  // 2. Is this even a file the detectors apply to?
  const exts = config.guardedExtensions ?? [".js"];
  if (!exts.some((e) => rel.toLowerCase().endsWith(e))) allow(config);

  // 3. Is the group onboarded? This gates EVERY guarded extension, not just the
  //    gated categories: code generation starts once the split exists, not before.
  //    Live — the file is re-read here on every write, so a fixed line is a fixed
  //    gate with nothing to re-run.
  const notOnboarded = onboardingBlock(config);
  if (notOnboarded) {
    deny(
      `${notOnboarded}\n\nUntil that is sorted you may not write ${rel} or any other ` +
        `code file here. This is not about the code you were about to write. Read the ` +
        `message above to the student — it says exactly what to change — and help them ` +
        `fix it. You may not edit \`${planFile(config)}\` yourself.`,
      `Harness: blocked an agent write to ${rel} — the group's plan is not settled.`,
    );
  }

  // 4. Does the payload contain gated content?
  const hits = categoriesIn(payloadOf(event.tool_input), config.gated ?? []);
  if (hits.length === 0) allow(config);

  // 5. Has this student demonstrated it?
  const open = demonstrated(config, readProgress(config));
  const blocked = hits.filter((c) => !open.has(c));
  if (blocked.length === 0) allow(config);

  deny(
    denyReason({ config, rel, blocked, open }),
    `Harness: blocked an agent write to ${rel} — ${blocked.join(", ")}. ` +
      `That part is yours to type.`,
  );
} catch (err) {
  // Fail closed. Config missing, progress file corrupt, git unavailable: we do
  // not know whether this write is allowed, so it is not allowed. The reason is
  // written for a human because a student will read it through the agent.
  deny(
    `The harness guard could not determine whether this write is permitted, so it ` +
      `denied it. This is a fault in the harness, not a judgement about the code. ` +
      `Tell the student what happened, show them this, and suggest they mention it ` +
      `to their instructor: ${err?.message ?? err}`,
    `Harness: guard error, write denied (failing closed). ${err?.message ?? err}`,
  );
}
