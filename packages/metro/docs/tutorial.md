---
title: 'Tutorial'
weight: 2
---
# MetroJS Tutorial: A Small Train Through Fetch Country

There is a particular sort of JavaScript program that begins life with a single `fetch()` call and, a few afternoons later, has grown a shed full of little extras around it. A base URL here, an authorization header there, a JSON conversion that really should not be copied for the seventeenth time, a retry rule because the server sometimes has a lie down, and eventually a debugging session in which you would dearly like to know which bit of plumbing touched the request last.

MetroJS is for that stage of the journey. It does not try to replace Fetch with a grand new philosophy. Instead it keeps the familiar Fetch objects, then gives you a reusable client and a middleware chain so those little extras can be named, tested, composed, and removed again. If Express is middleware on the way into a server, Metro is middleware on the way out of your application.

This tutorial assumes you are comfortable with JavaScript and promises, but that Metro itself is new territory. We will start with ordinary requests, move through middleware and API clients, and end with the heavier machinery: resilience, tracing, OAuth2, OpenID Connect, and Linked Data. The point is not to memorise every option; it is to get a feel for the shape of the machine so the reference docs make sense when you need them.

The live examples use two public services. JSONPlaceholder gives us predictable fake posts, comments, users, and simulated writes. Open-Meteo gives us a real weather request without an API key. They are good workshop bench supplies: public, simple, JSON-shaped, and safe enough for examples. The live blocks import Metro's browser bundle directly from jsDelivr, so each one is meant to run on its own in the documentation page.

## Which Metro are we using?

For most applications, start with the combined package:

```bash
npm install @muze-nl/metro
```

```js
import metro from '@muze-nl/metro'
```

That one package gives you the core client, request/response/URL helpers, middleware, API helpers, tracing, hash-parameter helpers, and `formdata()`. In a browser page without a bundler you can use the browser bundle, which creates `globalThis.metro`:

```html
<script src="https://cdn.jsdelivr.net/npm/@muze-nl/metro@0.7.1/dist/browser.min.js"></script>
<script>
  const client = metro.client('https://jsonplaceholder.typicode.com/')
</script>
```

Advanced users can import the smaller packages directly. We will come back to that in the advanced section, because it is a useful trick once you care about bundle size, but a distraction while learning the library.

# Beginner: Fetch, But With Compartments

## 1. Your first client

A Metro client is a reusable Fetch wrapper. Give it a base URL, then call HTTP methods on it. Here is the smallest complete program worth running: it loads Metro, asks JSONPlaceholder for one post, and prints the title.

{{< example language="javascript" console="true" preview="false" >}}
```javascript
(async () => {
  await import('https://cdn.jsdelivr.net/npm/@muze-nl/metro@0.7.1/dist/browser.min.js')

  const client = metro.client('https://jsonplaceholder.typicode.com/')
  const response = await client.get('posts/1')

  if (!response.ok) {
    console.warn(response.status, response.statusText)
    return
  }

  const post = await response.json()
  console.log(post.title)
})()
```
{{< /example >}}

The object you get back behaves like a normal Fetch `Response`. You still have `ok`, `status`, `statusText`, `headers`, `text()`, `json()`, `blob()`, and the rest of the standard Fetch surface. Metro is not asking you to forget Fetch; it is giving Fetch somewhere to keep its tools.

The base URL is reusable. `client.get('posts/1')` above resolves against `https://jsonplaceholder.typicode.com/`, so the actual request goes to `https://jsonplaceholder.typicode.com/posts/1`. This is already a small improvement over hand-written `fetch()` calls, because the shape of your remote service now has a name.

```js
const api = metro.client('https://jsonplaceholder.typicode.com/')

await api.get('posts/1')
await api.get('posts/1/comments')
await api.get('users/1')
```

By default Metro exposes methods for the usual HTTP verbs: `get`, `post`, `put`, `delete`, `patch`, `head`, `options`, and `query`. Each method builds a request from the client defaults plus whatever you pass to the call, then runs it through the middleware chain.

## 2. Defaults without glue code

Fetch accepts a URL and an options object. Metro accepts the same ingredients, but lets you bake some of them into a client. A useful default for JSON APIs is the `Accept` header:

```js
const api = metro.client('https://jsonplaceholder.typicode.com/', {
  headers: {
    Accept: 'application/json'
  }
})
```

