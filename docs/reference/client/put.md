---
title: 'client.put'
---
# client.put

```
client.put(...options) : Promise<Response> : throws
```

This method is available by default, but can be disable. The `put()` method will start a `HTTP PUT` request, using [`fetch()`](https://developer.mozilla.org/en-US/docs/Web/API/fetch), with the given options. It will return a [Promise]()https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise which resolves in a [Response](../response/) on success.

This method is fully backwards compatible with the `fetch()` method, except the HTTP method is fixed to `PUT`.

Just like [`client.post()`](./post.md) you can set a `body` parameter in the options.
