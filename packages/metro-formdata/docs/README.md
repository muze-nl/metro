---
title: '@muze-nl/metro-formdata'
---
# @muze-nl/metro-formdata

```sh
npm install @muze-nl/metro-formdata
```

```js
import { formdata } from '@muze-nl/metro-formdata'

const body = formdata({
  name: 'Leia Organa',
  role: ['princess', 'general']
})
```

Use this package when you want to build `FormData` from plain objects, existing `FormData`, or form elements, while keeping Metro's `.with()` style.

Sending a formdata object as the body of a POST/PUT request will automatically convert it to the 'application/x-www-form-urlencoded' format.

## Reference

See [reference](reference.md).
