---
title: '@muze-nl/metro-middleware'
---
# @muze-nl/metro-middleware

```sh
npm install @muze-nl/metro-core @muze-nl/metro-middleware
```

```js
import { client } from '@muze-nl/metro-core'
import { json, retry, timeout } from '@muze-nl/metro-middleware'

const api = client('https://jsonplaceholder.typicode.com/')
  .with(timeout(5000), retry({ attempts: 3 }), json())

const response = await api.get('/posts/1')
console.log(response.data)
```

Use this package for generic request/response behaviour that should not live in the core client.

## Reference

See [reference](reference.md). For custom middleware, start with the root guide: [Writing Metro middleware](../../../docs/middleware-authoring.md).
