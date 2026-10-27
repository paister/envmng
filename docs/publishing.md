# Publishing

[Documentation](./index.md) · [Development](./development.md)

The package targets the public npm registry. Nothing publishes automatically; `prepublishOnly` runs release checks before a normal `npm publish` from this checkout.

## Before the first release

1. **Choose a license.** Add its SPDX identifier to `package.json` as `license`, and add the complete license text in `LICENSE` with correct copyright attribution. A public GitHub repository alone does not grant an open-source license. Review any third-party code and license obligations.
2. **Create the public GitHub repository.** Add its real metadata to `package.json`:
   - `repository`: an object with `type: "git"` and the repository's `git+https://` URL.
   - `homepage`: the repository's HTTPS README URL.
   - `bugs.url`: its HTTPS issues URL.
3. **Confirm the npm name.** Run `npm view envmng name version --registry=https://registry.npmjs.org/`. A 404 means no public package was found, not that npm guarantees the name is available. If needed, choose a scoped name and update installation examples and tests.
4. **Review the release.** Inspect source, Git history, and package contents for secrets; ignore rules do not remove tracked files or historical leaks. Verify that security regression tests cover empty example declarations and no implicit activation by `add`.
5. **Push and check CI.** Both supported CI versions must pass. Review the proposed `0.1.0` version; npm versions cannot be reused once published.

`pnpm run release:check` deliberately fails until license and repository metadata are present. It checks their presence and URL structure, not legal correctness, repository accessibility, or npm ownership.

## Verify and publish

Use the pinned pnpm version from `packageManager` for development, and a current npm CLI for publishing.

```bash
pnpm install --frozen-lockfile
pnpm run release:check
npm pack --dry-run
npm login --registry=https://registry.npmjs.org/
npm whoami --registry=https://registry.npmjs.org/
npm publish --dry-run
npm publish
```

- `release:check` validates metadata, types, unit tests, CLI smoke tests, and real tarball installation. The install test needs network access and uses a temporary npm cache.
- `prepack` builds compiled output. `prepublishOnly` repeats release checks for checkout publication. Do not bypass hooks with `--ignore-scripts`; publishing an already-built tarball does not offer the same checkout hook protection.
- Review the dry-run file list. Only `dist/`, `docs/`, and automatically included package metadata, README, and license files belong in the package. Source maps include source text; review that too.
- `publishConfig` explicitly selects the public npm registry and public access. Consumer installation has no build/install hooks and does not require pnpm.
- Enable npm account 2FA and follow npm's authentication prompts. Never commit registry credentials or tokens. Dry runs do not reserve a name or prove that the final publication will be authorized.

After publishing, verify `npm view envmng version` and install the released version in a fresh project. Create a matching Git tag and GitHub release for the published version.

## Later releases

Update the version and document notable changes before repeating verification and publication. Use prerelease versions and an explicit non-`latest` dist-tag for previews. Keep versioning appropriate to the CLI, library API, generated file format, and safety-related behavior.

Once the GitHub repository and npm package exist, prefer npm **trusted publishing with provenance** for automated releases over long-lived npm tokens. Configure the exact trusted repository/workflow in npm before adding a publish workflow; a trusted GitHub Actions job needs `id-token: write` and a supported npm/Node.js version. The validation workflow intentionally has read-only permissions and does not publish.
