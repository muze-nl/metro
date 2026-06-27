---
title: 'Quickstart'
weight: 1
---
# Quickstart

```sh
npm install @muze-nl/metro
```

```js
import metro from '@muze-nl/metro'

const client = metro.client('https://jsonplaceholder.typicode.com/')
  .with(metro.mw.json())

const response = await client.get('/posts/1')
console.log(response.data)
```

The combined package is the easiest way in. It includes the core client, middleware, API helpers, trace helpers, hash-parameter helpers, and `formdata()`.

## Browser page

```html
<script src="https://cdn.jsdelivr.net/npm/@muze-nl/metro@0.7.1/dist/browser.min.js"></script>
<script>
  const client = metro.client('https://jsonplaceholder.typicode.com/')
    .with(metro.mw.json())

  client.get('/posts/1').then(response => {
    console.log(response.data)
  })
</script>
```

## Make a request

```js
const response = await client.get('/users/1')

if (response.ok) {
  console.log(response.data.name)
}
```

Metro still returns Fetch-compatible responses. The JSON middleware only adds `response.data` when the response is JSON.

## Send JSON

```js
const created = await client.post('/posts', {
  body: {
    title: 'Metro',
    body: 'Fetch with compartments',
    userId: 1
  }
})

console.log(created.data)
```

## Add resilience

```js
const resilient = metro.client('https://jsonplaceholder.typicode.com/')
  .with(
    metro.mw.timeout(5000),
    metro.mw.retry({ attempts: 3 }),
    metro.mw.json(),
    metro.mw.thrower()
  )
```

`timeout()` aborts slow requests, `retry()` retries temporary failures, `json()` handles JSON bodies, and `thrower()` turns non-OK responses into thrown errors.

## Next steps

- Read the [tutorial](tutorial.md) for a guided path through the library.
- See the [package map](packages.md) when you want smaller imports.
- Use package-specific docs for reference material.
