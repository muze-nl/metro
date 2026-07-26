---
title: 'Reference'
---
# @muze-nl/metro-api reference

```js
import { API, api, jsonApi } from '@muze-nl/metro-api'
```

## `api(base, methods)`

```js
const service = api('https://example.com/api/', {
  getUser(id) {
    return this.get(`/users/${id}`)
  }
})
```

Creates an `API` instance with the default API middleware stack. `base` may be a Metro client or any option accepted by `metro-core`'s `client()`. `methods` is an object whose functions are bound to the API instance, so use normal function syntax rather than arrow functions when you need `this.get()`, `this.post()`, and friends.

For applications, the factory functions are the preferred entry point. `api()` adds `thrower()` and `getdata()` middleware. Non-OK responses throw, and OK responses with `response.data` return that data directly.

The `API` constructor itself only binds methods onto a Metro client. It does not add middleware. When constructed directly, `base` must be a Metro client, an absolute URL, or client options with an absolute `url`. Libraries that extend API behaviour should compose the client in their own factory method and then call `new API()`:

```js
import { client } from '@muze-nl/metro-core'
import { getdata, thrower } from '@muze-nl/metro-middleware'

const res = Symbol('response')
const configured = client(base,
  thrower(),
  getdata({
    alwaysData: true,
    responseProperty: res
  })
)

const api = new API(configured, methods)
```

With `alwaysData`, OK responses without data produce `{}`. Existing response data is otherwise returned unchanged. `responseProperty` stores the original response as a non-enumerable property on that data object, and therefore requires object-shaped response data.

## `jsonApi(base, methods)`

```js
const posts = jsonApi('https://jsonplaceholder.typicode.com/', {
  getPost(id) {
    return this.get(`/posts/${id}`)
  },
  createPost(data) {
    return this.post('/posts', { body: data })
  }
})

const created = await posts.createPost({ title: 'Hello', body: 'Metro', userId: 1 })
```

Creates an `API` instance with JSON middleware before the normal API behaviour: object request bodies are encoded as JSON, JSON responses are parsed into `response.data`, non-OK responses throw, and API methods return parsed data where available.

## Nested API sections

```js
const service = jsonApi('https://example.com/', {
  users: {
    get(id) {
      return this.get(`/users/${id}`)
    }
  }
})

await service.users.get(42)
```

Plain nested objects become nested API sections. Methods are still bound to the root API by default, so `this.get()` remains available.

## `api.extend(methods)`

```js
const extended = service.extend({
  ping() {
    return this.get('/ping')
  }
})
```

Returns a new API instance with the additional methods.
