---
title: 'metro.api'
---
# metro.api

```javascript
metro.api(base, methods): API
```

Returns an API object, which extends metro.client with the methods passed as the second parameter. E.g:

```javascript
const api = metro.api(
	'https://example.com',
	{
		postFoo: function(foo) {
			return this.post({foo})
		}
	}
)
```

Functions must not be defined with the arrow syntax ((foo) => { ... }). Otherwise the function won't have access to `this.post` etc.

The first param is wrapped in a metro.client, e.g. `metro.client('https://example.com')`, so it can be any valid parameter for metro.client, including a metro client itself.

The metro.api() automatically adds the thrower and getdata middleware to the metro client.


## metro.jsonApi

```javascript
metro.jsonApi(base, methods): API
```

This creates a new API with the presumption that all API methods should send JSON as the body and parse the result again as JSON. It adds 'Content-Type: application/json' and 'Accept: application/json' headers, unless Content-Type or Accept headers are already present.

Any client methods that return a response, now return the parsed JSON instead, if JSON is returned.