# Profile validation and troubleshooting

[Documentation home](./index.md) · [Getting started](./getting-started.md) · [CLI reference](./cli.md#check) · [Workflows](./workflows.md)

`check` compares profiles with examples and static consumer source references with declarations. It is read-only unless repairs are requested and never activates a profile. For flags and exit status, see the [CLI reference](./cli.md#check).

## Choose the scope

```bash
pnpm exec envmng check local
pnpm exec envmng check
```

A named check validates that profile; an unnamed check discovers profiles from root and consumer `.<name>.env` files. Examples alone do not create profiles. With none found, the unnamed check fails before scanning sources: create a profile first.

Source comparison runs once across all consumers. Its findings merge into a single-profile report or appear in a trailing `source` node for multiple profiles. Consumer discovery follows the [CLI scope](./cli.md#files-and-scope).

## Troubleshoot findings

Errors always fail; warnings fail only in strict mode.

| Code                     | Level   | Resolution                                                                                                                                                                                 |
| ------------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `missing_central`        | Error   | Restore root `.env.example` if needed, run `pnpm exec envmng create <name>`, then fill private values.                                                                                     |
| `missing_app_template`   | Error   | Run `pnpm exec envmng create <name>` to copy missing templates without replacing existing files.                                                                                           |
| `unresolved_placeholder` | Error   | Add the referenced key to the central profile, or correct/remove the consumer placeholder.                                                                                                 |
| `used_missing`           | Error   | Source uses a key absent from the consumer example. Confirm the runtime contract, declare `KEY={{KEY}}` in the example and profile templates (or use repairs), then supply central values. |
| `empty_value`            | Warning | A central value referenced by a consumer placeholder is blank, `""`, or `''`. Fill it or confirm the empty value is intentional.                                                           |
| `drift_central_key`      | Warning | Add the missing root example key to the central profile with an appropriate value. Repairs copy the sample.                                                                                |
| `drift_app_key`          | Warning | Add the missing consumer example assignment to its profile template. Repairs copy the example value.                                                                                       |
| `missing_root_example`   | Warning | Restore a root catalogue with empty/safe samples. Central drift cannot be checked; creation requires this file.                                                                            |
| `declared_unused`        | Warning | Check dynamic access, shared packages, and external configuration before removing a declaration; detection is not proof that a key is unused.                                              |

Drift compares key presence, not values, and ignores extra profile keys. Empty-value warnings cover referenced central keys only—not every central value or literal consumer assignment. See the [CLI reference](./cli.md#check) for expanded diagnostic output and source-only exclusions.

## Apply repairs with `--fix`

| Finding             | Repair                                                                                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `used_missing`      | Upsert `KEY={{KEY}}` in the consumer example and **all its existing profile templates**. Add `KEY=` to the root example if it exists and lacks the key. |
| `drift_app_key`     | Copy a missing assignment from the consumer example into the affected existing profile template.                                                        |
| `drift_central_key` | Copy a missing assignment from the root example into the affected existing central profile.                                                             |

**A named check is not a write boundary:** source-driven repairs affect every existing profile in that consumer and can overwrite literal/custom assignments for the key. Review examples and private profile diffs.

Repairs do not:

- Create missing profile files or a missing root example; use `create` after restoring the root example.
- Generate secrets, fill existing empty values, remove unused keys, render `.env`, or activate a profile.
- Repeat until clean. One pass runs, then changed files are re-analyzed; new drift may require another pass.

Copied samples may not be usable values. A repair can leave missing central values or strict-mode warnings, so inspect the resulting report and edit private profiles before activation. Source-scan exclusions also constrain source-driven repairs; see [CLI flags](./cli.md#check).

Supply real values by editing private profiles or using [`add`](./cli.md#add), which leaves new example values empty and does not activate a profile. Prefer an editor for secrets to avoid command-line exposure. After checking, activate explicitly with `set <name>`.

## Understand source-scan limits

The scanner recursively reads `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`, `.mts`, and `.cts` files under each consumer. It detects `process.env.KEY`, `process.env["KEY"]`, and the equivalent `import.meta.env` forms. `MODE`, `DEV`, `PROD`, `SSR`, and `BASE_URL` are ignored for both APIs.

Tests are excluded by default: `tests/`, `test/`, `__tests__/`, `e2e/`, `spec/`, `__mocks__/`, and test/spec JS/TS filenames. Dependency/build exclusions remain even when tests are included.

This is a text/regex scan, not runtime or dependency analysis:

- Dynamic keys, destructuring, and aliases are not detected.
- Matching comments or strings can produce findings.
- Imported shared packages outside the consumer are not followed.

## What a passing check does not guarantee

`check` does not inspect generated `.env`, validate credential formats or validity, contact services, or start applications. It does not require every central value to be non-empty.

If an app still reads old values, run `pnpm exec envmng set <name>` after reviewing the profile, then restart/reload it. `set` does not validate: unresolved placeholders become empty strings with warnings.
