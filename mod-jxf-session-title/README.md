# mod-jxf-session-title

A Claude Code and [pi](https://pi.dev) plugin that names a session from its first prompt. It asks a small model for a 3–6 word title and shows the title at the bottom left of the band above the prompt.

While it waits, the band shows:

```
⠸ asking claude-bridge/claude-haiku-5-5 to summarize prompt for session title [2.3s]
```

Run `/session-title` to name the session again from all of its prompts.

## Where the title goes

| Harness | Session name | Sidecar file |
|---|---|---|
| pi | `pi.setSessionName()`, shown in the session picker | `<session>.session-title.json` beside the session file |
| Claude Code | `sessionTitle` from the next prompt's hook, or on resume | `<session>.session-title.json` beside the transcript |

The sidecar does not end in `.jsonl`, because both harnesses read every `.jsonl` file in a session folder as a session.

## Options

| Option | Default | Meaning |
|---|---|---|
| `model` | pi: `claude-haiku-5-5`; Claude Code: `haiku` | The title model. A bare id uses the provider of the session. `provider/id` picks one in pi; in Claude Code the provider must be the one the session uses. |
| `autoTitle` | `true` | Name a session from its first prompt. |
| `maxPromptChars` | `2000` | How much prompt text the title model reads. |
| `maxTitleChars` | `60` | The longest title. |
| `maxReplyTokens` | `64` | The most tokens the title model may write. |
| `timeoutMs` | `30000` | How long to wait for the title model. |
| `instructions` | a 3–6 word title prompt | The title model's system prompt. The prompts reach the model inside `<request>` tags. |

pi reads them from `~/.pi/agent/mod-jxf-session-title.json`. Claude Code reads them from the plugin's options in `/config`.

## Limits

- If you leave a session while its title is being made, the title goes to that session's sidecar only. The session takes it as its name when you go back to it.
- Claude Code takes a new title only from a hook, so its own session name changes at the next prompt. The band shows the title at once.
- On resume, Claude Code keeps a name it already has, such as one set with `/rename`.
- If `mod-jxf-fancy-details` draws its footer above the prompt, the two share the band: the title on the left, the footer rows on the right.
