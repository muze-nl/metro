---
title: 'Retry middleware'
---
# Retry middleware

The `retry` middleware repeats safe requests when a response or network error looks temporary.

```javascript
import metro from '@muze-nl/metro'

const client = metro.client('/api/')
	.with(
		metro.mw.timeout(5000),
		metro.mw.retry({ attempts: 3 })
	)

const response = await client.get('/news')
```

Metro middleware runs from right to left. In the example above, `retry` wraps `timeout`, so each attempt gets its own timeout.

## Defaults

By default, `retry`:

- tries `GET`, `HEAD`, and `OPTIONS` requests only;
- makes at most 3 attempts, including the first one;
- retries HTTP `408`, `425`, `429`, `500`, `502`, `503`, and `504`;
- retries network errors, but not aborts or timeouts;
- uses exponential delay with jitter;
- honors `Retry-After` and rate-limit backoff headers.

## Options

```javascript
metro.mw.retry({
	attempts: 3,
	delay: 250,
	factor: 2,
	maxDelay: 30000,
	jitter: true,
	methods: ['GET', 'HEAD', 'OPTIONS'],
	status: [408, 425, 429, 500, 502, 503, 504]
})
```

You can allow retries for other methods, but be careful with methods that change server state:

```javascript
const client = metro.client('/api/')
	.with(metro.mw.retry({
		methods: ['GET', 'POST'],
		attempts: 2
	}))
```

If a request body is a one-use stream, Metro cannot safely replay it. Plain object, string, `FormData`, and `URLSearchParams` bodies are easier to retry because Metro keeps the original value on `request.data`.

## Tracing

When `metro.trace.graph()` is active, retries are shown as events and diagnostics in the graph:

```text
⚠ retry: Retrying GET /api/news after HTTP 503
└─ ℹ retry attempt — 2/3
```
