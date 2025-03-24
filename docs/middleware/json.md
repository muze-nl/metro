---
title: 'JSON middleware'
---
# JSON middleware

The `jsonmw()` middleware allows you to automatically parse and stringify javascript data when sending or receiving data.

## Usage

```javascript
import metro from '@muze-nl/metro'

const client = metro.client().with( metro.mw.jsonmw({
	space: "\t"
}) )
```

Then to send and receive data:

```javascript
let response = await client.post(url, {
	some: 'data'
})
let result
if (response.ok) {
	result = response.data.something
}
```

The `jsonmw` middelware will automatically add the `Accept: application/json` header to your requests.

If the HTTP request supports a body, as in `POST`, `PUT`, `PATCH` and `QUERY`, it will also add the `Content-Type: application/json` header. Any data send as the body of the request, will be turned into json. 

The body of the response is automatically parsed as json, and made available as `response.data`.

## Configuration Options

The JSON middleware allows you to set the options to use when parsing or stringifying JSON:

- `reviver`: A function to use when parsing JSON, just like [JSON.parse](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse#the_reviver_parameter)
- `replaced`: A function to use when stringifying JSON, just like [JSON.stringify](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify#the_replacer_parameter)
- `space`: The indentation to use when stringifying JSON, just like [JSON.stringify](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify#space)
