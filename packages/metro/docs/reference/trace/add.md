---
title: 'metro.trace.add'
---
# metro.trace.add

```
metro.trace.add(name, tracer) : void
```

Adds tracer functions with the given name to the middleware tracers stack. A tracer is an object with up to three functions:

```javascript
{
  request: (req, middleware) => {},
  response: (res, middleware) => {},
  error: (error, req, middleware) => {}
}
```

Whenever you start a request in a metro client (e.g. [`client.get()`](../client/get.md)), for each middleware step, the tracer functions will be called. First the `request()` tracer function is called, then the middleware is called, then `response()` or `error()` is called. Tracers work on all metro client requests globally.
