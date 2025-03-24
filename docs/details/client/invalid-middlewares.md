---
title: 'Invalid Middlewares Value'
---
# Invalid Middlewares Value

This error occurs if you mis-configure the MetroJS client when adding one or more middleware modules.

The correct way to add a single middleware module is:

```javascript
const client = metro.client(options).with(myMiddlewareFunction)
```

However, often you will need to pass some options to the middleware as well. In that case, the middleware should provide a factory function, that takes those options and returns a middleware function:

```javascript
const client = metro.client(options).with(myMiddlewareFactorey(middlewareOptions))
```

You can also add a middleware function directly to the client factory method, e.g:

```javascript
const client = metro.client(options, myMiddlewareFunction)
```

Finally, you can add a set of middleware functions in the options parameter:

```javascript
const options = {
	middlewares: [
		myMiddlewareFunction,
		anotherMiddlewareFunction
	]
}
const client = metro.client(options)
```

Note: the middlewares param _must_ be an array of functions.
