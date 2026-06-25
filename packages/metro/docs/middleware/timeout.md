---
title: 'Timeout middleware'
---
# Timeout middleware

The `timeout` middleware aborts a request when it takes too long.

```javascript
const client = metro.client('/api/')
	.with(metro.mw.timeout(5000))

await client.get('/slow')
```

You can pass a number, or an options object:

```javascript
metro.mw.timeout({
	ms: 5000
})
```

`ms` may also be a function:

```javascript
metro.mw.timeout({
	ms: req => req.method == 'GET' ? 3000 : 10000
})
```

The middleware uses `AbortController` internally and combines its signal with any existing request signal.

## Per-attempt timeout with retry

Middleware runs from right to left. To apply the timeout to each retry attempt, put `timeout` before `retry`:

```javascript
const client = metro.client('/api/')
	.with(
		metro.mw.timeout(5000),
		metro.mw.retry({ attempts: 3 })
	)
```

To apply one timeout to the complete retry flow, put `timeout` after `retry`:

```javascript
const client = metro.client('/api/')
	.with(
		metro.mw.retry({ attempts: 3 }),
		metro.mw.timeout(15000)
	)
```

## Tracing

When `metro.trace.graph()` is active, a timeout is marked as an error diagnostic.
