---
title: 'metro.trace.graph'
---
# metro.trace.graph

```
const tracer = metro.trace.graph(options)
metro.trace.add('graph', tracer)
```

Creates an optional console graph tracer. The tracer records Metro middleware spans, fetch spans, diagnostics, and custom events. It stores the trace in `localStorage` by default in browsers, so the trace can be inspected after redirects, reloads, or OAuth/OIDC popup flows that return to the same origin.

This graph tracer is part of the beginner-friendly combined Metro export. It is not imported by the small core browser build unless you import `tracegraph.mjs` yourself.

```javascript
import metro from '@muze-nl/metro'

const tracer = metro.trace.graph({
  view: 'tree',
  autoPrint: true
})

metro.trace.add('graph', tracer)
```

A failed request is printed with a compact diagnostic summary first, then the full graph:

```text
Metro trace: GET /profile error 312ms

Primary diagnostic:
✖ network-error: Failed to fetch

└─ ✖ oidc middleware 312ms
   └─ ✖ browserFetch /profile 301ms
```

## Options

```javascript
metro.trace.graph({
  view: 'tree',              // 'tree' or 'sequence'
  persist: true,             // use localStorage when available
  autoPrint: true,           // print after a top-level Metro call completes
  includeRawTrace: false,    // also console.dir() the raw trace object
  maxAge: 10 * 60 * 1000,    // remove old persisted traces
  maxTraces: 20,
  slowStepMs: 1000,
  expectedStatus: status => status < 400
})
```

`expectedStatus` may also be an array of allowed status codes:

```javascript
const tracer = metro.trace.graph({
  expectedStatus: [200, 401]
})
```

That is useful for flows where a `401` is expected and starts authorization.

## Manual events

Middleware can add custom events to the current trace:

```javascript
tracer.event('window.open', {
  from: 'App',
  to: 'Identity Provider',
  label: 'authorize'
})
```

Events with `from` and `to` fields appear in the sequence view.

## Redirects and popup flows

For OAuth/OIDC flows, link the current trace to the OAuth state before opening a popup or redirecting:

```javascript
const state = createState()
tracer.link(state)
```

On the callback page, resume the trace using the same state:

```javascript
tracer.resumeLink(state)
tracer.event('callback received', {
  from: 'Identity Provider',
  to: 'App',
  label: 'callback'
})
```

Metro can only trace code while it runs on your own origin. It cannot trace inside the identity provider's origin, but it can resume the same trace when control returns to the app.

## Methods

The returned tracer exposes these helper methods:

```javascript
tracer.printLast()
tracer.print(traceId)
tracer.render(traceId)
tracer.get(traceId)
tracer.event(name, data)
tracer.span(name, asyncFunction, data)
tracer.link(key, traceId)
tracer.resume(traceId, parentSpanId)
tracer.resumeLink(key, parentSpanId)
tracer.pause()
tracer.clear()
```

The renderer redacts common secret-looking fields such as tokens, passwords, cookies, authorization headers, code verifiers, and credentials.
