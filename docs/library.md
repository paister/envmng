# Library API

[Documentation home](./index.md) · [Getting started](./getting-started.md) · [Concepts](./concepts.md) · [CLI reference](./cli.md)

Import the public API from `envmng` for Node.js environment loading or repository tooling. Do not bundle filesystem-based helpers into browser code or import internal CLI modules that mutate files.

## Installation and runtime requirements

Requires Node.js ≥22.12. Install with `npm install envmng` or `pnpm add envmng` after the first npm release; [local builds](./getting-started.md#local-development-and-unreleased-builds) work before publication. If application startup imports `envmng`, declare it as a **runtime dependency** in the consuming package. Exports provide ESM JavaScript and TypeScript declarations from `dist`; no CommonJS build is provided.

## Load environment variables

### `loadGeneratedEnv`

Generate `.env` first with `pnpm exec envmng set <name>`, then load it before reading configuration. Frameworks that already load `.env` usually need no extra loader.

```ts
import { loadGeneratedEnv } from "envmng";

const { root, envPath } = loadGeneratedEnv({ dir: import.meta.dirname });
```

Signature: `loadGeneratedEnv(options?: LoadGeneratedEnvOptions): { root: string; envPath: string }`. The exported options type is `{ dir?: string }`.

- `dir` owns the `.env` file; defaults to `process.cwd()` and resolves to an absolute path. Use `import.meta.dirname` only if the script lives in that directory.
- `root` is the discovered repository root; `envPath` is the absolute path to `<dir>/.env`.
- Loads **only that file** with dotenv. Does not merge root/consumer files, read named profiles or `.envmng`, generate output, or validate settings.
- Existing `process.env` values win. Reloading does not reliably switch a running process to another profile.
- **Dotenv errors are not inspected or returned.** A missing/unreadable file is not surfaced as a thrown error by this wrapper; returned paths do not prove loading succeeded. Validate required application settings separately.

Static ES module imports execute before the module body. If dependencies read env during initialization, load in a bootstrap module and then dynamically import the application, or use a supported preload mechanism.

## Inspect repository metadata

| Export                                        | Contract                                                                                                                                                                       |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `findMonorepoRoot(startDir: string): string`  | Walk upward to the nearest `pnpm-workspace.yaml` or `turbo.json`. Without either marker, return the resolved starting directory. Checks filenames, not configuration contents. |
| `readActiveEnv(root: string): string \| null` | Read trimmed `ENV` from root `.envmng`; return `null` for a missing file/value. Does not verify profiles or generated output.                                                  |
| `ENVMNG_CONFIG_FILE`                          | `".envmng"`                                                                                                                                                                    |
| `ENVMNG_CONFIG_ENV_KEY`                       | `"ENV"`                                                                                                                                                                        |

`set` records active-profile metadata; `delete` clears a matching profile. Loaders do not use it to select files.

## Parse and render environment files

These helpers work on strings/maps without filesystem access or application validation.

### `parseEnvFile(text)`

Returns `Map<string, string>`; the first duplicate assignment wins. Ignores blank lines and full-line comments, trims each line, and splits at the first `=`.

**Not a full dotenv parser:** quotes and inline comments remain raw; variables are not expanded; multiline values and `export` prefixes are not interpreted. Prefer simple central assignments; use a runtime dotenv loader for arbitrary dotenv syntax.

### `serializeEnvKeys(values, keys, header)`

Returns a header followed by assignments in the requested key order, skipping absent keys. Takes `Map<string, string>`, `readonly string[]`, and `string`; returns `string`. Emits raw values without adding quoting or escaping.

### `renderTemplate(template, values)`

Takes a string and `Map<string, string>`. Replaces `{{KEY}}` / `{{ KEY }}` with raw map values and returns `{ text: string; missing: string[] }`. Missing keys become empty strings; `missing` is sorted and unique.

```ts
import { parseEnvFile, renderTemplate } from "envmng";

const values = parseEnvFile("PORT=3000\n");
const result = renderTemplate("PORT={{PORT}}\nTOKEN={{TOKEN}}\n", values);
// { text: "PORT=3000\nTOKEN=\n", missing: ["TOKEN"] }
```

`collectPlaceholders` is internal, not a public export.

## Migrate from the deprecated loader

### `loadMonorepoEnv({ appDir? })`

Replace `loadMonorepoEnv({ appDir })` with `loadGeneratedEnv({ dir: appDir })` and read `envPath` instead of `appEnvPath`. Both load one file only.

The old `appEnvPath` is `null` when loading root `.env`; the new `envPath` is always a string. If needed, resolve `.env` relative to returned `root` instead of using old `rootEnvPath`—that path does not imply the root file was loaded.
