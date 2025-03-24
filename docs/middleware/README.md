---
title: 'Middleware'
weight: 3
---
# Middleware

## Using middleware

You can add middleware to a client using the client() function directly, or by calling with() on an existing client. This will return a new client with the middleware added:

```javascript
import jsonmw from '@muze-nl/metro/src/mw/jsonmw'
const client = metro.client( jsonmw() )
```

See the [middleware documentation](./middleware/) for a list of default middleware available with MetroJS. In addition, there is a seperate package [@muze-nl/metro-oauth2](https://github.com/muze-nl/metro-oauth2/) that implements an OAuth2 client as metro middleware.

## Creating middleware

A middleware is a function with (request, next) as parameters, returning a response. Both request and response adhere to the Fetch API [Request](https://developer.mozilla.org/en-US/docs/Web/API/Request) and [Response](https://developer.mozilla.org/en-US/docs/Web/API/Response) standard.

next is a function that takes a request and returns a `Promise<Response>`. This function is defined by MetroJS and automatically passed to your middleware function. The idea is that your middleware function can change the request and pass it on to the next middleware or the actual `fetch()` call, then intercept the response and change that and return it:

```javascript
async function myMiddleware(req,next) {
  req = req.with('?foo=bar')
  let res = await next(req)
  if (res.ok) {
    res = res.with({headers:{'X-Foo':'bar'}})
  }
  return res
}
```

/Note/: Both `metro.request` and `metro.response` have a `with()` function. This allows you to create a new request or response, from the existing one, with one or more options added or changed. The original request or response is not changed. See the [reference](./reference/) for more information.

## Differences to the browser Request and Response objects

The browsers `Request` and `Response` classes were never designed with middleware in mind. The consequence is that some things have been altered in `metro.request()` and `metro.response()`. Most notably the handling of `Request.body` and `Response.body`.

In a normal `Request` and `Response`, the moment that you set a body, the body is transformed into a `ReadableStream`. Streams can only be read asynchronously, and only once. This is clearly not suitable for a middleware function, where you would want to inspect the current body, and possibly alter it.

So in a `metro.request` or a `metro.response`, if you set a new body, the original body parameter that you passed to it, is stored as `request.data` or `response.data`. `metro.request().body` and `metro.response().body` are still `ReadableStreams`, and work like normal. But now if you pass a `FormData` or `URLSearchParams` object as a body, you can still access them in `metro.request().data` or `metro.response().data`.

To do this, the `metro.request()` and `metro.response()` functions return a Proxy to the Request and Response objects. However, `fetch()` (the default browser implementation) will not accept Proxies as parameter. So `metro.client().fetch()`unwraps the Proxies for you.

These Proxies also allow you to do specific metro things, like:
```javascript
  let req = metro.request('https://example.com', new URLSearchParams('?foo=bar'))
  req = req.with({searchParams: {'foo2':'bar'}})
  console.log(req.data.get('foo2'))
```

See the [issues](./issues.md) for a list of issues with the normal Fetch API that metro fixes, or at least makes simpler.
