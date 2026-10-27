# File layout and templates

[Documentation](./index.md) · [Setup](./getting-started.md) · [Workflows](./workflows.md)

A **profile** is a named configuration such as `local` or `staging`. A **consumer** is a non-root directory with `.env.example` that needs its own generated `.env`.

## Three kinds of files

| File           | At the root                    | In a consumer                                 |
| -------------- | ------------------------------ | --------------------------------------------- |
| `.env.example` | Central keys with safe samples | Variables the app needs, usually placeholders |
| `.<name>.env`  | Real values for the profile    | Profile-specific template                     |
| `.env`         | Generated copy of root values  | Generated app configuration                   |

```text
repository/
├── .env.example          # DATABASE_URL=
├── .local.env            # DATABASE_URL=postgres://localhost/app
├── .env                  # Generated root values
├── .envmng               # ENV=local: last generated profile
└── apps/api/
    ├── .env.example      # DATABASE_URL={{DATABASE_URL}}
    ├── .local.env        # DATABASE_URL={{DATABASE_URL}}
    └── .env              # DATABASE_URL=postgres://localhost/app
```

`create local` copies examples into missing `.local.env` files. `set local` generates `.env` from those profile files. Later changes to examples do not automatically update existing profiles; edit them or review repairs from [`check --fix`](./check.md#apply-repairs-with---fix).

Apps load **only generated `.env`**, not the named profiles. `.envmng` records the last generated profile; editing it does not regenerate files or select a file for the library loader.

## Placeholders

Consumer templates accept `{{KEY}}` and `{{ KEY }}`. Names start with a letter or underscore and contain letters, digits, or underscores.

- Values come from the selected **root profile**, not examples or other consumers.
- Substitution inserts raw text, including stored quotes. It is not shell expansion or expression evaluation.
- Consumers can rename variables: `DB_URL={{DATABASE_URL}}`.
- Missing keys become empty strings during `set`. Run `check` first to catch them.
- Root profiles contain concrete values; their contents are copied, not rendered.

Prefer simple `KEY=value` assignments. See the [parser limits](./library.md#parseenvfiletext) before relying on advanced dotenv syntax.

## Names and discovery

Profile names match `^[a-z][a-z0-9_-]*$`; `example` is reserved. Use `.local.env`, not `.env.local`. Only the exact name `prod` triggers the production confirmation in `set`.

The CLI searches upward from the working directory for `pnpm-workspace.yaml` or `turbo.json`. Without a marker, it uses the working directory.

Below that root, any directory with `.env.example` becomes a consumer. Discovery stops there: nested consumers are not discovered independently. Hidden, dependency, build, and cache directories are skipped. Consumers need no `package.json` and can live outside `apps/`.

## Git and secrets

| File                             | Commit?                                  |
| -------------------------------- | ---------------------------------------- |
| Root and consumer `.env.example` | Yes, safe samples only                   |
| Root `.<name>.env`               | **No**: may contain secrets              |
| Consumer `.<name>.env`           | Only if secret-free; prefer placeholders |
| Any generated `.env`             | **No**                                   |
| Root `.envmng`                   | **No**                                   |

`init` and `create` add managed ignore rules to an **existing** root `.gitignore`. They do not create it or untrack committed files. Consumer profiles are not automatically ignored. Review changes before committing; rotate any credential that was exposed.

Generated files are plaintext. Restrict access, avoid retaining them as CI artifacts, and never deliver server secrets to browser bundles. envmng does not encrypt, fetch, or validate credentials.
