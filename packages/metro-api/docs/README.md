---
title: '@muze-nl/metro-api'
---
# @muze-nl/metro-api

```sh
npm install @muze-nl/metro-api
```

```js
import { jsonApi } from '@muze-nl/metro-api'

const posts = jsonApi('https://jsonplaceholder.typicode.com/', {
  getPost(id) {
    return this.get(`/posts/${id}`)
  },
  listComments(postId) {
    return this.get(`/comments?postId=${encodeURIComponent(postId)}`)
  }
})

console.log(await posts.getPost(1))
```

Use this package when an application has a small named API surface and you do not want to pass URLs around everywhere. `@muze-nl/metro` re-exports these helpers as `metro.api()` and `metro.jsonApi()`.

## Reference

See [reference](reference.md).
