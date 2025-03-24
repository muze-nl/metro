---
title: 'client.get'
---
# client.get

```
client.get(...options) : Promise<Response>
```

This method is available by default, but can be disable. The `get()` method will start a `HTTP GET` request, using [`fetch()`](https://developer.mozilla.org/en-US/docs/Web/API/fetch), with the given options. It will return a [Promise]()https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise which resolves in a [Response](../response/) on success.

This method is fully backwards compatible with the `fetch()` method, except the HTTP method is fixed to `GET`.

In addition, it uses the defaults set when creating the client as the starting options. Options passed to `client.get()` can override those defaults.

For example: The client will have a default URL, usually that is the `document.location.href` in the browser. You can then set a relative URL in the get call, e.g.:

```javascript
let response = await client.get('/mypath/')
```
