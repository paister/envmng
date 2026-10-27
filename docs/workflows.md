# Everyday workflows

[Documentation](./index.md) · [Setup](./getting-started.md) · [CLI reference](./cli.md)

Run these commands from the target repository root. Examples use `local`; substitute your profile name.

## Change an existing value

Edit the root `.local.env`, then validate and regenerate:

```bash
pnpm exec envmng check local && pnpm exec envmng set local
```

Restart affected processes. Do not edit generated `.env` files: the next `set` replaces them.

For non-sensitive values, `pnpm exec envmng add local --key PORT --value 3001` updates the selected root profile without activation. Then run `check local && set local` with the CLI as shown above.

## Add a variable safely

Suppose `apps/api` needs `PAYMENT_API_KEY`:

1. Add `PAYMENT_API_KEY=` to root `.env.example`.
2. Add `PAYMENT_API_KEY={{PAYMENT_API_KEY}}` to `apps/api/.env.example` and its relevant profile templates, such as `.local.env`.
3. Add the real value to the ignored root `.local.env` using your editor. Supply values separately for other environments.
4. Run `check local && set local` with the CLI as shown above.

For existing files, `pnpm exec envmng check local --fix` can copy missing example assignments into profiles. [Review its write scope](./check.md#apply-repairs-with---fix) before using it; it may change other consumer profiles too.

Alternatively, `add local` stores the supplied value in the selected root profile and adds a missing key to an existing root `.env.example` as `KEY=` with an empty value. Existing example values stay unchanged; a missing root example is skipped. Only explicit `--sync-profiles` copies the same value to other existing root profiles missing the key; existing values are preserved. Consumer templates are not updated.

`add` never runs `set` or activates a profile, including `prod`; `.env` files and `.envmng` stay unchanged. Activate explicitly with `check <name> && set <name>` using the CLI; `set prod` asks for confirmation as usual.

**Prefer editing private profiles for secrets.** Values passed with `--value` may appear in shell history or process listings.

## Add a consumer

1. Create a `.env.example` in the new app's directory, for example `apps/worker/.env.example` with `DATABASE_URL={{DATABASE_URL}}`.
2. Ensure root `.env.example` declares `DATABASE_URL` with a safe sample.
3. Run `pnpm exec envmng create local` to create missing profile files. Existing ones are preserved; do not use `--force` for this.
4. Fill any missing root values, then validate and generate.
5. Configure the app to load its `.env` using its framework or the [library loader](./library.md#loadgeneratedenv).

Repeat for other profiles as needed. Do not nest the new consumer inside an existing one; discovery stops at the first `.env.example`.

## Create or switch profiles

```bash
pnpm exec envmng create staging
# Fill root .staging.env and review consumer templates.
pnpm exec envmng check staging && pnpm exec envmng set staging
```

`create` copies samples, not another profile's credentials. For an existing profile, only check and set are needed.

`set prod` asks for confirmation; `--yes` bypasses it. Other names, including `production`, do not trigger that protection. Switching writes local files—it does not deploy or restart anything.

## Remove a variable or profile

To retire a variable, remove its code usage, consumer declarations, and consumer profile assignments. Remove the root example entry only when no consumer needs it. Remove its value from each relevant root profile:

```bash
pnpm exec envmng remove local --key OLD_KEY
```

Then check and regenerate. Removing a stored credential does not revoke it at the provider.

To delete an entire profile:

```bash
pnpm exec envmng delete staging
```

Confirm by typing its name. This deletes root and consumer profile files, but **leaves generated `.env` files intact**. Activate another profile or remove obsolete output yourself.

## Validate in CI

For source/declaration checks without real credentials, use a disposable checkout with safe examples:

```bash
pnpm exec envmng create ci
pnpm exec envmng check ci
```

This permits warnings for empty samples. It checks declarations, not deployable credentials.

For a deployment profile, provision the root values and consumer templates through your CI secret process, then:

```bash
pnpm exec envmng check prod --strict && pnpm exec envmng set prod --yes
```

Strict mode rejects all warnings, including unused declarations. Review [source-scan limits](./check.md) before enforcing it. Never use `--fix` as a substitute for provisioning secrets or upload generated env files as artifacts.

## Before committing

Run `pnpm exec envmng check` for available profiles and optionally `pnpm exec envmng format`. Review staged files for secrets and tell teammates which new values they must supply through a secure channel.
