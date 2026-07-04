---
title: 'Reference'
---
# @muze-nl/metro-hashparams reference

```js
import { parse, append, clear } from '@muze-nl/metro-hashparams'
```

## `parse(url)`

```js
const params = parse('https://example.com/#section?tab=profile')
console.log(params.get('tab'))
```

Returns a `URLSearchParams` object for the query part inside the hash. `#?foo=bar` and `#section?foo=bar` are recognised.

## `append(url, params)`

```js
const next = append('https://example.com/#section', { tab: 'profile' })
console.log(next.href) // https://example.com/#section?tab=profile
```

Returns a Metro URL with `params` appended to the hash.

## `clear(url)`

```js
const clean = clear('https://example.com/#section?tab=profile')
```

Returns a Metro URL with the hash query portion removed, preserving the rest of the hash.
