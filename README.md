# Metro monorepo

This repository contains Metro and the small packages that belong close to Metro.

Metro's core is intentionally small: it is a Fetch-compatible HTTP client with middleware support, plus request, response and URL helpers. The beginner-friendly `@muze-nl/metro` package combines the separate packages and exposes the global `metro` object for browser use.

## Packages

| Package | Directory | Purpose |
| --- | --- | --- |
| `@muze-nl/metro-core` | `packages/metro-core` | Small core: `client`, `Client`, `request`, `response`, `url`, and `metroError`. |
| `@muze-nl/metro` | `packages/metro` | Combined beginner-friendly package that re-exports the core, API helpers, middleware, tracing, hash params, and formdata helper. Also sets `globalThis.metro` in browser bundles. |
| `@muze-nl/metro-api` | `packages/metro-api` | API and JSON API helper classes/functions. |
| `@muze-nl/metro-middleware` | `packages/metro-middleware` | Optional generic middleware: JSON, thrower, getdata, retry, timeout, abort, backoff, and test mocks. |
| `@muze-nl/metro-trace` | `packages/metro-trace` | Optional global/scoped tracing helpers and console trace graph. |
| `@muze-nl/metro-hashparams` | `packages/metro-hashparams` | Helpers for query parameters stored in the URL hash fragment. |
| `@muze-nl/metro-formdata` | `packages/metro-formdata` | Optional `formdata()` helper. |
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

Run the Metro combined package tests only:

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

Mock OAuth2/OIDC servers are test helpers. Import them from the explicit testing entries so they do not inflate production browser bundles:

```js
import oauth2mockserver from '@muze-nl/metro-oauth2/testing'
import oidcmockserver from '@muze-nl/metro-oidc/testing'
```

## Design direction

The package boundaries are deliberate:

- `@muze-nl/metro-core` should stay small and only contain the fetch-compatible client and core helpers.
- Generic middleware should live in `@muze-nl/metro-middleware`.
- Debugging and tracing should live in `@muze-nl/metro-trace`.
- Beginner convenience should live in the combined `@muze-nl/metro` package.
- Auth, Linked Data, and provider-specific behavior should remain separate packages or examples.
- Provider-specific packages should be introduced only when recipes show enough repetition to justify them.