The defaults do not trap you. You can derive a new client with `with()`, leaving the old one untouched. In the next live example, the original client asks for posts and the derived client adds a harmless tutorial header before asking for comments. Public services normally ignore such a header, but it shows the idea without inventing a private API.

{{< example language="javascript" console="true" preview="false" >}}
```javascript
(async () => {
  await import('https://cdn.jsdelivr.net/npm/@muze-nl/metro@0.7.1/dist/browser.min.js')

  const publicApi = metro.client('https://jsonplaceholder.typicode.com/', {
    headers: {
      Accept: 'application/json'
    }
  })

  const tutorialApi = publicApi.with({
    headers: {
      'X-Metro-Tutorial': 'defaults-without-glue'
    }
  })

  const postsResponse = await publicApi.get('posts?userId=1')
  const commentsResponse = await tutorialApi.get('posts/1/comments')

  const posts = await postsResponse.json()
  const comments = await commentsResponse.json()

  console.log(`User 1 has ${posts.length} posts in the demo data.`)
  console.log(`Post 1 has ${comments.length} comments.`)
})()
```
{{< /example >}}

That little `with()` method is one of the central Metro ideas. It appears on clients, requests, responses, URLs, and form data. Rather than changing the thing you already have, Metro makes a new thing with the changes applied. This makes middleware much less spooky, because a middleware function can add a header or alter a body without secretly mutating an object that some other code still holds.

## 3. URLs you can work with

JavaScript's standard `URL` object is useful, but its constructor can be awkward when you want to adjust one part and leave the rest alone. Metro's `url()` helper wraps a real `URL` and adds the same `with()` idea. Here it builds an Open-Meteo weather URL for Amsterdam, then turns the same base into a different query without string concatenation.

{{< example language="javascript" console="true" preview="false" >}}
```javascript
(async () => {
  await import('https://cdn.jsdelivr.net/npm/@muze-nl/metro@0.7.1/dist/browser.min.js')

  const forecast = metro.url('https://api.open-meteo.com/v1/forecast')
    .with({
      search: {
        latitude: '52.37',
        longitude: '4.90',
        current: 'temperature_2m,wind_speed_10m',
        timezone: 'Europe/Amsterdam'
      }
    })

  console.log(forecast.href)
  console.log(forecast.filename || '(no filename, just an endpoint)')

  const response = await metro.client().get(forecast)
  const weather = await response.json()

  console.log(
    `${weather.current.temperature_2m}${weather.current_units.temperature_2m}, ` +
    `${weather.current.wind_speed_10m} ${weather.current_units.wind_speed_10m}`
  )
})()
```
{{< /example >}}

There are two different knobs for query strings, and the distinction is worth remembering. `search` replaces the whole query string, while `searchParams` appends to what is already there:

```js
const base = metro.url('https://example.com/search?q=metro')

console.log(base.with({ search: { page: 2 } }).href)
// https://example.com/search?page=2

console.log(base.with({ searchParams: { page: 2 } }).href)
// https://example.com/search?q=metro&page=2
```

This matters in applications where a URL is not just a string to paste together but a small state object that moves through your code.

## 4. Posting form data

Metro includes a `formdata()` helper for the common case where you have a plain object and want a `FormData` instance. This example does not send anything over the network, because there is no good reason to trouble a public API with a pretend file upload, but the code is still runnable and shows the important behaviour: arrays become repeated fields.

{{< example language="javascript" console="true" preview="false" >}}
```javascript
(async () => {
  await import('https://cdn.jsdelivr.net/npm/@muze-nl/metro@0.7.1/dist/browser.min.js')

  const form = metro.formdata({
    title: 'A note from the bench',
    tag: ['metro', 'fetch', 'javascript']
  })

  for (const [name, value] of form.entries()) {
    console.log(name, value)
  }

  const finalForm = form.with({ published: 'yes' })
  console.log('Published?', finalForm.get('published'))
})()
```
{{< /example >}}

You can also pass an existing `FormData` object or, in the browser, an HTML form element. Do not set the `Content-Type` header yourself for ordinary multipart form uploads. Let the browser or runtime add the boundary. That is not a Metro rule so much as one of those Fetch rules that has been waiting in the long grass since the first time someone uploaded a file.

## 5. JSON without the ritual

