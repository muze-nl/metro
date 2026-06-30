---
title: 'Reference'
---
# @muze-nl/metro-oauth2 reference

```js
import oauth2, {
  oauth2mw,
  dpopmw,
  discover,
  authorizePopup,
  popupHandleRedirect,
  tokenStore,
  keysStore,
  isRedirected,
  isAuthorized,
  parseBearerChallenge
} from '@muze-nl/metro-oauth2'
```

## `oauth2mw(options)`

```js
const api = client('https://resource.example/')
  .with(oauth2mw({
    site: 'https://issuer.example/',
    oauth2_configuration: {
      client_id: 'my-client-id',
      token_endpoint_auth_method: 'none',
      grant_type: 'authorization_code',
      response_type: 'code',
      authorization_endpoint: 'https://issuer.example/authorize',
      token_endpoint: 'https://issuer.example/token',
      redirect_uri: location.href,
      scope: 'profile'
    }
  }))
```

Adds OAuth2 authorization to a Metro client. By default it first tries the request, then starts authorization if the response is `401` or `403`. Set `force_authorization: true` to authorize before the request.

Important options: `site`, `client`, `authorize_callback`, `force_authorization`, `state`, `tokens`, and `oauth2_configuration`.

`oauth2_configuration` may include `access_token`, `authorization_code`, `authorization_endpoint`, `client_id`, `client_secret`, `code_verifier`, `grant_type`, `redirect_uri`, `refresh_token`, `scope`, `token_endpoint`, and `token_endpoint_auth_method`.

Do not put a real client secret in browser code.

## PKCE helpers

```js
const verifier = oauth2.generateCodeVerifier()
const challenge = await oauth2.generateCodeChallenge(verifier)
```

Also exported: `base64url_encode(buffer)`, `createState(length)`, `getExpires(duration)`, and `isExpired(token)`.

## Token and state checks

```js
if (isRedirected()) {
  // The current URL looks like an OAuth2 redirect callback.
}

if (isAuthorized(tokens)) {
  // Stored tokens contain a usable access token.
}
```

`parseBearerChallenge(value)` parses `WWW-Authenticate` Bearer/DPoP challenges.

<a name="popup-flow"></a>
## Popup flow

```js
const api = client('https://resource.example/')
  .with(oauth2mw({
    authorize_callback: authorizePopup,
    oauth2_configuration: {
      client_id: 'my-client-id',
      token_endpoint_auth_method: 'none',
      authorization_endpoint: 'https://issuer.example/authorize',
      token_endpoint: 'https://issuer.example/token',
      redirect_uri: `${location.origin}/oauth2-callback.html`
    }
  }))
```

Callback page:

```html
<script type="module">
  import { popupHandleRedirect } from '@muze-nl/metro-oauth2'
  popupHandleRedirect()
  window.close()
</script>
```

## `dpopmw(options)`

```js
const api = client('https://resource.example/')
  .with(dpopmw({
    site: 'https://issuer.example/',
    authorization_endpoint: 'https://issuer.example/authorize',
    token_endpoint: 'https://issuer.example/token'
  }))
```

Adds DPoP support for requests that carry OAuth tokens. OIDC uses this by default because Solid identity and storage servers commonly require sender-constrained tokens.

## Stores

```js
const tokens = tokenStore('https://issuer.example/')
const keys = keysStore()
```

The default stores use `localStorage` when available and fall back to memory where implemented.

## Discovery

```js
const oauthClient = discover({ issuer: 'https://issuer.example/' })
```

Creates a discovery-capable helper for OAuth authorization server metadata.

## Test mock server

```js
import oauth2mockserver from '@muze-nl/metro-oauth2/testing'
```

The mock server is for tests and examples, not production browser bundles.
