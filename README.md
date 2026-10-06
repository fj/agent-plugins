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

## Commands

Run these from the repo root with Node 22.18 or newer. No install step is needed. With pnpm, put `--` before the arguments, for example `pnpm run release -- claude jxf --dry-run`.

| Command | What it does |
|---|---|
| `pnpm test` | Runs the tests of the tools. |
| `pnpm run release <harness> <plugin> [--dry-run]` | Releases one plugin for one harness. |
| `pnpm run release:all <harness> [--dry-run]` | Releases every plugin that supports the harness. One failure does not stop the others. It prints a summary and exits with an error if any release failed. |
| `pnpm run deploy:local [harness...]` | Builds every plugin and installs the builds in the local harnesses. The default is `claude` and `pi`. |
| `pnpm run install:released [harness...]` | Installs the released versions from the index in place of local builds. The default is `claude` and `pi`. |

All commands read plugins and build them from the committed `HEAD`, not from the working tree.

A release:

1. Needs a clean checkout. It runs the plugin `test` in the plugin directory of this checkout.
2. Builds the plugin. `--dry-run` stops here and reports the version.
3. Uses the index checkout at `../jxf-agent-plugins-index`, or at `$JXF_AGENT_PLUGINS_INDEX`. It clones the index if it is missing. The index must be clean and on `main`; the release pulls it first.
4. Creates the release repo and its submodule if they do not exist yet. `gh` runs with the token of the repo owner (`gh auth token --user fj`).
5. Skips the release if the tag `v<version>` exists. Otherwise it commits the build on `main`, tags it and pushes both.
6. Updates `releases.json`, `.claude-plugin/marketplace.json` and `README.md` in the index, commits and pushes.

`deploy:local` writes builds to `${XDG_DATA_HOME:-~/.local/share}/jxf-agent-plugins/<harness>/<plugin>`. Claude Code loads them from the `jxf-local` marketplace in that directory; run `/reload-plugins` after a deploy. Pi loads them from their paths. `install:released` reverses this: Claude Code uses the `jxf` marketplace from the index, and Pi installs `git:github.com/fj/jxf-agent-plugins-<plugin>-pi@v<version>`.