Raw Fetch makes you do JSON work twice: stringify the outgoing body, then parse the incoming body. Metro's JSON middleware turns that into a reusable behaviour. JSONPlaceholder accepts `POST`, `PUT`, `PATCH`, and `DELETE` as demonstrations, but it fakes the write instead of permanently storing your data, which is exactly what we want for a tutorial.

{{< example language="javascript" console="true" preview="false" >}}
```javascript
(async () => {
  await import('https://cdn.jsdelivr.net/npm/@muze-nl/metro@0.7.1/dist/browser.min.js')

  const api = metro.client('https://jsonplaceholder.typicode.com/')
    .with(metro.mw.json())

  const response = await api.post('posts', {
    body: {
      title: 'The thing with middleware',
      body: 'It is less mysterious once you build one.',
      userId: 1
    }
  })

  console.log(response.status)
  console.log(response.data)
})()
```
{{< /example >}}

The JSON middleware does three useful things. If no `Accept` header is present, it adds one. For non-GET and non-HEAD requests, if `request.data` is a normal object and the content type is JSON, it stringifies that object into the request body. When the response has a JSON content type, it parses the response and returns a Metro response whose `data` property is the parsed value.

That `data` property is another of Metro's conveniences. A standard `Request` or `Response` body is a stream, and streams are read-once objects. Metro keeps the original body value available as `.data`, which is especially handy for middleware and tests.

```js
const req = metro.request('/posts/', {
  method: 'POST',
  body: { title: 'Hello' }
})

console.log(req.data.title)
// Hello
```

Without the JSON middleware, a plain object body is only a body value. With the JSON middleware, that body becomes JSON at the edge where the request leaves your application.

## 6. Remember that HTTP errors are still responses

Fetch does not throw just because the server says `404`. Neither does Metro's core client. This is a good default, because a `404` from an API can be a perfectly ordinary answer.

{{< example language="javascript" console="true" preview="false" >}}
```javascript
(async () => {
  await import('https://cdn.jsdelivr.net/npm/@muze-nl/metro@0.7.1/dist/browser.min.js')

  const api = metro.client('https://jsonplaceholder.typicode.com/')
  const response = await api.get('this-path-does-not-exist')

  console.log('ok:', response.ok)
  console.log('status:', response.status)

  if (response.status === 404) {
    console.log('No such resource, but this is still a Response.')
  }
})()
```
{{< /example >}}

When you do want non-2xx responses to become exceptions, add `thrower()`:

{{< example language="javascript" console="true" preview="false" >}}
```javascript
(async () => {
  await import('https://cdn.jsdelivr.net/npm/@muze-nl/metro@0.7.1/dist/browser.min.js')

  const strictApi = metro.client('https://jsonplaceholder.typicode.com/')
    .with(metro.mw.thrower())

  try {
    await strictApi.get('this-path-does-not-exist')
  } catch (error) {
    const response = error.cause
    console.warn('The server replied:', response?.status)
  }
})()
```
{{< /example >}}

The thrown error has the response as its `cause`, so you can still inspect the status and headers. Use this where exceptions match your program flow, but do not feel obliged to throw everything. Sometimes a `401`, `403`, or `404` is information rather than disaster.

# Intermediate: The Machinery Behind The Panel

## 7. Middleware is the part you came for

A Metro middleware function receives a request, a `next` function, and an optional context object:

```js
async function middleware(req, next, context) {
  const response = await next(req)
  return response
}
```

It can alter the outgoing request before calling `next(req)`, and it can alter the incoming response after `next(req)` resolves. The important word is "alter", not "mutate". Metro requests and responses are immutable wrappers around the standard Fetch objects, so you use `with()` to create derived versions.

Here is a small response middleware that measures roughly how long the request took, then adds that as a response header. It is a toy, but it shows the shape of a response middleware with a real network request underneath.

{{< example language="javascript" console="true" preview="false" >}}
```javascript
(async () => {
  await import('https://cdn.jsdelivr.net/npm/@muze-nl/metro@0.7.1/dist/browser.min.js')

  function clientTiming() {
    return async function clientTiming(req, next) {
      const start = performance.now()
      const response = await next(req)
      const elapsed = Math.round(performance.now() - start)

      const headers = new Headers(response.headers)
      headers.set('X-Client-Time', `${elapsed}ms`)

      return response.with({ headers })
    }
  }

  const api = metro.client('https://jsonplaceholder.typicode.com/')
    .with(clientTiming())

  const response = await api.get('posts/1')
  const post = await response.json()

  console.log(response.headers.get('X-Client-Time'))
  console.log(post.title)
})()
```
{{< /example >}}

