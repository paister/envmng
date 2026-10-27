# CLI reference

[Documentation home](./index.md) · [Getting started](./getting-started.md) · [Concepts](./concepts.md) · [Workflows](./workflows.md)

Run commands from the repository root:

```bash
pnpm exec envmng <command> --help
```

Every command supports `--help` / `-h`. The CLI uses the nearest ancestor containing `pnpm-workspace.yaml` or `turbo.json`, falling back to the current directory—not the installation directory.

## Files and scope

Root `.<name>.env` holds central values; each non-root directory owning `.env.example` is a **consumer**, with `.<name>.env` templates. Discovery skips hidden, dependency, build, and cache directories and stops at each consumer. See [Concepts](./concepts.md) for the file model.

Profile names match `[a-z][a-z0-9_-]*`; `example` is reserved. Only the exact name `prod` triggers production confirmation.

## init

```bash
pnpm exec envmng init [name=local]
```

Runs `create` → `check` (including source scanning) → `set`. Requires root `.env.example`. Validation errors stop activation; scaffolding is not rolled back. Empty referenced values are warnings unless strict mode is enabled. Does not provision secrets, start Docker, or run migrations.

| Flag              | Effect                                                                             |
| ----------------- | ---------------------------------------------------------------------------------- |
| `--force`         | Replace complete existing profile files during creation, including private values. |
| `--no-set`        | Scaffold and check without activation.                                             |
| `--strict`        | Stop on warnings too.                                                              |
| `--yes`, `-y`     | Bypass `prod` confirmation, not validation.                                        |
| `--verbose`, `-v` | Expand check and unresolved-placeholder output.                                    |

## create

```bash
pnpm exec envmng create <name>
```

Copies root and consumer `.env.example` files to `.<name>.env`, skipping existing targets. Requires the root example; does not activate the profile. Adds envmng ignore rules to root `.gitignore` **only if that file exists**; otherwise add rules yourself before storing secrets.

| Flag      | Effect                                                                                                 |
| --------- | ------------------------------------------------------------------------------------------------------ |
| `--force` | Overwrite complete profile files, including secrets and template customizations, without confirmation. |

## set

```bash
pnpm exec envmng set <name>
```

Writes the central profile body to root `.env`, renders existing consumer templates into their `.env`, and records `ENV=<name>` in root `.envmng`. Generated files are overwritten. Missing consumer templates are skipped, leaving previous output untouched.

**Does not run validation.** Missing placeholder keys become empty strings with warnings; writes still proceed. Run [check](#check) first. Applying `prod` can connect local apps to live infrastructure.

| Flag              | Effect                                                                    |
| ----------------- | ------------------------------------------------------------------------- |
| `--yes`, `-y`     | Skip confirmation for `prod`; required for it without an interactive TTY. |
| `--verbose`, `-v` | List missing placeholder names per consumer instead of counts.            |

## add

```bash
pnpm exec envmng add [name] --key KEY --value VALUE
```

Upserts the selected root profile assignment (creating the file if needed and removing duplicate assignments for that key). If root `.env.example` exists and lacks the key, it always receives `KEY=` with an empty value; existing example values stay unchanged. A missing root example is skipped, not created. Consumer templates are not updated.

The supplied value goes only into the selected root profile unless `--sync-profiles` is explicitly requested. `add` never runs `set` or activates a profile; generated `.env` files and `.envmng` stay unchanged. Activate explicitly with `pnpm exec envmng check <name> && pnpm exec envmng set <name>`; `set prod` asks for confirmation as usual.

Prefer editing private profiles for secrets. Command-line values may appear in shell history or process listings.

| Flag              | Effect                                                                                                                                                                         |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `--key KEY`       | Assignment key.                                                                                                                                                                |
| `--value VALUE`   | Assignment value; `--value ''` sets an empty value.                                                                                                                            |
| `--sync-profiles` | Opt in to copying the same value into other existing root profiles missing the key, potentially including production. Existing values stay unchanged; no profile is activated. |

Missing name, key, or value is prompted interactively; supply all three without a TTY. Values use dotenv-compatible quoting; already-quoted input is preserved. Unquoted values that cannot round-trip on one assignment line are rejected (for example, literal `\n` combined with an actual newline).

## remove

```bash
pnpm exec envmng remove <name> --key KEY
```

Removes the required `--key KEY` from the root profile only. A missing profile fails; an absent key is a no-op. Examples, consumer templates, other profiles, and generated files remain unchanged. Does not run `set`; resolve remaining references before rendering again.

## check

```bash
pnpm exec envmng check [name]
```

Checks one profile or all profiles found at root and in consumers. Source comparison runs once across all consumers, independently of the selected profile. Read-only unless repairs are requested; never activates a profile.

| Flag              | Effect                                                                                                                                               |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--strict`        | Fail on warnings as well as errors.                                                                                                                  |
| `--verbose`, `-v` | Expand collapsed lists, empty-value references, and missing-declaration hints.                                                                       |
| `--no-source`     | Skip source/example comparison and source-driven repairs.                                                                                            |
| `--ignore KEY`    | Exclude a key from source/example comparison and its repairs only; repeatable. Does not suppress profile findings.                                   |
| `--include-tests` | Include test directories and test/spec files in source scanning.                                                                                     |
| `--fix`           | Apply one catalogue/drift repair pass, then re-analyze changed files. Can overwrite assignments in other consumer profiles, even with a named check. |

Exits `1` for errors, no discovered profiles, or strict-mode warnings; otherwise `0`. Repairs use the post-fix report, so writes do not imply success. See [Troubleshooting](./check.md) for codes, repair scope, and scan limits.

## format / fmt

```bash
pnpm exec envmng format
```

`fmt` is an alias; there are no command-specific flags. Sorts keys alphabetically (case-sensitive) in root and consumer `.env`, `.env.example`, and profile files, rewriting only changed files. Does not activate a profile.

Standalone comments and unrecognized lines delimit groups. Blank lines stay in place, but assignments can sort across them. Values, spacing, quotes, inline comments, placeholders, multiline quoted values, line endings, and duplicate-key order are preserved. An unclosed quote without a later closing quote stays unchanged. Generated `.env` files are included; format profiles/templates to retain ordering after rendering.

## delete

```bash
pnpm exec envmng delete <name>
```

Lists and permanently deletes matching root and consumer profile files after confirmation by typing the exact name. Fails if none exist. Clears matching active-profile metadata, removing `.envmng` if only comments/blank lines remain.

| Flag          | Effect                                        |
| ------------- | --------------------------------------------- |
| `--yes`, `-y` | Bypass confirmation, including without a TTY. |

Examples and generated `.env` files remain. **Deleted active profiles can still be in use through generated output**; explicitly activate another profile.
