---
title: 'Metro documentation'
weight: 1
---
# Metro documentation

```js
import metro from '@muze-nl/metro'

const client = metro.client('https://jsonplaceholder.typicode.com/')
  .with(metro.mw.json())

const post = await client.get('/posts/1')
console.log(post.data)
```

Metro is Fetch with a small composable client around it. Use the combined `@muze-nl/metro` package while learning, then import the smaller packages directly when you want tighter bundles or clearer boundaries.

## General docs

- [Quickstart](quickstart.md)
- [Tutorial](tutorial.md)
- [Package structure](packages.md)
- [Debugging and tracing](debugging.md)
- [Error details](details/)

## Package docs

| Package | Docs | Use it for |
| --- | --- | --- |
| `@muze-nl/metro` | [combined package](../packages/metro/docs/) | One import, browser global, beginner-friendly API. |
| `@muze-nl/metro-core` | [core](../packages/metro-core/docs/) | Small Fetch-compatible client and helpers. |
| `@muze-nl/metro-api` | [API helpers](../packages/metro-api/docs/) | Named API methods on top of Metro clients. |
| `@muze-nl/metro-middleware` | [middleware](../packages/metro-middleware/docs/) | JSON, thrower, retry, timeout, abort, backoff, mocks. |
| `@muze-nl/metro-trace` | [trace](../packages/metro-trace/docs/) | Request tracing and console graph diagnostics. |
| `@muze-nl/metro-hashparams` | [hash params](../packages/metro-hashparams/docs/) | Query-like values in `location.hash`. |
| `@muze-nl/metro-formdata` | [formdata](../packages/metro-formdata/docs/) | Build immutable-ish FormData values from objects/forms. |
| `@muze-nl/metro-oauth2` | [OAuth2](../packages/metro-oauth2/docs/) | Authorization-code, PKCE, popup, token storage, DPoP. |
| `@muze-nl/metro-oidc` | [OIDC](../packages/metro-oidc/docs/) | Discovery, registration, OIDC auth, ID token validation. |
| `@muze-nl/metro-oldm` | [OLDM](../packages/metro-oldm/docs/) | Linked Data parsing and writing. |
