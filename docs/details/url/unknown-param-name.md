---
title: 'metro.url: Unknown Parameter Name'
---
# metro.url: Unknown Parameter Name

You have passed a parameter to the `metro.url()` function that is unknown. The error message should contain the exact parameter that `metro.url` does not know. Please check if there is a typo in the name?

These are the valid parameters for `metro.url()`

- `hash`
- `host`
- `hostname`
- `href`
- `password`
- `pathname`
- `port`
- `protocol`
- `username`
- `search`
- `searchParams`

In addition you can pass a string or URL or Location object, and these will be used as the starting URL for any other options. A string with a relative URL will be applied to any previous options.

You can also pass a URLSearchParams object, and it will be added to the URL.

Here's an example:

```javascript
const myURL = metro.url(document.location, {
	pathname: '/some/where/'
}, '?foo=bar')
```
