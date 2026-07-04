---
title: '@muze-nl/metro-trace'
---
# @muze-nl/metro-trace

```sh
npm install @muze-nl/metro-core @muze-nl/metro-trace
```

```js
import { client } from '@muze-nl/metro-core'
import { graph } from '@muze-nl/metro-trace'

const tracer = graph({ view: 'tree' })
const api = client('/api/', { trace: tracer })
```

Use this package when you need to see which middleware touched a request, where a request failed, or how nested Metro calls relate to each other.

## Reference

See [reference](reference.md).