A middleware does not have to call `next()`. A mock server middleware, for example, can return a response directly. If you do that, return `metro.response()` rather than a raw `new Response()` when outer middleware may expect Metro's `.with()` or `.data` helpers.

{{< example language="javascript" console="true" preview="false" >}}
```javascript
(async () => {
  await import('https://cdn.jsdelivr.net/npm/@muze-nl/metro@0.7.1/dist/browser.min.js')

  function tinyMockServer() {
    return async function tinyMockServer(req) {
      const path = new URL(req.url).pathname

      if (path === '/api/ping') {
        return metro.response({
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ok: true, path })
        })
      }

      return metro.response({ status: 404, statusText: 'Not Found' })
    }
  }

  const api = metro.client('/api/')
    .with(tinyMockServer())
    .with(metro.mw.json())

  const response = await api.get('ping')
  console.log(response.data)
})()
```
{{< /example >}}

## 8. Middleware order: the onion model

Middleware order is easier to understand if you imagine an onion. The outer layer sees the request first and the response last. In Metro, the most recently added middleware is the outer layer.

```js
const client = metro.client('/api/')
  .with(first)
  .with(second)
```

For an outgoing request, `second` runs first, then `first`, then the actual Fetch call. On the way back, `first` sees the response first, and `second` sees it last. The next example records that order without relying on a server at all.

{{< example language="javascript" console="true" preview="false" >}}
```javascript
(async () => {
  await import('https://cdn.jsdelivr.net/npm/@muze-nl/metro@0.7.1/dist/browser.min.js')

  const log = []

  function named(name) {
    return async function layer(req, next) {
      log.push(`${name}: request`)
      const response = await next(req)
      log.push(`${name}: response`)
      return response
    }
  }

  const client = metro.client('/api/')
    .with(named('first'))
    .with(named('second'))
    .with(metro.mw.errorMock())

  await client.get('/200/')
  console.log(log.join('\n'))
})()
```
{{< /example >}}

A common JSON API stack looks like this:

```js
const api = metro.client('/api/')
  .with(metro.mw.json())
  .with(metro.mw.thrower())
  .with(metro.mw.getdata())
```

On the request side, `getdata()` and `thrower()` mostly stand aside while `json()` prepares the JSON body. On the response side, `json()` parses the response, `thrower()` turns failed HTTP statuses into exceptions, and `getdata()` unwraps successful `response.data` so your application gets the parsed object directly. That stack is common enough that Metro has an API helper for it, which we will use next.

## 9. A tiny client library for your own API

As an application grows, raw paths start to look like solder blobs on a perfboard: functional, but hard to read later. Metro's API helper lets you name those paths. JSONPlaceholder has posts and comments, so we can make a tiny client library for it.

{{< example language="javascript" console="true" preview="false" >}}
```javascript
(async () => {
  await import('https://cdn.jsdelivr.net/npm/@muze-nl/metro@0.7.1/dist/browser.min.js')

  const posts = metro.jsonApi(
    metro.client('https://jsonplaceholder.typicode.com/'),
    {
      listByUser(userId) {
        return this.get(`posts?userId=${encodeURIComponent(userId)}`)
      },

      create(post) {
        return this.post('posts', { body: post })
      },

      item: {
        read(id) {
          return this.get(`posts/${encodeURIComponent(id)}`)
        },

        comments(id) {
          return this.get(`posts/${encodeURIComponent(id)}/comments`)
        }
      }
    }
  )

  const post = await posts.item.read(1)
  const comments = await posts.item.comments(1)
  const saved = await posts.create({
    title: 'Named paths are calmer',
    body: 'This write is simulated by JSONPlaceholder.',
    userId: 1
  })

  console.log(post.title)
  console.log(`${comments.length} comments`)
  console.log(saved)
})()
```
{{< /example >}}

`jsonApi()` builds on the Metro client, adds the JSON middleware, throws for failed responses, and returns `response.data` for successful JSON responses. Your methods are bound so `this.get()`, `this.post()`, and nested sections work as you would expect. If you do not want JSON behaviour, use `metro.api()` instead.

You can also extend an API object:

```js
const adminPosts = posts.extend({
  async latest() {
    const all = await this.get('posts')
    return all.at(-1)
  }
})
```

