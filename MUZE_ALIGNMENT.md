# Metro monorepo alignment

This monorepo is intended to make Metro more mature without turning the core into a large SDK.

## Current package boundaries

- `@muze-nl/metro` remains the small core HTTP client.
- `@muze-nl/metro-oauth2` remains separate because OAuth2 is authorization middleware, not core HTTP behavior.
- `@muze-nl/metro-oidc` remains separate because OIDC adds identity concepts on top of OAuth2.
- `@muze-nl/metro-oldm` remains separate because Linked Data parsing/serialization is a domain concern.

## Alignment notes

### Good alignment

- The packages are composable and independently usable.
- Metro's middleware model keeps HTTP visible instead of hiding APIs behind large SDK abstractions.
- Related packages now evolve together, which should make coordinated API cleanup easier.

### Gaps to improve

1. Add real-world examples for common APIs before adding provider-specific packages.
2. Add missing tests for OIDC and OLDM middleware.
3. Review whether OAuth2, OIDC, and OLDM should stay under `@muze-nl` or move temporarily to `@muze-labs` while the APIs mature.
4. Consider extracting repeated OAuth2/OIDC helpers only when the duplication is concrete.
5. Add a consistent package-level documentation structure for tutorials, reference, and examples.
6. Make linting consistent across packages; the uploaded OAuth2 code currently has ESLint issues that should be fixed deliberately rather than hidden.

## Near-term roadmap

1. Stabilize the root workspace and package scripts.
2. Add smoke tests for `metro-oidc` and `metro-oldm`.
3. Add real-world examples:
   - GitHub: token auth, headers, pagination.
   - Dropbox: OAuth2 PKCE, list folder, upload/download.
   - Solid: protected resource and lazy login.
4. Decide namespace maturity for each package.
5. Archive the old standalone repositories after the monorepo is published and documented.
