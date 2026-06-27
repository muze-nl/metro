---
title: 'Reference'
---
# @muze-nl/metro-middleware reference

```js
import {
  json,
  thrower,
  getdata,
  retry,
  timeout,
  abort,
  backoff,
  echoMock,
  errorMock
} from '@muze-nl/metro-middleware'
```

Middleware is added to a Metro client with `.with()`:

```js
const api = client('https://jsonplaceholder.typicode.com/')
  .with(timeout(5000), retry({ attempts: 3 }), json(), thrower())
```

## `json(options)`

```js
const api = client('https://jsonplaceholder.typicode.com/').with(json())
const response = await api.post('/posts', { body: { title: 'Metro', userId: 1 } })
console.log(response.data)
```

Adds `Accept: application/json` when missing, serializes plain object request bodies to JSON for non-GET/HEAD requests, and parses JSON responses into `response.data`.

Options: `contentType`, `accept`, `reviver`, `replacer`, `space`.

## `thrower(options)`

```js
const api = client('/api/').with(thrower())
```

Throws an `Error` when `response.ok` is false. The original response is available as `error.cause`. You can pass status handlers:

```js
thrower({
  404(req) {
    return this.with({ body: { missing: true } })
  }
})
```

## `getdata()`

```js
const api = client('/api/').with(json(), getdata())
const data = await api.get('/profile')
```

For OK responses with `response.data`, returns the data directly. Otherwise returns the response.

## `retry(options)`

```js
const api = client('/api/').with(retry({ attempts: 3, delay: 250 }))
```

Retries temporary failures. By default it retries `GET`, `HEAD`, and `OPTIONS` responses with status `408`, `425`, `429`, `500`, `502`, `503`, or `504`, and it does not retry abort or timeout errors.

Common options: `attempts`, `delay`, `factor`, `maxDelay`, `jitter`, `methods`, `status`, `respectRetryAfter`, `respectRateLimit`, `when`, `onError`, `sleep`, `random`.

A number may be used as shorthand:

```js
api.with(retry(5))
```

## `timeout(options)`

```js
const api = client('/api/').with(timeout(5000))
```

Aborts a request after a delay. A number is shorthand for `{ ms }`. `ms` may also be a function receiving the request.

```js
timeout({ ms: req => req.method === 'GET' ? 3000 : 10000 })
```

Exports `timeout.timeoutError(ms)` as a helper on the default function.

## `abort(options)`

```js
const controller = new AbortController()
const api = client('/api/').with(abort(controller.signal))

controller.abort(new Error('cancelled'))
```

Adds or combines an external abort signal with the request signal. `options` may be an `AbortSignal`, a function returning one, or `{ signal }`.

Exports `abort.combineSignals(...signals)` and `abort.abortError(message)` as helpers on the default function.

## `backoff(options)`

```js
const api = client('/api/').with(backoff({ maxDelay: 60000 }))
```

Remembers server backoff hints and waits before later requests in the same scope. It understands `Retry-After`, `RateLimit-Reset` with `RateLimit-Remaining: 0`, and combined `RateLimit` values with `r=0` and `t=seconds`.

Common options: `store`, `scope`, `statuses`, `maxDelay`, `sleep`, `now`.

Stores:

```js
backoff.memoryBackoffStore()
backoff.localStorageBackoffStore({ prefix: 'metro:backoff:' })
```

Helpers on the default function include `responseBackoffDelay`, `parseRetryAfter`, `parseRateLimitReset`, `parseCombinedRateLimit`, `memoryBackoffStore`, `localStorageBackoffStore`, and `sleep`.

## `echoMock()`

```js
const api = client('/api/').with(echoMock(), json())
const response = await api.post('/anything', { body: { ok: true } })
```

Returns a `200 OK` Metro response that echoes the request URL, headers, and body. Useful in tests.

## `errorMock()`

```js
const api = client('/api/').with(errorMock(), thrower())
await api.get('/404/')
```

Returns HTTP error responses for paths such as `/400/`, `/401/`, `/403/`, `/404/`, `/429/`, and common `5xx` paths. Useful in tests.

## Default export

```js
import mw from '@muze-nl/metro-middleware'

mw.json()
mw.retry()
```

The default export is an object containing the named middleware factories.
## Writing your own middleware

```js
function addHeader(name, value) {
  return async function addHeader(req, next) {
    return next(req.with({
      headers: {
        [name]: value
      }
    }))
  }
}
```

For middleware invariants and examples, see [Writing Metro middleware](../../../docs/middleware-authoring.md).

