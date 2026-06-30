---
title: 'Reference'
---
# @muze-nl/metro-trace reference

```js
import { add, clear, delete as remove, group, graph, localConsole, GraphTracer } from '@muze-nl/metro-trace'
```

## Scoped tracing

```js
const tracer = graph({ view: 'tree' })
const api = client('/api/', { trace: tracer })
```

Prefer scoped tracing for application code. The tracer only sees requests made by that client and nested requests made through `context.fetch()` or `context.trace.options()`.

## `add(name, tracer)`

```js
add('console', group())
```

Adds a global tracer. Global tracers see all Metro clients.

## `delete(name)` / `remove(name)`

```js
remove('console')
```

Removes a named global tracer.

## `clear()`

```js
clear()
```

Removes all global tracers.

## `group()`

```js
add('group', group())
```

Creates a small tracer that logs request and response steps with `console.group()`.

## `graph(options)`

```js
const tracer = graph({
  view: 'tree',
  autoPrint: true
})
```

Creates a graph tracer that records spans, diagnostics, events, nested Metro calls, and request failures. In browsers it can use `localStorage`, which makes it useful for redirect and popup flows that return to the same origin.

Common options include `view`, `autoPrint`, `console`, `store`, `storage`, and `prefix`.

## Trace object methods available in middleware

```js
async function traced(req, next, context) {
  context.trace.event('cache lookup', { url: req.url })
  return context.trace.span('downstream request', () => next(req))
}
```

The trace API supports `event(name, data)`, `diagnostic(data)`, `span(name, fn, data)`, `current()`, `link(key)`, and `options(extra)`.

## `localConsole(options)`

```js
const out = localConsole()
```

Creates the console adapter used by the graph tracer.

## `GraphTracer`

```js
const tracer = new GraphTracer({ view: 'sequence' })
```

Class behind `graph()`. Most code should use `graph()`.
