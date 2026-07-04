---
title: 'Reference'
---
# @muze-nl/metro-oldm reference

```js
import oldmmw from '@muze-nl/metro-oldm'
```

## `oldmmw(options)`

```js
const api = client('https://pod.example/')
  .with(oldmmw({
    prefixes: {
      ldp: 'http://www.w3.org/ns/ldp#',
      schema: 'https://schema.org/'
    }
  }))
```

Adds Linked Data parsing and writing to a Metro client. Responses with Linked Data content types are parsed into OLDM data and stored on `response.data`. Request bodies that can be serialized by OLDM are converted before they are sent.

Common option: `prefixes`, passed through to OLDM.

See the OLDM package documentation for the data model and prefix behaviour.
