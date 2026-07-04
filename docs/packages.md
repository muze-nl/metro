---
title: 'Package structure'
weight: 3
---
# Package structure

```sh
npm install @muze-nl/metro
```

```js
import metro from '@muze-nl/metro'

const client = metro.client('/api/')
  .with(metro.mw.timeout(5000), metro.mw.retry(), metro.mw.json())
```

`@muze-nl/metro` is the beginner-friendly package. It re-exports the core, middleware, API helpers, tracing, hash parameter helpers, and formdata helper, and its browser bundle sets `globalThis.metro`.

Use smaller packages when you know the boundary you want:

```sh
npm install @muze-nl/metro-core @muze-nl/metro-middleware
```

```js
import { client } from '@muze-nl/metro-core'
import { json, retry } from '@muze-nl/metro-middleware'

const api = client('https://jsonplaceholder.typicode.com/')
  .with(retry({ attempts: 3 }), json())
```

| Package | Main exports | Documentation |
| --- | --- | --- |
| `@muze-nl/metro` | default `metro`, core exports, `mw`, `trace`, `hashParams`, `formdata`, `api`, `jsonApi` | [combined package](../packages/metro/docs/) |
| `@muze-nl/metro-core` | `client`, `Client`, `request`, `response`, `url`, `metroError`, `deepClone` | [core](../packages/metro-core/docs/) |
| `@muze-nl/metro-api` | `API`, `JsonAPI`, `api`, `jsonApi` | [API helpers](../packages/metro-api/docs/) |
| `@muze-nl/metro-middleware` | `json`, `thrower`, `getdata`, `retry`, `timeout`, `abort`, `backoff`, `echoMock`, `errorMock` | [middleware](../packages/metro-middleware/docs/) |
| `@muze-nl/metro-trace` | `add`, `delete`, `clear`, `group`, `graph`, `localConsole`, `GraphTracer` | [trace](../packages/metro-trace/docs/) |
| `@muze-nl/metro-hashparams` | `parse`, `append`, `clear` | [hash params](../packages/metro-hashparams/docs/) |
| `@muze-nl/metro-formdata` | `formdata` | [formdata](../packages/metro-formdata/docs/) |
| `@muze-nl/metro-oauth2` | `oauth2mw`, OAuth helpers, `dpopmw`, stores, popup helpers | [OAuth2](../packages/metro-oauth2/docs/) |
| `@muze-nl/metro-oidc` | `oidcmw`, `discover`, `register`, `idToken`, `idTokenClaims` | [OIDC](../packages/metro-oidc/docs/) |
| `@muze-nl/metro-oldm` | default `oldmmw` | [OLDM](../packages/metro-oldm/docs/) |

## Rule of thumb

Start with `@muze-nl/metro`. Move to package-specific imports when you have a reason: smaller browser bundles, isolated tests, clearer package ownership, or code that should not depend on beginner convenience exports.
