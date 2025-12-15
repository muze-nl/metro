---
title: 'getdata middleware'
---
# getdata middleware

The `getdatamw()` middleware will automatically return response.data instead of response, if response.data is set. Response.data will be set by the json middleware, for example, when a response contains json. Usually you should combine this with the thrower middleware, so that network errors will throw an exception.

## Usage

```javascript
import metro from '@muze-nl/metro'

const client = metro.client().with( 
	metro.mw.jsonmw(),
	metro.mw.throwermw(),
	metro.mw.getdatamw() 
)
```

Then to send and receive data:

```javascript
let result = await client.post(url, {
	some: 'data'
})
let result
if (response.ok) {
	result = response.data.something
}
```

Note that the [`metro.jsonApi`](../api/jsonApi/) will do all this and some more automatically for you.
