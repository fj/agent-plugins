# agent-plugins

Harness-agnostic sources for my agent plugins. Releases go to [jxf-agent-plugins-index](https://github.com/fj/jxf-agent-plugins-index).

## Commands

```sh
pnpm test                                   # test the tools
pnpm run release -- <claude|pi> <plugin>    # release one plugin
pnpm run release:all -- <claude|pi>         # release all plugins
pnpm run deploy:local                       # install local builds
pnpm run install:released                   # install released builds
```

Add `--dry-run` to a release to build without publishing.

## Requirements

- Node 22.18 or newer.
- A clean checkout to release. All builds use `HEAD`.
- A plugin is a top-level directory with `agent-plugin.json` (`name`, `description`, `version` as `x.y`, `harnesses`, and optionally `build` and `test`).
- No harness-specific files at the top level of a plugin.
- Refer to other commands as `{{command:a:b}}`, not `/plugin:a:b`.
