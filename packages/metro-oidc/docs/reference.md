---
title: 'Reference'
---
# @muze-nl/metro-oidc reference

```js
import oidc, {
  oidcmw,
  discover,
  register,
  isRedirected,
  idToken,
  idTokenClaims,
  oidcStore,
  validateIdToken
} from '@muze-nl/metro-oidc'
```

## `oidcmw(options)`

```js
const api = client('https://example.solidcommunity.net/')
  .with(oidcmw({
    issuer: 'https://solidcommunity.net/',
    client_info: {
      client_name: 'My Metro App',
      redirect_uris: [location.href]
    }
  }))
```

Adds OpenID Connect authorization to a Metro client. By default it tries the request first and authorizes after a `401` or `403`. Set `force_authorization: true` to authorize immediately.

Important options: `issuer`, `client_info`, `client`, `openid_configuration`, `oauth2`, `store`, `scope`, `nonce`, `use_dpop`, `force_authorization`, and `authorize_callback`.

`use_dpop` defaults to `true`. Disable it only for providers or tests that do not support DPoP.

## `discover(options)`

```js
const config = await discover({ issuer: 'https://solidcommunity.net/' })
```

Fetches OIDC discovery metadata. Pass a Metro client with `client` when you want custom middleware or tests.

## `register(options)`

```js
const info = await register({
  registration_endpoint: config.registration_endpoint,
  client_info: {
    client_name: 'My Metro App',
    redirect_uris: [location.href]
  }
})
```

Performs dynamic client registration and returns client information. `oidcmw()` calls this automatically when no `client_info.client_id` is present and the issuer supports registration.

## ID token helpers

```js
const raw = idToken({ issuer: 'https://solidcommunity.net/' })
const claims = idTokenClaims({ issuer: 'https://solidcommunity.net/' })
```

Returns the stored raw ID token or validated claims. Pass the same `issuer` or `store` used by the middleware.

## `validateIdToken(idToken, options)`

```js
const validation = await validateIdToken(idToken, {
  issuer: config.issuer,
  client_id: clientInfo.client_id,
  jwks,
  openid_configuration: config,
  nonce
})
```

Validates the token signature and standard claims, including issuer, audience, expiry, required claims, and nonce.

## Store

```js
const store = oidcStore('https://solidcommunity.net/')
```

Creates a simple storage object backed by `localStorage` when available or memory otherwise.

## Test mock server

```js
import oidcmockserver from '@muze-nl/metro-oidc/testing'
```

The mock server exposes discovery metadata, dynamic client registration, JWKS, signed ID tokens, userinfo, and OAuth2-backed protected-resource behaviour for tests.