This is not meant to become a huge generated SDK. It is a small way to keep URL construction and HTTP choices close together, while leaving ordinary JavaScript in charge.

## 10. Timeouts, retries, backoff, and aborts

The network is a physical thing. Somewhere there is a cable, a radio, a router, a server, and an overloaded process that has just discovered it would rather be elsewhere. Metro's resilience middleware handles the boring bits of that reality.

{{< example language="javascript" console="true" preview="false" >}}
```javascript
(async () => {
  await import('https://cdn.jsdelivr.net/npm/@muze-nl/metro@0.7.1/dist/browser.min.js')

  const weather = metro.client('https://api.open-meteo.com/')
    .with(
      metro.mw.backoff(),
      metro.mw.timeout(8000),
      metro.mw.retry({ attempts: 3 })
    )
    .with(metro.mw.json())

  const response = await weather.get('v1/forecast', {
    search: {
      latitude: '52.37',
      longitude: '4.90',
      current: 'temperature_2m,wind_speed_10m',
      timezone: 'Europe/Amsterdam'
    }
  })

  console.log(response.data.current)
})()
```
{{< /example >}}

This stack reads naturally from the inside out. `backoff()` remembers when the server asks you to slow down, using headers such as `Retry-After` and common rate-limit reset hints. `timeout(8000)` aborts an individual attempt after eight seconds. `retry({ attempts: 3 })` makes another attempt for temporary failures.

By default, retry is conservative. It retries safe methods such as `GET`, `HEAD`, and `OPTIONS`, and it watches for statuses such as `408`, `425`, `429`, `500`, `502`, `503`, and `504`. It also avoids retrying abort and timeout errors. You can loosen those rules, but make the decision deliberately, especially for `POST` requests:

```js
const api = metro.client('/api/')
  .with(metro.mw.retry({
    attempts: 3,
    methods: ['GET', 'POST'],
    status: [429, 503]
  }))
```

Only retry a `POST` automatically when the operation is idempotent or the server has some other duplicate protection, because "try again" can otherwise mean "buy the same train ticket twice".

Abort support is there when the user changes their mind:

```js
const controller = new AbortController()

const api = metro.client('/api/')
  .with(metro.mw.abort(controller.signal))

const pending = api.get('slow-report')

// Later, perhaps from a cancel button:
controller.abort(new Error('User cancelled the report'))

await pending
```

You can also pass a Fetch `signal` as a request option. Metro's abort and timeout middleware combine signals so the request can be cancelled by whichever condition happens first.

## 11. Mocks for experiments and tests

Metro includes two small mock middleware helpers. `echoMock()` returns what you sent it, and `errorMock()` returns HTTP error responses based on the path. They are not a substitute for integration tests, but they are excellent for exploring a middleware stack without running a server.

{{< example language="javascript" console="true" preview="false" >}}
```javascript
(async () => {
  await import('https://cdn.jsdelivr.net/npm/@muze-nl/metro@0.7.1/dist/browser.min.js')

  const client = metro.client('/api/')
    .with(metro.mw.echoMock())
    .with(metro.mw.json())

  const response = await client.post('notes/', {
    body: {
      title: 'Echoes from the workbench'
    }
  })

  console.log(response.data.title)
})()
```
{{< /example >}}

For error handling experiments:

{{< example language="javascript" console="true" preview="false" >}}
```javascript
(async () => {
  await import('https://cdn.jsdelivr.net/npm/@muze-nl/metro@0.7.1/dist/browser.min.js')

  const failing = metro.client('/api/')
    .with(metro.mw.errorMock())
    .with(metro.mw.thrower())

  try {
    await failing.get('/404/')
  } catch (error) {
    console.log(error.cause.status)
  }
})()
```
{{< /example >}}

Mock middleware is also a good way to test your own middleware. Put your middleware outside or inside the mock depending on which side of the conversation you want to observe.

## 12. Hash parameters, the odd little drawer in the URL

Some browser flows use query parameters after the hash fragment. OAuth callbacks, old single-page routers, and small demos sometimes end up with URLs like this:

```text
https://example.com/app#callback?code=abc&state=xyz
```

Metro's hash-parameter helper keeps that drawer separate from the normal query string:

