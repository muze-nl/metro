---
title: 'metro.trace.add'
---
# metro.trace.add

```
metro.trace.add(name, tracer) : void
```

Adds tracer functions with the given name to the middleware tracers stack. A tracer is an object with two functions:

```javascript
{
  request: (req) => {},
  response: (res) => {}
}
```

Whenever you start a request in a metro client (e.g. [`client.get()`](../client/get.md)), for each middleware step, the tracer functions will be called. First the `request()` tracer function, then the middleware is called, then the `response()` tracer function is called. Tracers work on all metro client requests globally.
