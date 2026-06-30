---
title: '@muze-nl/metro-oidc'
---
# @muze-nl/metro-oidc

```sh
npm install @muze-nl/metro-core @muze-nl/metro-oidc
```

```js
import { client } from '@muze-nl/metro-core'
import { oidcmw } from '@muze-nl/metro-oidc'

const api = client('https://example.solidcommunity.net/')
  .with(oidcmw({
    issuer: 'https://solidcommunity.net/',
    client_info: {
      client_name: 'My Metro App',
      redirect_uris: [location.href]
    }
  }))

const result = api.get('foo')
```

Use this package when a resource is protected by OpenID Connect. It can discover the issuer metadata, dynamically register a client when supported, configure OAuth2, validate the ID token, and store the resulting ID token claims.

## Reference

See [reference](reference.md).