{{< example language="javascript" console="true" preview="false" >}}
```javascript
(async () => {
  await import('https://cdn.jsdelivr.net/npm/@muze-nl/metro@0.7.1/dist/browser.min.js')

  const callback = 'https://example.com/app#callback?code=abc&state=xyz'
  const params = metro.hashParams.parse(callback)

  console.log(params.get('state'))

  const withPanel = metro.hashParams.append(callback, {
    panel: 'settings'
  })

  console.log(withPanel.href)
  console.log(metro.hashParams.clear(withPanel).href)
})()
```
{{< /example >}}

You will not need this every day, but when you do need it, you will be pleased not to write another regular expression against `location.hash`.

## 13. Tracing: take the lid off

Middleware is wonderful right up to the moment you forget which layer touched the request. Metro tracers are observers: they see requests, responses, errors, events, and diagnostics, but they cannot change the traffic.

For quick debugging, add the group tracer globally. This live example makes one request and then removes the tracer again, because global debugging hooks are best treated like crocodile clips: useful, visible, and not left attached forever.

{{< example language="javascript" console="true" preview="false" >}}
```javascript
(async () => {
  await import('https://cdn.jsdelivr.net/npm/@muze-nl/metro@0.7.1/dist/browser.min.js')

  const api = metro.client('https://jsonplaceholder.typicode.com/')

  metro.trace.add('group-demo', metro.trace.group())
  const response = await api.get('posts/1')
  metro.trace.remove('group-demo')

  const post = await response.json()
  console.log(post.title)
})()
```
{{< /example >}}

A global tracer sees every Metro client, which is convenient while poking around and too broad for complex applications. For serious debugging, especially when several requests overlap, use a scoped graph tracer:

```js
const tracer = metro.trace.graph({
  view: 'tree',
  autoPrint: true
})

const api = metro.client('/api/', { trace: tracer })
  .with(metro.mw.timeout(3000))
  .with(metro.mw.retry({ attempts: 2 }))

await api.get('notes/')
```

The graph tracer records middleware spans, nested Metro calls, warnings, and errors. It can print a tree view, which is good for seeing where time went, or a sequence view, which is useful for OAuth-style browser journeys. You can write tiny custom tracers too:

```js
metro.trace.add('watch-auth', {
  request(req) {
    if (req.headers.has('Authorization')) {
      console.info('Authorised request:', req.url)
    }
  },

  error(error) {
    console.warn('Metro request failed:', error)
  }
})
```

The important limit is that tracers are instruments, not middleware. If you want to change a request, write middleware. If you want to see what happened, write a tracer.

# Advanced: Building The Bigger Machine

## 14. Import only the parts you need

The combined `@muze-nl/metro` package is deliberately friendly. It is the one to teach, the one to paste into examples, and the one to load from a CDN. When you are building a tighter bundle, the monorepo split lets you import smaller pieces.

```js
import { client, request, response, url } from '@muze-nl/metro-core'
import { json, retry, timeout } from '@muze-nl/metro-middleware'
import { jsonApi } from '@muze-nl/metro-api'
import { graph } from '@muze-nl/metro-trace'
```

For a single middleware, direct package subpaths are available:

```js
import json from '@muze-nl/metro-middleware/json'
import timeout from '@muze-nl/metro-middleware/timeout'
```

The split is straightforward:

| Package | Use it for |
| --- | --- |
| `@muze-nl/metro-core` | `client`, `Client`, `request`, `response`, `url`, and `metroError`. |
| `@muze-nl/metro` | The beginner-friendly combined package and browser global. |
| `@muze-nl/metro-api` | `API`, `JsonAPI`, `api()`, and `jsonApi()`. |
| `@muze-nl/metro-middleware` | JSON, thrower, getdata, retry, timeout, abort, backoff, and mocks. |
| `@muze-nl/metro-trace` | Console tracing and graph tracing. |
| `@muze-nl/metro-hashparams` | Query-like parameters stored in the URL hash. |
| `@muze-nl/metro-formdata` | The `formdata()` helper. |
| `@muze-nl/metro-oauth2` | OAuth2 middleware and helpers. |
| `@muze-nl/metro-oidc` | OpenID Connect middleware on top of Metro and OAuth2. |
| `@muze-nl/metro-oldm` | Linked Data parsing/writing middleware using OLDM. |

The important architectural choice is that `metro-core` stays small. Higher-level behaviour lives in optional packages, and the combined package gathers the common pieces for people who would rather get on with building the application.

## 15. Production middleware: small rules that prevent large evenings

