---
title: '@muze-nl/metro-hashparams'
---
# @muze-nl/metro-hashparams

```sh
npm install @muze-nl/metro-hashparams
```

```js
import * as hashParams from '@muze-nl/metro-hashparams'

const url = hashParams.append('https://example.com/#view', { panel: 'settings' })
console.log(url.href)
// result: https://example.com/#view?panel=settings
```

Use this package when a browser application needs shareable state in the URL without sending that state to the server as a query string.

## Reference

See [reference](reference.md).
