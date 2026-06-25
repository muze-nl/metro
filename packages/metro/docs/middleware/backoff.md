---
title: 'Backoff middleware'
---
# Backoff middleware

The `backoff` middleware remembers when a server asks the client to wait before sending more requests.

```javascript
const client = metro.client('/api/')
	.with(metro.mw.backoff())
```

When a response says to back off, later requests to the same origin wait until the backoff period has passed.

The middleware recognizes:

- `Retry-After` on `429` and `503` responses;
- `RateLimit-Remaining: 0` with `RateLimit-Reset`;
- the newer combined `RateLimit` field when it contains `r=0` and `t=<seconds>`.

## Options

```javascript
metro.mw.backoff({
	scope: 'origin',       // 'origin', 'path', 'url', or a function
	maxDelay: 60000,
	store: metro.mw.backoff.memoryStore()
})
```

Use `scope: 'origin'` to share one backoff timer for the whole API. Use `scope: 'path'` or `scope: 'url'` when the server rate-limits separate endpoints independently.

## Persistent store

The default store is in memory. In a browser, you can use `localStorage` instead:

```javascript
const client = metro.client('/api/')
	.with(metro.mw.backoff({
		store: metro.mw.backoff.localStorageStore()
	}))
```

That can be useful when a page reloads after receiving a rate-limit response.

## With retry

`retry` already honors `Retry-After` and rate-limit headers while deciding when to retry the same request. `backoff` is different: it remembers the server's instruction for later requests as well.

```javascript
const client = metro.client('/api/')
	.with(
		metro.mw.backoff(),
		metro.mw.timeout(5000),
		metro.mw.retry({ attempts: 3 })
	)
```

## Tracing

When `metro.trace.graph()` is active, server-requested backoff is shown as an event and diagnostic.
