---
title: 'Reference'
---
# @muze-nl/metro-formdata reference

```js
import { formdata } from '@muze-nl/metro-formdata'
```

## `formdata(...options)`

```js
const body = formdata(
  { name: 'Luke' },
  { movie: ['A New Hope', 'The Empire Strikes Back'] }
)
```

Creates a `FormData` proxy. Options are applied in order and may be:

- an `HTMLFormElement`;
- a `FormData` instance;
- a plain object.

Object values that are arrays append one entry per array item.

```js
const next = body.with({ movie: 'Return of the Jedi' })
```

`with()` returns a new formdata value with extra entries. The original value is not changed.
