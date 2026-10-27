# Development

[Documentation](./index.md)

In the envmng checkout:

```bash
pnpm install
pnpm run build
pnpm run typecheck
pnpm run test
pnpm run test:cli
pnpm run test:package
```

`build` generates the CLI, library, and declarations in `dist/`. `test:cli` tests the compiled CLI against temporary repositories. `test:package` packs and installs the actual tarball into an isolated npm project, checking its binary and library exports; it needs access to the npm registry.

`pnpm run validate` combines type checking, unit tests, and CLI smoke tests. GitHub CI runs validation and the package installation test on Node.js 22.12 and 24.

## Package

```bash
pnpm pack
```

The `prepack` hook builds automatically. The tarball contains compiled output, the README, and documentation. Runtime dependencies are installed by the consuming package manager.

See [Publishing](./publishing.md) for release metadata, verification, and the first npm release. Publishing is manual; CI does not receive npm credentials or publish packages.

## Code map

| Location                                                              | Responsibility                                                  |
| --------------------------------------------------------------------- | --------------------------------------------------------------- |
| `src/envmng.ts`, `src/cli.ts`                                         | CLI entry, working-directory root discovery, commands and flags |
| `src/commands/`                                                       | File operations and command orchestration                       |
| `src/check-analysis.ts`, `src/audit-analysis.ts`, `src/scan-usage.ts` | Profile and source analysis                                     |
| `src/parse.ts`, `src/render.ts`, `src/format.ts`                      | Parsing, substitution, and formatting                           |
| `src/load-env.ts`, `src/index.ts`                                     | Runtime loader and public API                                   |
| `tests/cli.test.mjs`                                                  | Built CLI smoke tests                                           |

Update the relevant docs when changing behavior. Use fake values in tests and examples, never real credentials.
