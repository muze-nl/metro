---
title: 'Reference'
---
# @muze-nl/metro-core reference

```js
import { client, Client, request, response, url, metroError, deepClone } from '@muze-nl/metro-core'
```

## `client(...options)`

```js
const api = client('https://jsonplaceholder.typicode.com/')
const res = await api.get('/posts/1')
```

Creates a `Client`. Options are applied in order. A string, `URL`, or `Location` sets or updates the base URL. A function is added as middleware. A plain object can contain Fetch `Request` options, `url`, `middlewares`, `verbs`, or trace options.

```js
const api = client(
  'https://example.com/api/',
  { headers: { Accept: 'application/json' } },
  async (req, next) => next(req.with({ headers: { 'X-App': 'demo' } }))
)
```

## `new Client(...options)`

```js
const api = new Client('https://example.com/')
```

The class behind `client()`. It is exported for extension, but application code normally uses `client()`.

## Client methods

```js
await api.get('/items')
await api.post('/items', { body: 'hello' })
await api.put('/items/1', { body: 'hello again' })
await api.patch('/items/1', { body: 'patch' })
await api.delete('/items/1')
await api.options('/items')
await api.query('/items')
await api.fetch('/items', { method: 'GET' })
```

The default verb methods are `get`, `post`, `put`, `delete`, `patch`, `head`, `options`, and `query`. You can replace the list with `client({ verbs: ['get', 'post'] })`; each name becomes a method and the HTTP method is the upper-case name.

## `client.with(...options)`

```js
const base = client('https://example.com/')
const jsonApi = base.with({ headers: { Accept: 'application/json' } })
```

Returns a new `Client` with more default options or middleware. The original client is not changed.

## Middleware signature

```js
async function middleware(req, next, context) {
  const changed = req.with({ headers: { 'X-Demo': 'yes' } })
  const res = await next(changed)
  return res
}
```

`req` is a Metro request, `next(req)` calls the next middleware or `fetch()`, and `context` contains `{ client, options, trace, fetch }`. Use `context.fetch(req)` for nested Metro calls that keep the trace context.

## `request(...options)`

```js
const req = request(
  'https://example.com/api/',
  '/posts/1',
  { method: 'GET', headers: { Accept: 'application/json' } }
)
```

Creates a Fetch-compatible `Request` proxy. Strings and URLs update the URL, `URLSearchParams` append query values, body-compatible values become the body, and plain objects can contain Fetch request options.

```js
const posted = request('https://example.com/posts', {
  method: 'POST',
  body: { title: 'Metro' }
})

console.log(posted.data) // original body object
```

Metro request additions:

```js
const changed = req.with('/other-path', { headers: { Accept: 'text/plain' } })
console.log(req.data)
```

`with()` returns a derived request. `data` exposes the original body value passed to Metro before Fetch turns it into a stream.

## `response(...options)`

```js
const res = response({ status: 200, body: { ok: true } })
console.log(res.ok)   // true
console.log(res.data) // { ok: true }
```

Creates a Fetch-compatible `Response` proxy. String and body-compatible values become the body. Plain objects can contain `status`, `statusText`, `headers`, `body`, `url`, `type`, and `redirected`.

```js
const changed = res.with({ headers: { 'X-Demo': 'yes' } })
```

`with()` returns a derived response. `data` exposes the original body value passed to Metro.

## `url(...options)`

```js
const u = url('https://example.com/api/', 'posts/', {
  searchParams: { page: 2 },
  hash: 'top'
})

console.log(u.href)
```

Creates a frozen `URL` proxy with a `.with()` helper. Strings are resolved relative to the current URL. `URLSearchParams` and `searchParams` append query parameters; `search` replaces them.

```js
const u2 = url('https://example.com/files/report.pdf')
console.log(u2.filename)   // report.pdf
console.log(u2.folderpath) // /files/
console.log(u2.authority)  // https://example.com/
console.log(u2.fragment)   // hash without #
console.log(u2.scheme)     // https
```

Accepted object keys include `hash`, `fragment`, `host`, `hostname`, `href`, `password`, `pathname`, `port`, `protocol`, `username`, `search`, `searchParams`, and `hashParams`.

## `metroError(message, ...details)`

```js
throw metroError('Something went wrong', { details: true })
```

Logs the message with Metro's console prefix and returns an `Error` object. Metro uses this for its own configuration errors.

## `deepClone(value)`

```js
const copy = deepClone({ headers: { Accept: 'application/json' } })
```

Copies arrays and plain objects. Custom classes and functions are preserved by reference.
