---
title: 'Url'
---
# metro.url

```
metro.url(...options) : Url
```

Returns a new Url, built out of the options passed. Valid options are any property of the [default Url class](https://developer.mozilla.org/en-US/docs/Web/API/URL). 

/Note/: this allows much more precise parameter changes than the default Url constructor. You can for example explicitly change the port number of an existing Url, but keep everything else:

```javascript
let url = metro.url('https://example.com/?foo=bar', {
	port: 8080
})
```

You can set both the `search` and `searchParams` option using either a string (e.g.; '?foo=bar') or by passing an object. 

If you set `searchParams`, your parameters will be appended to existing parameters. 

If you set `search`, existing parameters will be dropped.
