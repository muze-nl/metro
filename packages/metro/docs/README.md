---
title: '@muze-nl/metro'
---
# @muze-nl/metro

```sh
npm install @muze-nl/metro
```

```js
import metro from '@muze-nl/metro'

const client = metro.client('https://jsonplaceholder.typicode.com/')
  .with(metro.mw.json())

const response = await client.get('/posts/1')
console.log(response.data.title)
```

Use this package when you want the whole Metro toolbox from one import. It is the best starting point for applications, tutorials, and browser pages without a bundler.

## Browser use

```html
<script src="https://cdn.jsdelivr.net/npm/@muze-nl/metro@0.7.1/dist/browser.min.js"></script>
<script>
  const client = metro.client('https://jsonplaceholder.typicode.com/')
    .with(metro.mw.json())
</script>
```

## What is included

- Core: `client`, `Client`, `request`, `response`, `url`, `metroError`, `deepClone`.
- API helpers: `API`, `JsonAPI`, `api`, `jsonApi`.
- Middleware namespace: `metro.mw`.
- Trace namespace: `metro.trace`.
- Hash parameter namespace: `metro.hashParams`.
- FormData helper: `metro.formdata`.

## Reference

See [reference](reference.md).
