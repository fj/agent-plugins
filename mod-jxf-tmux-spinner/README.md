# mod-jxf-tmux-spinner

A Claude Code and [pi](https://pi.dev) plugin that marks the tmux window of an agent with its state:

| Mark | State |
|---|---|
| `◐ ◓ ◑ ◒` | The agent is busy. |
| `?` (yellow) | The agent waits for you: a permission prompt, a question, or a reply that ends with `?`. |
| `✓` (green) | The agent is done. |

The plugin only sets the `@agent_state` window option. tmux draws the mark with `tmux/tmux-spinner` once a second. When you go to the window, tmux removes the `?` or `✓` mark.

## Set up tmux

Add this line to your tmux config:

```tmux
source-file /path/to/agent-plugins/mod-jxf-tmux-spinner/tmux/tmux-spinner.conf
```

This sets `status-interval` to 1 and replaces `window-status-format` and `window-status-current-format`. To keep your own formats, set them after the `source-file` line and put `#{E:@agent_badge}` where you want the mark.

## Limits

- The `?` mark for a reply is a guess from its last character.
- If the agent stops without a clean exit, the busy mark stays until the next agent session starts in that window.
