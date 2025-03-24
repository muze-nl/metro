---
title: 'metro.fetch: Missing URL Parameter'
---
# metro.fetch: Missing URL Parameter

This error occurs when you call `metro.fetch(req)` and `req.url` is not set or empty.

The `metro.fetch()` function has two parameters:
- `req`: either a Request object or a URL object or string
- `options`: (Optional) an options object, with valid parameters for a Request,  or a URL object or string.

Either the `req` or the `options` object should specify a URL, e.g:

```javascript
let req = metro.request('https://www.example.com/')
let response = await metro.fetch(req)
```

Or, by overriding `req.url` in the second parameter:

```javascript
let response = await metro.fetch(req, 'https://www.example.com/')
```

Or, explicitly:

```javascript
let response = await metro.fetch(req, { 
	url: 'https://www.example.com/' 
})
```
