---
title: '@muze-nl/metro-core'
---
# @muze-nl/metro-core

```sh
npm install @muze-nl/metro-core
```

```js
import { client } from '@muze-nl/metro-core'

const api = client('https://jsonplaceholder.typicode.com/')
const response = await api.get('/posts/1')
console.log(await response.json())
```

Use this package when you only need Metro's Fetch-compatible client and helper constructors. It does not include JSON parsing middleware, tracing UI, API helpers, auth, or Linked Data support.

## Reference

See [reference](reference.md).