Middleware is easy to write, which means it is also easy to write sloppily. A few rules keep it reliable. First, never mutate a request or response in place. Use `with()`:

```js
function accept(contentType) {
  return async function accept(req, next) {
    return next(req.with({
      headers: {
        Accept: contentType
      }
    }))
  }
}
```

Second, if you read a body stream, clone the response first. Streams are read once, and nothing says "unpleasant debugging session" like a body that vanished in a logging function.

```js
function logJsonBodies() {
  return async function logJsonBodies(req, next) {
    const response = await next(req)

    if (response.headers.get('Content-Type')?.startsWith('application/json')) {
      const clone = response.clone()
      console.debug(await clone.text())
    }

    return response
  }
}
```

Third, use `metro.response()` for mock responses if other middleware will continue to process them:

```js
function maintenanceMode() {
  return async function maintenanceMode() {
    return metro.response({
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Retry-After': '30' },
      body: 'The workshop is briefly closed.'
    })
  }
}
```

Fourth, use the middleware context for diagnostics and nested traces. The third argument contains a `trace` API that attaches events to the current request rather than some global pile of logs:

```js
function cacheProbe(cache) {
  return async function cacheProbe(req, next, context) {
    const cached = await cache.match(req)

    if (cached) {
      context.trace.event('cache hit', {
        severity: 'info',
        label: new URL(req.url).pathname
      })
      return metro.response(cached)
    }

    context.trace.event('cache miss', {
      severity: 'info',
      label: new URL(req.url).pathname
    })

    return next(req)
  }
}
```

For nested Metro calls, keep the trace context by passing `context.trace.options()` to the internal client:

```js
function tokenRefreshing(tokenClient) {
  return async function tokenRefreshing(req, next, context) {
    const token = await tokenClient.post('token/', context.trace.options({
      body: metro.formdata({ grant_type: 'refresh_token' })
    }))

    return next(req.with({
      headers: {
        Authorization: `Bearer ${token.data.access_token}`
      }
    }))
  }
}
```

Use a separate `tokenClient` for that sort of internal call unless you deliberately want the current client's whole middleware stack again. Calling back into the same client from inside middleware can be useful, but it can also be a recursion machine with nice upholstery.

## 16. Scoped graph traces across redirects and popups

The graph tracer becomes most valuable when a request is not one request. OAuth and OIDC flows may involve discovery, registration, a browser redirect or popup, a token exchange, and finally a replay of the original resource request. Without a trace, the whole thing can feel like listening to a relay click in another room.

```js
const tracer = metro.trace.graph({
  view: 'sequence',
  autoPrint: true
})

const api = metro.client('/api/', { trace: tracer })
```

Inside middleware, emit events that have `from`, `to`, and `label` fields if you want them to appear as arrows in the sequence view:

```js
context.trace.event('authorization popup opened', {
  from: 'App',
  to: 'Identity Provider',
  label: 'authorize'
})
```

For flows that leave the current page and later return, link the trace to a state value before the jump, then resume it on the callback page:

```js
const state = crypto.randomUUID()
tracer.link(state)

// Later, on the callback page:
tracer.resumeLink(state)
tracer.event('authorization callback received', {
  from: 'Identity Provider',
  to: 'App',
  label: 'callback'
})
```

The tracer can persist traces to `localStorage` when available, so a redirect does not necessarily cut the wire. Keep this scoped where you can. Global tracers are good for "what on earth just happened?"; scoped tracers are better for "what happened to this particular request?"

## 17. OAuth2: make authorization a middleware concern

Metro's OAuth2 package is separate from the combined core package. Install it alongside Metro when you need it:

```bash
npm install @muze-nl/metro @muze-nl/metro-oauth2
```

For browser applications, the recommended shape is authorization-code flow with PKCE and no client secret:

```js
import metro from '@muze-nl/metro'
import oauth2 from '@muze-nl/metro-oauth2'

const api = metro.client('https://api.example.com/')
  .with(oauth2.oauth2mw({
    site: 'https://issuer.example/',
    oauth2_configuration: {
      client_id: myClientId,
      token_endpoint_auth_method: 'none',
      authorization_endpoint: 'https://issuer.example/authorize',
      token_endpoint: 'https://issuer.example/token',
      redirect_uri: `${location.origin}/oauth2-callback.html`,
      scope: 'read write'
    }
  }))

const response = await api.get('/protected/')
```

