---
title: 'Tracers'
---
# Metro Tracers

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

A tracer is an object with at most two functions, named 'request' and 'response'. You don't have to specify both of them. A tracer function doesn't return anything. It can not change the request or response.

You can add more than one tracer. Each name must be unique. You can remove a tracer by name, or clear all tracers. Tracers are stored globally, and run on any metro client request.

## Tracing Methods

- [`trace.add()`](./add.md)
- [`trace.delete()`](./delete.md)
- [`trace.clear()`](./clear.md)
- [`trace.group()`](./group.md)
