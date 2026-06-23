---
title: 'Client'
---
# Client

```
metro.client(...options) : Client
```

Returns a new client, with a default request object built out of the options passed. Later option values in the parameter list override earlier values.

You can pass any option that would be valid for the default [Request constructor](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request). You can also provide a [metro request](../request/) as option. Any option specified will result in all subsequent HTTP calls having those options by default. You can still override them.

Where [`fetch()`](https://developer.mozilla.org/en-US/docs/Web/API/fetch) uses the first parameter to specify the URL, you can use any position in the parameters for `metro.client()` to pass a URL. Either by using the [`metro.url()`](../url.md) function to create a specific URL object, or the browsers default [`URL()`](https://developer.mozilla.org/en-US/docs/Web/API/URL) class, or a [Location](https://developer.mozilla.org/en-US/docs/Web/API/Location) object, like `document.location`. Or by just using a string. Any string that is passed as an option is assumed to be a URL. 

## with

You can create a new client, with one or more options set to a new default value, by calling the [`with()`](./with.md) method.

```javascript
const newClient = oldClient.with({
	url: '/otherpath/'
})
````

## Middleware

In addition you can also add a middleware function with this signature:

```
async (req, next) => Response
```

Where `req` is a [metro request](../request/), which is a [Proxy](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy) for the default [Request class](https://developer.mozilla.org/en-US/docs/Web/API/Request). See below. `next` is an asynchronous function that takes a request and returns a Promise\<Response>. You must call this function yourself in your middleware function. Here is an example that just adds an authorization header to each request:

```javascript
const client = metro.client(async (req,next) => {
  return next(req.with({
    headers: {
      'Authorization':'Bearer '+token
    }
  }))
})
```

## HTTP Methods

By default a metro client will have the methods: [`get()`](./get.md), [`post()`](./post.md), [`put()`](./put.md), [`delete()`](./delete.md), [`options()`](./options.md), [`patch()`](./patch.md) and [`query()`](./query.md). These all correspond with the similarly named HTTP methods, or verbs.

You can restrict, or enhance this list by setting the verbs property, like this:

```javascript
const client = metro.client({
  verbs: ['get','post']
})
```

This will result in a client with only the `get()` and `post()` methods. Any word you add in this list, will be made available as a method, and will use the all uppercase word as the HTTP method.



## Client Methods

- [with](./with.md)

## Default HTTP Methods
- [get](./get.md)
- [post](./post.md)
- [put](./put.md)
- [delete](./delete.md)
- [patch](./patch.md)
- [options](./options.md)
- [query](./query.md)
