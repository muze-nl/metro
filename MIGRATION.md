# Migration notes for moving to the Metro monorepo

## Repository migration

1. Create or reuse `github.com/muze-nl/metro` as the monorepo.
2. Move the standalone repositories into package directories:
   - `metro` -> `packages/metro`
   - `metro-oauth2` -> `packages/metro-oauth2`
   - `metro-oidc` -> `packages/metro-oidc`
   - `metro-oldm` -> `packages/metro-oldm`
3. Preserve Git history if desired with `git subtree add` or a history-rewrite tool.
4. Update CI to run from the root workspace.
5. Archive the old standalone repositories only after the monorepo is published and README links point to the new locations.

## npm migration

This first monorepo pass keeps the package names unchanged:

- `@muze-nl/metro`
- `@muze-nl/metro-oauth2`
- `@muze-nl/metro-oidc`
- `@muze-nl/metro-oldm`

If OAuth2/OIDC/OLDM should move to `@muze-labs`, do that as a separate migration so users get a clear deprecation path.

For each old npm package name that moves, publish a final patch release that prints or documents the new package name, then deprecate the old package:

```bash
npm deprecate @old-scope/package "This package moved to @new-scope/package. Please update your dependency."
```

## Package dependency policy

Avoid `workspace:*` in published package dependencies unless the publish workflow rewrites them. This pass keeps normal semver ranges so individual packages remain installable outside the monorepo.
