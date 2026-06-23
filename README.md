# Metro monorepo

This repository contains Metro and the small middleware packages that belong close to Metro.

Metro's core should stay small and focused: it is an HTTP client with middleware support, compatible with the browser Fetch API. Real-world API support should generally live in separate packages and examples, not inside the core package.

## Packages

| Package | Directory | Purpose |
| --- | --- | --- |
| `@muze-nl/metro` | `packages/metro` | Core HTTP client, middleware contract, request/response helpers, JSON API helpers. |
| `@muze-nl/metro-oauth2` | `packages/metro-oauth2` | OAuth2 middleware, token storage, PKCE/popup helpers, DPoP support. |
| `@muze-nl/metro-oidc` | `packages/metro-oidc` | OpenID Connect middleware built on Metro and Metro OAuth2. |
| `@muze-nl/metro-oldm` | `packages/metro-oldm` | Linked Data / OLDM middleware for Metro clients. |

## Working in the monorepo

Install dependencies from the repository root:

```bash
npm install
```

Run tests for all packages that have tests:

```bash
npm test
```

Run the Metro core tests only:

```bash
npm run test:core
```

Run the OAuth2 tests only:

```bash
npm run test:oauth2
```

Build all packages:

```bash
npm run build
```

## Design direction

The package boundaries are deliberate:

- Metro core should not know about OAuth2, OIDC, OLDM, GitHub, Dropbox, or Solid.
- Auth, Linked Data, and provider-specific behavior should remain separate packages or examples.
- Shared code can move into small internal packages later, but only after repeated patterns appear.
- Provider-specific packages should be introduced only when recipes show enough repetition to justify them.

A good next step is to add real-world examples under `examples/`, starting with GitHub token auth and Dropbox OAuth2 PKCE, before creating provider-specific packages.
