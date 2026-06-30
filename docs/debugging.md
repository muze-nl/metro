---
title: 'Debugging'
weight: 4
---
# Debugging

## Introduction

Adding middleware to the fetch()--client.get(), client.post(), etc..--call hides a lot of complexity, which is good. But it also makes debugging harder. So MetroJS adds a number of tools to make debugging easier.

The most important of these are tracers.

## Tracing middleware

Tracers allow you to look under the hood and see what is going on in each middleware function. Every time a middleware function is called, the client checks if any tracers are set. If so, the request tracer is called before the middleware function, and the response tracer is called after the middleware function.

A tracer function cannot alter the request or response. But you can use it to log information. Or you can set a debugger trap if a specific condition is met, e.g:

```javascript
metro.trace.add('debug', {
  request: (req) => {
    if (req.searchParams.has('foo')) {
      debugger;

    }

  }
})
```

A tracer is an object with at most three functions, named 'request', 'response', and 'error'. You don't have to specify all of them. A tracer function doesn't return anything. It can not change the request or response.

You can add more than one global tracer. Each name must be unique. You can remove a tracer by name, or clear all tracers. Global tracers run on any Metro client request. For focused debugging, you can also scope a tracer to a single client or pass the current trace context into nested Metro calls.

There is a default tracer method included with MetroJS, called metro.trace.group. You can add it like this:

```javascript
metro.trace.add('group', metro.trace.group())
```


## Visual trace graph

For complex flows, especially OAuth/OIDC, the combined Metro library also includes an optional graph tracer:

```javascript
const tracer = metro.trace.graph({
  view: 'tree',
  autoPrint: true
})

const client = metro.client('/api/', { trace: tracer })
```

You can still install the same tracer globally while debugging a whole app:

```javascript
metro.trace.add('graph', tracer)
```

The graph tracer records each Metro middleware step as a span. Nested Metro calls, such as discovery, token exchange, or a retry of the original request, become child spans in the same trace. Failed steps are marked with diagnostics before the full graph is printed.

```text
GET /private/profile error 842ms

Primary diagnostic:
✖ network-error: Failed to fetch

└─ ✖ oidc middleware 842ms
   ├─ ✓ discover issuer 84ms
   │  └─ ✓ browserFetch /.well-known/openid-configuration 82ms
   └─ ✖ token exchange 732ms
      └─ ✖ browserFetch /token 731ms
```


## Scoped traces and nested calls

Scoped tracing keeps overlapping requests separate, so a slow request and a fast request do not share one stack. This is especially important when OAuth/OIDC middleware makes extra Metro calls while the original request is still active.

```javascript
const tracer = metro.trace.graph({ autoPrint: true })
const client = metro.client('/api/', { trace: tracer })
```

Middleware receives a third `context` argument. Use `context.trace.options()` when an internal Metro call should be added to the same trace:

```javascript
async function oidc(req, next, context) {
  await discoveryClient.get(issuerMetadataUrl, context.trace.options())
  await tokenClient.post(tokenEndpoint, context.trace.options({ body: tokenRequest }))
  return next(req)
}
```

Manual trace events should use `context.trace.event()` inside middleware. This keeps events attached to the current request instead of relying on global trace state:

```javascript
context.trace.event('authorization popup opened', {
  from: 'App',
  to: 'Identity Provider',
  label: 'authorize'
})
```

The tracer persists to `localStorage` by default when it is available. This allows an OAuth/OIDC flow to keep the same trace across redirects, reloads, or a popup callback that returns to the same origin.

```javascript
const state = createState()
tracer.link(state)

// Later, on the callback page:
tracer.resumeLink(state)
tracer.event('authorization callback received', {
  from: 'Identity Provider',
  to: 'App',
  label: 'callback'
})
```

Use `view: 'sequence'` to render an OAuth-style sequence view. Custom events with `from` and `to` fields become arrows in that diagram.

The graph tracer is optional. It is included in the combined beginner-friendly Metro export, but it is not part of the small core build.
