---
title: '@muze-nl/metro-oauth2'
---
# @muze-nl/metro-oauth2

```sh
npm install @muze-nl/metro-core @muze-nl/metro-oauth2
```

```js
import { client } from '@muze-nl/metro-core'
import oauth2 from '@muze-nl/metro-oauth2'

const api = client('https://resource.example/')
  .with(oauth2.oauth2mw({
    site: 'https://issuer.example/',
    oauth2_configuration: {
      client_id: 'my-client-id',
      token_endpoint_auth_method: 'none',
      authorization_endpoint: 'https://issuer.example/authorize',
      token_endpoint: 'https://issuer.example/token',
      redirect_uri: location.href,
      scope: 'profile'
    }
  }))
```

Use this package for OAuth2-protected resources. The examples here are structural; a real application needs provider-specific endpoints, registered redirect URIs, and client configuration.

## Reference

See [reference](reference.md).