By default, the middleware first lets a request go through. If the resource response indicates that authorization is required, it performs the OAuth2 flow, obtains or refreshes a token, and retries the request with the correct authorization header. If you know every request needs authorization, set `force_authorization: true`.

For single-page applications, use the popup helper:

```js
const api = metro.client('https://api.example.com/')
  .with(oauth2.oauth2mw({
    authorize_callback: oauth2.authorizePopup,
    oauth2_configuration: {
      client_id: myClientId,
      token_endpoint_auth_method: 'none',
      authorization_endpoint: 'https://issuer.example/authorize',
      token_endpoint: 'https://issuer.example/token',
      redirect_uri: `${location.origin}/oauth2-callback.html`
    }
  }))
```

The callback page is intentionally small:

```html
<script type="module">
  import oauth2 from '@muze-nl/metro-oauth2'

  oauth2.popupHandleRedirect()
  window.close()
</script>
```

Metro validates OAuth state before accepting the callback. It supports bearer tokens and DPoP-style token types, understands refresh tokens, and deliberately avoids the implicit and resource-owner-password flows. If you are writing confidential server-side code, the package also supports client secrets with `client_secret_post` or `client_secret_basic`, but never put a real client secret in browser code.

## 18. OpenID Connect and Solid-style clients

The OIDC package builds on the OAuth2 machinery and is especially relevant for Solid identity and storage servers. It can discover the issuer configuration, dynamically register a client when necessary, use PKCE and DPoP by default, and validate the `id_token` before storing it.

```bash
npm install @muze-nl/metro @muze-nl/metro-oidc
```

```js
import metro from '@muze-nl/metro'
import oidc from '@muze-nl/metro-oidc'

const storage = metro.client('https://example.solidcommunity.net/')
  .with(oidc.oidcmw({
    issuer: 'https://solidcommunity.net/',
    client_info: {
      client_name: 'My Metro App',
      redirect_uris: [
        `${location.origin}/app.html`
      ]
    }
  }))

const response = await storage.get('profile/card')
```

If the issuer supports dynamic client registration and you do not provide a `client_id`, the middleware can register the client and store the result. If you already know the provider metadata or client information, you can supply it and skip those discovery steps. The first `redirect_uris` entry is the one used for the current session, so put the active callback URL first.

After login, you can retrieve the raw ID token or validated claims:

```js
const raw = oidc.idToken({ issuer: 'https://solidcommunity.net/' })
const claims = oidc.idTokenClaims({ issuer: 'https://solidcommunity.net/' })
```

For Linked Data resources, add the OLDM middleware:

```bash
npm install @muze-nl/metro @muze-nl/metro-oidc @muze-nl/metro-oldm
```

```js
import metro from '@muze-nl/metro'
import oidc from '@muze-nl/metro-oidc'
import oldmmw from '@muze-nl/metro-oldm'

const pod = metro.client('https://example.solidcommunity.net/')
  .with(oidc.oidcmw({
    issuer: 'https://solidcommunity.net/',
    client_info: {
      client_name: 'Linked Data Workbench',
      redirect_uris: [`${location.origin}/app.html`]
    }
  }))
  .with(oldmmw({
    prefixes: {
      schema: 'https://schema.org/',
      foaf: 'http://xmlns.com/foaf/0.1/'
    }
  }))

const profile = await pod.get('profile/card')
console.log(profile.data)
```

The OLDM middleware sets an appropriate `Accept` header for Linked Data, serializes outgoing linked-data objects for non-GET requests, and parses recognised Linked Data response formats into `response.data`. The parsed data is OLDM data, so the next stop is the OLDM documentation rather than Metro itself.

## 19. A final mental model

Metro has a pleasantly small centre. At the centre is a Fetch-compatible client. Around it are immutable request, response, URL, and form-data helpers, each with `with()` so changes stay local. Around that is middleware, where cross-cutting behaviour belongs. Around that are convenience packages: JSON, API wrappers, retries, tracing, OAuth2, OIDC, and Linked Data.

When you are deciding where code should go, this rule of thumb usually works: if it is specific to one call, put it in the call options; if it is specific to one remote service, put it in a derived client; if it should apply to many calls, make it middleware; if it merely observes, make it a tracer; and if it turns a set of endpoints into a small vocabulary for your app, make an API helper.

That is the path of discovery Metro offers. You can begin with a single request that looks almost like Fetch, and only when the project demands it do you open the next compartment.
