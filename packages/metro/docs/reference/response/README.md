---
title: 'Response'
---
# metro.response

```
metro.response(...options) : Response
```

Returns a new response, built out of the options passed. Later option values override earlier values. 

Unlike the normal Response, you can set all available properties for a response, except `ok`. That is automatically derived from the status code.

You can set the body to any supported type, or to a plain Object. The body will still report as a ReadableStream, but now you can access `response.data`, which will be the object passed as the body parameter. e.g:

```javascript
const res = metro.response({
	status: 200,
	statusText: 'OK',
	body: {
		foo: 'some data'
	}
})

const data = res.data.foo
```

Creating responses from scratch is not usually needed, except when creating mock responses for testing or when enhancing responses in a middleware component. In that case the [`with()`](./with.md) comes in handy.

## default Response methods

- [`arrayBuffer()`](https://developer.mozilla.org/en-US/docs/Web/API/Response/arrayBuffer)
- [`blob()`](https://developer.mozilla.org/en-US/docs/Web/API/Response/blob)
- [`clone()`](https://developer.mozilla.org/en-US/docs/Web/API/Response/clone)
- [`formData()`](https://developer.mozilla.org/en-US/docs/Web/API/Response/clone)
- [`json()`](https://developer.mozilla.org/en-US/docs/Web/API/Response/json)
- [`text()`](https://developer.mozilla.org/en-US/docs/Web/API/Response/text)

## metro Response methods

- [`with()`](./with.md)

## metro Response properties

- [`data`](./data.md)
