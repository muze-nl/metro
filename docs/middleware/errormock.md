---
title: 'Error Mock Middleware'
---
# Error Mock Middleware

The `errormw` middleware is a mock middleware. It doesn't actually call `fetch()`, instead it returns a fake response immediately. If you ask for a url with a pathname that is equal to a HTTP 400 or 500 errorcode, it will return a Response with that status code and message.

The `errormw` middleware is only useful for testing purposes and should never be used in production.

## Usage

```javascript
import metro from '@muze-nl/metro'
import errormw from '@muze-nl/metro/src/mw/error.mock.mjs'

const client = metro.client().with( errormw() )
try {
	client.get('https://example.com/404/')
} catch(err) {
	console.error(err)
}
```
