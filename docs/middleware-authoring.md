---
title: 'Writing middleware'
weight: 4
---
# Writing Metro middleware

```js
import { client } from '@muze-nl/metro-core'

function addHeader(name, value) {
	return async function addHeader(req, next, context) {
		return next(req.with({
			headers: {
				[name]: value
			}
		}))
	}
}

const api = client('/api/').with(addHeader('X-App', 'demo'))
```

A Metro middleware is an async function that receives a Metro request, a `next` function, and a small context object. It can pass a changed request to `next()`, inspect or change the response that comes back, return its own response without calling `next()`, throw an error, or make a nested Metro call through `context.fetch()`.

## The contract

```js
async function middleware(req, next, context) {
	const response = await next(req)
	return response
}
```

The first argument is a Metro request, which behaves like a standard Fetch `Request` and adds `.with()`. The second argument calls the next middleware in the chain, eventually reaching the real browser or Node `fetch()`. The third argument contains `{ client, options, trace, fetch }`.

Return a response or a deliberately transformed value. A normal middleware should return a `Response`, but some middleware, such as `getdata()`, intentionally returns `response.data`. That is fine, but it should be visible in the middleware name and documentation because later middleware will then receive data instead of a response.

## Do not mutate; derive

```js
function acceptJSON() {
	return async function acceptJSON(req, next) {
		return next(req.with({
			headers: {
				Accept: 'application/json'
			}
		}))
	}
}
```

Use `.with()` instead of mutating the incoming request, response, URL, or form data. Metro objects wrap standard Fetch objects, and standard Fetch objects have body-stream rules that become much easier to reason about when middleware derives a fresh object instead of poking at the existing one.

## Be careful with bodies

```js
function logTextBody() {
	return async function logTextBody(req, next) {
		if (req.body) {
			console.log(await req.clone().text())
		}
		return next(req)
	}
}
```

A Fetch body can usually be read only once. If a middleware wants to inspect text, JSON, or form data and still pass the request or response onward, use `clone()` first. This is why logging middleware should read `req.clone().text()` rather than `req.text()`.

Metro also keeps the original body value on `req.data` and `res.data` when it can. Middleware such as `json()` uses that to serialize plain objects before they become streams and to expose parsed response data without consuming the original response body.

## Call `next()` deliberately

```js
function cache(getCachedResponse) {
	return async function cache(req, next) {
		const cached = await getCachedResponse(req)
		if (cached) {
			return cached
		}
		return next(req)
	}
}
```

Most middleware calls `next(req)` exactly once. Some middleware may skip `next()` to return a cached or mocked response. Retry middleware may call `next()` more than once, but only because retrying is its explicit job. Hidden extra calls surprise users and make tracing difficult.

## Use `context.fetch()` for nested Metro calls

```js
function discoverBeforeRequest(discoveryUrl) {
	return async function discoverBeforeRequest(req, next, context) {
		const discovery = await context.fetch(discoveryUrl)
		if (!discovery.ok) {
			throw new Error('Discovery failed', { cause: discovery })
		}
		return next(req)
	}
}
```

`context.fetch()` runs another request through the same client while preserving trace context. Use it when a middleware needs to do internal HTTP work, such as discovery, token exchange, or refreshing remote metadata. Passing trace context manually is still possible through `context.trace.options()`, but `context.fetch()` is the simple default.

## Emit diagnostics instead of swallowing surprises

```js
function parseSomething() {
	return async function parseSomething(req, next, context) {
		const res = await next(req)
		try {
			return res.with({ body: parse(await res.clone().text()) })
		} catch(error) {
			context.trace.diagnostic({
				severity: 'warning',
				code: 'parse-failed',
				message: error.message
			})
			return res
		}
	}
}
```

Convenient middleware is allowed to be forgiving, but silent failure makes view-source debugging much harder. If a middleware catches an error and continues, emit a trace diagnostic when `context.trace` is available. The user can then see that Metro continued by design instead of wondering where the bug disappeared.

## Keep state explicit

```js
function countRequests(store = { count: 0 }) {
	return async function countRequests(req, next) {
		store.count++
		return next(req)
	}
}
```

A middleware factory may keep state in a closure, but shared state should be obvious from the options. Retry counters, backoff stores, caches, token stores, and trace stores should accept an injected store where practical. This keeps tests small and lets applications decide whether state belongs in memory, `sessionStorage`, `localStorage`, IndexedDB, or somewhere else.

## Ordering matters

```js
const api = client('/api/').with(
	timeout(5000),
	retry({ attempts: 3 }),
	json(),
	thrower(),
	getdata()
)
```

Middleware runs from left to right on the way out and unwinds from right to left on the way back. Put broad request controls such as timeout, retry, abort, and backoff near the start of the chain. Put body-format middleware such as `json()` near the API boundary. Put response-shaping middleware such as `thrower()` and `getdata()` after the middleware that creates or parses the response data.

## Checklist

Before adding middleware to Metro, check that it has a narrow job, returns a clear value, uses `.with()` instead of mutation, clones bodies before reading them for inspection, calls `next()` deliberately, documents any state it keeps, accepts injected stores or clocks where useful, and emits trace diagnostics for recoverable surprises.
