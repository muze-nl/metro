---
title: 'Reference'
---
# @muze-nl/metro reference

```js
import metro, {
  client,
  request,
  response,
  url,
  api,
  jsonApi,
  mw,
  trace,
  hashParams,
  formdata
} from '@muze-nl/metro'
```

## Default export

```js
import metro from '@muze-nl/metro'

metro.client('/api/')
metro.mw.json()
metro.trace.group()
```

The default export is an object that combines the focused Metro packages. In the browser bundle the same object is assigned to `globalThis.metro` if that name is not already set.

## Re-exported core

```js
const client = metro.client('https://example.com/')
const req = metro.request('/posts/1')
const res = metro.response({ status: 200, body: { ok: true } })
const nextUrl = metro.url('https://example.com/posts/', { searchParams: { page: 2 } })
```

For the core API details, see [`@muze-nl/metro-core`](../../metro-core/docs/).

## API helpers

```js
const posts = metro.jsonApi('https://jsonplaceholder.typicode.com/', {
  getPost(id) {
    return this.get(`/posts/${id}`)
  }
})

console.log(await posts.getPost(1))
```

For details, see [`@muze-nl/metro-api`](../../metro-api/docs/).

## Middleware

```js
const client = metro.client('https://jsonplaceholder.typicode.com/')
  .with(
    metro.mw.timeout(5000),
    metro.mw.retry({ attempts: 3 }),
    metro.mw.json(),
    metro.mw.thrower()
  )
```

For middleware options, see [`@muze-nl/metro-middleware`](../../metro-middleware/docs/).

## Trace

```js
const tracer = metro.trace.graph({ view: 'tree' })
const client = metro.client('/api/', { trace: tracer })
```

For tracing, see [`@muze-nl/metro-trace`](../../metro-trace/docs/).

## Hash params

```js
const url = metro.hashParams.append(location.href, { panel: 'settings' })
const params = metro.hashParams.parse(url)
```

For details, see [`@muze-nl/metro-hashparams`](../../metro-hashparams/docs/).

## Form data

```js
const body = metro.formdata({ name: 'Leia', tag: ['pilot', 'general'] })
await metro.client('/api/').post('/people', { body })
```

For details, see [`@muze-nl/metro-formdata`](../../metro-formdata/docs/).
