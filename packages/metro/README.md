[![GitHub License](https://img.shields.io/github/license/muze-nl/metro)](https://github.com/muze-nl/metro/blob/main/LICENSE)
[![GitHub package.json version](https://img.shields.io/github/package-json/v/muze-nl/metro)]()
[![NPM Version](https://img.shields.io/npm/v/@muze-nl/metro)](https://www.npmjs.com/package/@muze-nl/metro)
[![npm bundle size](https://img.shields.io/bundlephobia/min/@muze-nl/metro)](https://www.npmjs.com/package/@muze-nl/metro)
[![Project stage: Experimental][project-stage-badge: Experimental]][project-stage-page]

# MetroJS: HTTPS Client with middleware

```javascript
import * as metro from '@muze-nl/metro'

const client = metro.client({
  url: 'https://github.com/'
}).with((req,next) => {
  req = req.with({
    headers: {
      'Content-Type':'application/json',
      'Accept':'application/json'
    }
  })
  if (typeof req.body == 'object') {
    req = req.with({
      body: JSON.stringify(req.body)
    })
  }
  let res = await next(req)
  let body = await res.json()
  return res.with({ body })
})
```
## Table of Contents
1. [Introduction](#introduction)
2. [Quickstart](docs/quickstart.md)
3. [Usage](#usage)
4. [Middleware](#middleware)
5. [Documentation](docs/) - See also [metro.muze.nl](https://metro.muze.nl/)
6. [Contributions](CONTRIBUTING.md)
7. [License](#license)

<a name="introduction"></a>
## Introduction

MetroJS is an HTTPS client with support for middleware. Similar to [ExpressJS](https://expressjs.com/), but for the client.

You add middleware with the `with()` function, as shown above.

The signature for a middleware function is:

```javascript
async (request, next, context) => {
   // alter request
   let response = await next(request)
   // alter response
   return response
}
```

However, both request and response are immutable. You can not change them. You can 
however create a copy with some values different, using the `with()` function.

Both metro.request() and metro.response() are compatible with the normal Request 
and Response objects, used by the Fetch API. Any code that works with those, will work
with the request and response objects in MetroJS.


## Package structure

`@muze-nl/metro` is now the beginner-friendly combined package. It re-exports the small core plus optional helpers and sets `globalThis.metro` in the browser bundle.

For advanced users who want the smallest import, the core package is available separately:

```javascript
import { client, request, response, url, Client, metroError } from '@muze-nl/metro-core'
```

Optional pieces are split into focused packages and re-exported here:

```javascript
import metro from '@muze-nl/metro'

metro.mw.retry()
metro.trace.graph()
metro.hashParams.parse(location.href)
```

<a name="usage"></a>
## Usage

```bash
npm install @muze-nl/metro
```

In the browser, using a cdn:
```html
<script src="https://cdn.jsdelivr.net/npm/@muze-nl/metro@0.6.4/dist/browser.js"></script>
<script>
  async function main() {
    const client = metro.client('https://example.com/')
    const result = await client.get('folder/page.html')
  }
  main()
</script>
```

Using ES6 modules, in the browser or Node:
```javascript
import * as metro from '@muze-nl/metro'

async function main() {
  const client = metro.client('https://example.com/')
  const result = await client.get('folder/page.html')
}
```



## Resilient requests

The combined Metro export includes optional middleware for common failure handling:

```javascript
const client = metro.client('/api/')
  .with(
    metro.mw.backoff(),
    metro.mw.timeout(5000),
    metro.mw.retry({ attempts: 3 })
  )
```

`retry` repeats safe temporary failures, `timeout` aborts slow requests, and `backoff` remembers server backoff hints such as `Retry-After` and rate-limit reset headers for later requests.

See the middleware docs for [`retry`](docs/middleware/retry.md), [`timeout`](docs/middleware/timeout.md), [`abort`](docs/middleware/abort.md), and [`backoff`](docs/middleware/backoff.md).


## Debugging complex flows

The combined Metro export includes an optional trace graph addon for debugging middleware, nested fetches, and OAuth/OIDC-style flows:

```javascript
const tracer = metro.trace.graph({ view: 'tree' })
const client = metro.client('/api/', { trace: tracer })
```

For app-wide debugging, you can still use `metro.trace.add('graph', tracer)`. Scoped tracing is safer when several requests may overlap.

The tracer prints a console graph with warnings and errors highlighted. In browsers it stores traces in `localStorage` by default, so a trace can be resumed after redirects or popup callbacks that return to the same origin.

```javascript
tracer.link(oauthState)
// later, on the callback page:
tracer.resumeLink(oauthState)
```

See [Debugging](docs/debugging.md) and [`metro.trace.graph`](docs/reference/trace/graph.md).

<a name="middleware"></a>
## Using middleware
A middleware is a function with `(request, next, context)` as parameters, returning a `response`. Existing middleware can ignore the optional `context` argument.
Both request and response adhere to the [Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)
[Request](https://developer.mozilla.org/en-US/docs/Web/API/Request) and 
[Response](https://developer.mozilla.org/en-US/docs/Web/API/Response) standard.

`next` is a function that takes a `request` and returns a `Promise<Response>`. This function is defined by MetroJS
and automatically passed to your middleware function. The idea is that your middleware function can change the request
and pass it on to the next middleware or the actual fetch() call, then intercept the response and change that and return it:

```javascript
async function myMiddleware(req, next, context) {
  req = req.with('?foo=bar')
  let res = await next(req)
  if (res.ok) {
    res = res.with({headers:{'X-Foo':'bar'}})
  }
  return res
}
```

Both request and response have a `with` function. This allows you to create a new request or response, from 
the existing one, with one or more options added or changed. The original request or response is not changed.

[Read more about middleware](docs/middleware/)

<a name="license"></a>
## License

This software is licensed under MIT open source license. See the [License](./LICENSE) file.


[project-stage-badge: Experimental]: https://img.shields.io/badge/Project%20Stage-Experimental-yellow.svg
[project-stage-page]: https://blog.pother.ca/project-stages/
