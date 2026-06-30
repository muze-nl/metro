---
title: 'Reference'
---
# @muze-nl/metro-api reference

```js
import { API, JsonAPI, api, jsonApi } from '@muze-nl/metro-api'
```

## `api(base, methods)`

```js
const service = api('https://example.com/api/', {
  getUser(id) {
    return this.get(`/users/${id}`)
  }
})
```

Creates an `API` instance. `base` may be a Metro client or any option accepted by `metro-core`'s `client()`. `methods` is an object whose functions are bound to the API instance, so use normal function syntax rather than arrow functions when you need `this.get()`, `this.post()`, and friends.

`API` adds `thrower()` and `getdata()` middleware. Non-OK responses throw, and OK responses with `response.data` return that data directly.

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

Creates a `JsonAPI`. It adds JSON middleware before the normal API behaviour: object request bodies are encoded as JSON, JSON responses are parsed into `response.data`, non-OK responses throw, and API methods return parsed data where available.

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
