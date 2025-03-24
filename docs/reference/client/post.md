---
title: 'client.post'
---
# client.post

```
client.post(...options) : Promise<Response> : throws
```

This method is available by default, but can be disable. The `get()` method will start a `HTTP POST` request, using [`fetch()`](https://developer.mozilla.org/en-US/docs/Web/API/fetch), with the given options. It will return a [Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise) which resolves in a [Response](../response/) on success.

This method is fully backwards compatible with the `fetch()` method, except the HTTP method is fixed to `POST`.

In addition, it uses the defaults set when creating the client as the starting options. Options passed to `client.post()` can override those defaults.

If you pass a [FormData](../formdata/) object as one of the options, it will automatically be send along as the POST body, using the default `application/x-www-form-urlencoded` encoding. You can change this by setting the appropriate `Content-Type` header, e.g. to `multipart/formdata`.

You can explicitly set the body of the request, e.g:

```javascript
let response = await client.post({
	body: {
		key: value
	}
})
```

If the body property is one of these object types: String, ReadableStream, Blob, ArrayBuffer, DataView, FormData, URLSearchParams, then the body is passed on as-is to [fetch()]() and the browser handles it as normal.

If the body property is any other kind of object, the `post()` method will convert it to JSON by default.

Only the POST, PUT, PATCH and QUERY methods accept a body in the request. Other methods will throw an error.
