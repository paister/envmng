# Installation and setup

[Documentation](./index.md) · [File layout](./concepts.md) · [CLI reference](./cli.md)

Requires **Node.js ≥22.12**.

## Install

Install at the target repository root:

```bash
npm install --save-dev envmng
npx envmng --help
```

With pnpm: `pnpm add -D envmng`, then `pnpm exec envmng --help`. The remaining docs use `pnpm exec envmng`; `npx envmng` is the npm equivalent after installation.

- **Global CLI:** `npm install -g envmng`, then use `envmng` directly. A project-local dependency is recommended for a consistent team version.
- **Library at runtime:** install without `--save-dev` / `-D` in the package that imports it. See the [library API](./library.md).

### Local development and unreleased builds

In the envmng checkout, run `pnpm install && pnpm pack`. The `prepack` hook builds the CLI and library. Install the resulting `envmng-0.1.0.tgz` at the target repository root:

```bash
npm install --save-dev /path/to/envmng-0.1.0.tgz
```

For active development, run `pnpm run build` in the checkout, then `pnpm add -D /path/to/envmng` in the target repository. Rebuild and refresh the dependency after changes.

## Set up the target repository

Run commands from its root. envmng searches upward from the working directory for `pnpm-workspace.yaml` or `turbo.json`; without either marker, it uses the working directory itself.

### 1. Declare variables

Create a root `.env.example` with safe samples:

```dotenv
DATABASE_URL=
PORT=3000
```

Create `apps/api/.env.example` with the variables that app needs:

```dotenv
DATABASE_URL={{DATABASE_URL}}
PORT={{PORT}}
```

Any non-root directory with `.env.example` is a **consumer**; it need not live under `apps/`.

Create a root `.gitignore` if it does not exist. envmng adds ignore rules during profile creation only when that file already exists.

### 2. Create a profile

```bash
pnpm exec envmng create local
```

This copies examples to `.local.env` files and preserves existing profiles. Fill in real values in the **root** `.local.env`; keep placeholders in consumer profiles. Do not commit central profiles or real credentials.

### 3. Check and generate

```bash
pnpm exec envmng check local && pnpm exec envmng set local
```

Use `check local --strict` if warnings, including referenced empty values, should block generation. Apps then load their generated `.env` through their framework or the [library loader](./library.md#loadgeneratedenv).

After editing profiles, repeat this step and restart affected processes. `set` overwrites generated files; it does not update running processes.

**Shortcut for an already configured checkout:** `pnpm exec envmng init` runs create → check → set for `local`. Use `--no-set` to stop before generation or `--strict` to block it on warnings.

Next: [everyday workflows](./workflows.md) or [file layout and Git rules](./concepts.md).
