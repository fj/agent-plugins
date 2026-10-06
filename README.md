# agent-plugins

Harness-agnostic sources for my coding-agent plugins. A build step turns each plugin into a native package for a harness: Claude Code (`claude`) or Pi (`pi`).

Released builds go to write-only repos, one per plugin and harness, collected as submodules in [jxf-agent-plugins-index](https://github.com/fj/jxf-agent-plugins-index).

## Plugin layout

Each top-level directory with an `agent-plugin.json` is a plugin. The top level of a plugin holds no harness-specific files. Harness-specific code lives below it, for example in `src/adapters/<harness>/`.

`agent-plugin.json`:

```json
{
  "name": "jxf",
  "description": "Personal coding workflow.",
  "version": "0.1",
  "author": { "name": "John Feminella" },
  "harnesses": ["claude", "pi"],
  "build": "node scripts/build.ts",
  "test": "node --test 'test/**/*.spec.ts'"
}
```

- `version` is `major.minor`. A release appends the patch `t`, the UTC `yyyymmddhhmmss` committer time of the newest commit that touches the plugin directory.
- `harnesses` lists the harnesses the plugin supports.
- `build` is optional. The tools run it in the plugin directory as `<build> --harness <harness> --out <absolute dir> --version <x.y.t>`. It must write a complete native package to `--out`. Without `build`, the generic builder below is used.
- `test` is optional. A release runs it in the plugin directory first.

### Generic builder

The generic builder reads `commands/**/*.md`. Each file is a prompt with `description` (and optionally `argument-hint`) frontmatter and uses `$ARGUMENTS` for arguments.

To refer to another command of the same plugin, write `{{command:<path>}}`, where `<path>` is the file path below `commands/` without `.md`, joined by `:`. For example, `{{command:coding:pr:make}}` refers to `commands/coding/pr/make.md`. An unknown reference fails the build.

| | Claude Code | Pi |
|---|---|---|
| Manifest | `.claude-plugin/plugin.json` | `package.json` with `keywords: ["pi-package"]` and `pi.prompts` |
| Command file | `commands/coding/pr/make.md` | `prompts/jxf-coding-pr-make.md` |
| `{{command:coding:pr:make}}` | `/jxf:coding:pr:make` | `/jxf-coding-pr-make` |

## Native package requirements

- `claude`: `.claude-plugin/plugin.json` at the root, with `name` and `version`.
- `pi`: `package.json` at the root, with `name`, `version`, `keywords` containing `pi-package` and a `pi` field.

## Release repos

- GitHub repo `fj/jxf-agent-plugins-<plugin>-<harness>`, a submodule at `<plugin>-<harness>` in the index.
- Each release replaces the whole tree, commits it on `main` and tags it `v<x.y.t>`.
