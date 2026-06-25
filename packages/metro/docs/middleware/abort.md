---
title: 'Abort middleware'
---
# Abort middleware

The `abort` middleware lets you attach one abort signal to a whole client or to a group of requests.

```javascript
const controller = new AbortController()

const client = metro.client('/api/')
	.with(metro.mw.abort(controller.signal))

const request = client.get('/search')
controller.abort(new Error('search cancelled'))

await request
```

This is useful when a UI screen is closed, a route changes, or a group of requests should be cancelled together.

You can also pass a function to choose the signal for each request:

```javascript
metro.mw.abort(req => req.url.includes('/search') ? searchController.signal : null)
```

Metro combines the middleware signal with the request's existing signal. If either signal aborts, the request aborts.
