# Muze alignment: metro-core

`@muze-nl/metro-core` is the smallest Metro runtime package. It intentionally contains only:

- `client()` and `Client`
- `request()`
- `response()`
- `url()`
- `metroError()`

It may keep tiny internal utilities needed to implement those functions, but higher-level helpers should stay outside the core.

## Alignment goal

Metro core should remain a small, Fetch-compatible foundation. Middleware, API helpers, tracing, OAuth/OIDC behavior, Linked Data behavior, and browser-global convenience should live in separate packages and be re-exported by the combined `@muze-nl/metro` package when helpful for beginners.

## Current risks

- The core still has internal tracing hooks so optional tracing can observe middleware safely. These hooks should remain low-level and should not grow into a public tracing framework inside core.
- `url()` still supports the existing `hashParams` convenience for compatibility. If that grows beyond a tiny compatibility feature, it should move fully into `@muze-nl/metro-hashparams`.
