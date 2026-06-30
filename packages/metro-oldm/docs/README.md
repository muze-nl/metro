---
title: '@muze-nl/metro-oldm'
---
# @muze-nl/metro-oldm

```sh
npm install @muze-nl/metro-core @muze-nl/metro-oldm
```

```js
import { client } from '@muze-nl/metro-core'
import oldmmw from '@muze-nl/metro-oldm'

const api = client('https://pod.example/')
  .with(oldmmw({
    prefixes: {
      schema: 'https://schema.org/'
    }
  }))

const result = api.get('foo.ttl')
```

Use this package when Metro should parse Linked Data responses into OLDM data and serialize OLDM-shaped data back to a Linked Data format.

## Reference

See [reference](reference.md).
