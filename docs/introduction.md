# Introduction

## About MetroJS

MetroJS is an HTTPS client with support for middleware. Similar to ExpressJS, but for the client:

```javascript
import metro from '@muze-nl/metro'

const token = 'my-token'

const client = metro.client({
  url: 'https://api.github.com/',
  headers: {
    'Authorization':'Bearer '+token
  }
}).with(metro.mw.json())

let response = await client.get('/repos/muze-nl/metro/commits')

if (response.ok) {
  for ( const commit of response.data ) {
    console.log(commit.commit.message)
  }
}
```

MetroJS is designed to be fully compatible with the Fetch API, including Request, Response, URL and FormData.

The metro versions of Request, Response, etc. are all a Proxy to the real Request, Response, etc. The proxies add abilities that a normal Request or Response do not have. Like a with() function to create a derived version. Or in the case of Response, the ability to set values that aren't accessible in the normal Response constructor.

This allows metro to implement full middleware capabilities, including creating mocks, without giving up compatibility with normal Request and Response code.
