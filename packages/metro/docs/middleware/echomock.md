---
title: 'Echo Middleware'
---
# Echo Middleware

The `echomw` middleware is a mock middleware. It doesn't actually call `fetch()`, instead it copies the incoming request directly to a response. It doesn't call `next()`, so any other middleware is skipped.

The `echomw` middleware is only useful for testing purposes and should never be used in production.

## Usage

```javascript
import metro from '@muze-nl/metro'
import echomw from '@muze-nl/metro/src/mw/echo.mock.mjs'

const client = metro.client().with( echomw() )
```
