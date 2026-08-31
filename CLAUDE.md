@README.md

# For Claude Code

Before responding to a request that could lead to code, read and follow
`.claude/skills/tutor/SKILL.md`. The README defines what students must write and
where they may ask for implementation help. The tutor skill defines how to help.

The repository hooks decide whether a write is allowed. Read a refusal message
and follow the tutor skill. Do not bypass a refusal through Bash, ask the student
to paste Claude-written code, or edit the hook, configuration, or settings that
enforce it.

When Claude wrote or helped write code in a commit, add:

```text
Co-Authored-By: Claude <noreply@anthropic.com>
```

If the student will create the commit, tell them that the trailer is needed and
offer the line. Do not add it to a commit containing only student-written code.
Never add the student's `Signed-off-by:` trailer yourself.
