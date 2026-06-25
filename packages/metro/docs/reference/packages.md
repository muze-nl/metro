---
title: 'Package structure'
---
# Package structure

`@muze-nl/metro` is the beginner-friendly combined package. It re-exports the small core plus optional helpers and sets `globalThis.metro` in browser bundles.

Use `@muze-nl/metro-core` when you only need the small fetch-compatible core:

```javascript
import { client, request, response, url, Client, metroError } from '@muze-nl/metro-core'
```

Optional packages can be imported directly for smaller advanced builds:

```javascript
import { retry, timeout } from '@muze-nl/metro-middleware'
import { graph } from '@muze-nl/metro-trace'
import { api, jsonApi } from '@muze-nl/metro-api'
```

The combined package keeps the beginner API available in one object:

```javascript
import metro from '@muze-nl/metro'

const client = metro.client('/api/')
  .with(metro.mw.timeout(5000), metro.mw.retry())

const tracer = metro.trace.graph()
```

Current split:

| Package | Purpose |
| --- | --- |
| `@muze-nl/metro-core` | `client`, `Client`, `request`, `response`, `url`, `metroError`. |
| `@muze-nl/metro` | Combined beginner-friendly package and browser global. |
| `@muze-nl/metro-api` | `API`, `JsonAPI`, `api()`, `jsonApi()`. |
| `@muze-nl/metro-middleware` | Generic middleware. |
| `@muze-nl/metro-trace` | Tracing and console graph helpers. |
| `@muze-nl/metro-hashparams` | Hash query parameter helpers. |
| `@muze-nl/metro-formdata` | Optional `formdata()` helper. |
