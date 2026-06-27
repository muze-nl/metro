# Metro

Metro is a Fetch-compatible HTTP client with middleware. It keeps the browser's `Request`, `Response`, `URL`, and `FormData` model, then adds a small set of conveniences: reusable clients, immutable `.with()` helpers, middleware composition, API helpers, tracing, and optional packages for OAuth2, OpenID Connect, and Linked Data.

## Install

Most applications should start with the combined package:

```sh
npm install @muze-nl/metro
```

```js
import metro from '@muze-nl/metro'

const client = metro.client('https://jsonplaceholder.typicode.com/')
  .with(metro.mw.json())

const response = await client.get('/posts/1')
console.log(response.data.title)
```

For a browser page without a bundler, use the browser bundle. It creates `globalThis.metro`:

```html
<script src="https://cdn.jsdelivr.net/npm/@muze-nl/metro@0.7.1/dist/browser.min.js"></script>
<script>
  const client = metro.client('https://jsonplaceholder.typicode.com/')
    .with(metro.mw.json())

  client.get('/posts/1').then(response => {
    console.log(response.data.title)
  })
</script>
```

Advanced applications can install only the packages they need:

```sh
npm install @muze-nl/metro-core @muze-nl/metro-middleware
```

```js
import { client } from '@muze-nl/metro-core'
import { json, retry, timeout } from '@muze-nl/metro-middleware'

const api = client('https://jsonplaceholder.typicode.com/')
  .with(timeout(5000), retry({ attempts: 3 }), json())
```

## Documentation

General documentation that applies across packages lives in [`docs/`](docs/):

- [`docs/quickstart.md`](docs/quickstart.md) — install Metro and make the first request.
- [`docs/tutorial.md`](docs/tutorial.md) — longer guided tutorial.
- [`docs/packages.md`](docs/packages.md) — package map and import choices.
- [`docs/debugging.md`](docs/debugging.md) — tracing and diagnostics across Metro clients.
- [`docs/details/`](docs/details/) — error and diagnostic detail pages used by Metro error messages.

Package-specific installation, usage, and reference documentation lives beside each package:

| Package | Documentation | Purpose |
| --- | --- | --- |
| `@muze-nl/metro` | [`packages/metro/docs/`](packages/metro/docs/) | Beginner-friendly combined package and browser global. |
| `@muze-nl/metro-core` | [`packages/metro-core/docs/`](packages/metro-core/docs/) | `client`, `Client`, `request`, `response`, `url`, `metroError`. |
| `@muze-nl/metro-api` | [`packages/metro-api/docs/`](packages/metro-api/docs/) | `api()`, `jsonApi()`, `API`, and `JsonAPI`. |
| `@muze-nl/metro-middleware` | [`packages/metro-middleware/docs/`](packages/metro-middleware/docs/) | Generic middleware such as JSON, retry, timeout, abort, backoff, and test mocks. |
| `@muze-nl/metro-trace` | [`packages/metro-trace/docs/`](packages/metro-trace/docs/) | Scoped and global tracing helpers plus console graph output. |
| `@muze-nl/metro-hashparams` | [`packages/metro-hashparams/docs/`](packages/metro-hashparams/docs/) | Query parameters stored in the URL hash fragment. |
| `@muze-nl/metro-formdata` | [`packages/metro-formdata/docs/`](packages/metro-formdata/docs/) | Small `formdata()` helper. |
| `@muze-nl/metro-oauth2` | [`packages/metro-oauth2/docs/`](packages/metro-oauth2/docs/) | OAuth2 middleware, PKCE, token storage, popup flow, and DPoP support. |
| `@muze-nl/metro-oidc` | [`packages/metro-oidc/docs/`](packages/metro-oidc/docs/) | OpenID Connect middleware built on Metro OAuth2. |
| `@muze-nl/metro-oldm` | [`packages/metro-oldm/docs/`](packages/metro-oldm/docs/) | Linked Data middleware using OLDM. |

## Working in this repository

```sh
npm install
npm test
npm run build
```

Useful focused commands:

```sh
npm run test:core
npm run test:oauth2
```

Mock OAuth2/OIDC servers are test helpers. Import them from explicit testing entries so they do not inflate production browser bundles:

```js
import oauth2mockserver from '@muze-nl/metro-oauth2/testing'
import oidcmockserver from '@muze-nl/metro-oidc/testing'
```

## Package boundary rule

`@muze-nl/metro-core` should stay small. Generic middleware belongs in `@muze-nl/metro-middleware`, tracing belongs in `@muze-nl/metro-trace`, beginner convenience belongs in `@muze-nl/metro`, and auth or Linked Data behaviour belongs in its own package.
