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

Adds OpenID Connect authorization to a Metro client. By default it tries the request first and authorizes after a `401` or `403`. Set `force_authorization: true` to authorize immediately. `oidcmw()` checks the status of the response itself, so add middleware that turns responses into errors or data, such as `thrower()` and `getdata()`, after it: `client.with(oidcmw(options)).with(thrower())`.

Important options: `issuer`, `client_info`, `webid`, `login_hint`, `expected_claims`, `client`, `openid_configuration`, `oauth2`, `store`, `scope`, `nonce`, `use_dpop`, `force_authorization`, and `authorize_callback`.

`use_dpop` defaults to `true`. Disable it only for providers or tests that do not support DPoP.

### Which user

Tokens are stored per issuer. To keep different users at the same issuer apart, tell `oidcmw()` which user it acts for:

- `webid`: the user's WebID. It is sent to the issuer as `login_hint`, and the ID token's `webid` claim must match it. Older Solid issuers without a `webid` claim are matched on `sub`.
- `login_hint`: without a WebID, a hint for the issuer about which user should log in.
- `expected_claims`: without a WebID, claims the ID token must contain, e.g. `{ sub: '…' }`.

With `webid` or `login_hint`, tokens and the ID token are stored for that user only, so logging in as another user never reuses them. An ID token for a different user than expected is refused and not stored, even when the issuer still has a login session for that other user. Pass the same `webid` or `login_hint` to `idToken()` and `idTokenClaims()`.

## `discover(options)`

```js
const config = await discover({ issuer: 'https://solidcommunity.net/' })
```

Fetches OIDC discovery metadata. Pass a Metro client with `client` when you want custom middleware or tests.

The metadata must be for the requested issuer (only a trailing slash may differ), must contain `authorization_endpoint`, `token_endpoint` and `jwks_uri`, and the issuer and all its endpoints must use `https`. Plain `http` is only accepted on the local machine (`localhost`, `127.0.0.1`, `[::1]`). These checks always run; the complete metadata schema is only checked when assertions are enabled.

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

Returns the stored raw ID token or validated claims. Pass the same `issuer` and `webid` or `login_hint`, or the same `store`, used by the middleware.

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
