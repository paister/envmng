[![npm version](https://img.shields.io/npm/v/envmng?logo=npm&logoColor=red)](https://www.npmjs.com/package/envmng)
[![NPM Downloads](https://img.shields.io/npm/dw/envmng?logo=npm&logoColor=red&label=npm%20downloads)](https://www.npmjs.com/package/envmng)
[![CI](https://github.com/paister/envmng/actions/workflows/ci.yml/badge.svg)](https://github.com/paister/envmng/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/envmng.svg)](LICENSE)

<h1 align="center">🗂️ envmng</h1>
<p align="center">
  <strong>Define environment variables once. Generate the <code>.env</code> files each app needs.</strong>
  <br/>
  Central profiles, per-app templates, and checks for missing values before you generate.
</p>

<p align="center">
  <a href="./docs/getting-started.md"><strong>Documentation</strong></a> ·
  <a href="#quick-start"><strong>Quick Start</strong></a> ·
  <a href="https://github.com/paister/envmng/issues"><strong>Report Bug</strong></a>
</p>

## Install

Requires **Node.js ≥22.12**.

```bash
npm install --save-dev envmng
```

Or use `pnpm add -D envmng`. See [installation and setup](./docs/getting-started.md) for global and local builds.

## Quick start

At the target repository root, create a `.env.example` with safe samples. Add `.env.example` in each app directory, using placeholders such as `DATABASE_URL={{DATABASE_URL}}`.

```bash
# Copy examples to .envmng.local files without generating runtime output.
npx envmng create local

# Fill in real values in the root .envmng.local, then:
npx envmng check local && npx envmng set local
```

Apps load the generated `.env` files with their usual framework or runtime loader. Edit profiles, not generated files; run `set` again after changes.

```text
.
├── .env.example                    # DATABASE_URL=
├── .envmng.local                   # DATABASE_URL=postgres://…  (create)
└── apps/
    ├── api/
    │   ├── .env.example            # DATABASE_URL={{DATABASE_URL}}
    │   ├── .envmng.local           # DATABASE_URL={{DATABASE_URL}}  (create)
    │   └── .env                    # DATABASE_URL=postgres://…  (set)
    └── web/
        ├── .env.example            # DATABASE_URL={{DATABASE_URL}}
        ├── .envmng.local           # DATABASE_URL={{DATABASE_URL}}  (create)
        └── .env                    # DATABASE_URL=postgres://…  (set)
```

## Commands

| Command                        | Purpose                                                 |
| ------------------------------ | ------------------------------------------------------- |
| `init [name]`                  | Create, check, and activate a profile; default: `local` |
| `create <name>`                | Create missing profile files from examples              |
| `check [name]`                 | Validate one or all profiles and source declarations    |
| `set <name>`                   | Generate `.env` files from a profile                    |
| `add [name]` / `remove <name>` | Manage central values                                   |
| `format`                       | Sort assignments within comment groups                  |
| `delete <name>`                | Delete profile files                                    |

Run `npx envmng --help` or see the [CLI reference](./docs/cli.md) for options.

## Safety

envmng writes plaintext files; it is not a secret store. Keep central profiles and generated `.env` files out of Git. `set` does not validate first—run `check` before generating.

`add` stores values in the selected root profile and declares new root example keys as `KEY=`; it never activates a profile. Run `check <name> && set <name>` explicitly. Prefer editing private profiles for secrets: command-line values may appear in shell history or process listings. See the [safe variable workflow](./docs/workflows.md#add-a-variable-safely).

## Documentation

- [Installation and setup](./docs/getting-started.md)
- [File layout and templates](./docs/concepts.md)
- [Everyday workflows](./docs/workflows.md)
- [CLI reference](./docs/cli.md)
- [Validation and troubleshooting](./docs/check.md)
- [Library API](./docs/library.md)
- [Development](./docs/development.md)

## License

[MIT](./LICENSE) © 2026 Marvin Pöperny.
