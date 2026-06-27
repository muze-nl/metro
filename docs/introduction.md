---
title: 'Introduction'
weight: 0
---
# Introduction

```js
import metro from '@muze-nl/metro'

const client = metro.client('https://jsonplaceholder.typicode.com/')
  .with(metro.mw.json())

const response = await client.get('/posts/1')
console.log(response.data.title)
```

Metro is an HTTP client built around the Fetch API. It does not replace Fetch objects with a separate model; Metro requests and responses are proxies around standard `Request` and `Response` objects, so normal Fetch code still works. The additions are small but useful: a reusable client, middleware, a `.with()` method for deriving requests and responses without mutating them, and optional packages for common client-side concerns.

A Metro middleware function looks like this:

```js
async function addHeader(req, next, context) {
  return next(req.with({
    headers: {
      'X-App': 'demo'
    }
  }))
}
```

Middleware can change a request before it reaches `fetch()`, inspect or change the response on the way back, return a mock response, throw an error, or call other Metro clients while preserving trace context. That makes it a good place for JSON handling, retries, timeouts, auth, linked-data parsing, and debugging hooks.

Start with the [quickstart](quickstart.md), then use the [package structure](packages.md) page to decide whether the combined package or focused package imports fit your project better.
