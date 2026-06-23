# Metro OAuth2 middleware

[![Project stage: Experimental][project-stage-badge: Experimental]][project-stage-page]

The OAuth2 middleware allows a Metro client to fetch, store, refresh and apply OAuth2 access tokens automatically. It currently supports the client-side parts Metro needs most:

- authorization-code flow
- PKCE
- refresh-token flow
- client-credentials flow
- bearer and DPoP-style token types
- popup or full-page authorization callbacks

It intentionally does **not** support implicit flow or resource-owner-password flow.

## Recommended browser flow

For browser applications, prefer a public-client authorization-code flow with PKCE and **no client secret**:

```javascript
import metro from '@muze-nl/metro'
import oauth2 from '@muze-nl/metro-oauth2'

const client = metro.client('https://api.example.com')
	.with(oauth2.oauth2mw({
		site: 'https://issuer.example/',
		oauth2_configuration: {
			client_id: myClientId,
			token_endpoint_auth_method: 'none',
			authorization_endpoint: 'https://issuer.example/authorize',
			token_endpoint: 'https://issuer.example/token',
			redirect_uri: `${location.origin}/oauth2-callback.html`,
			scope: 'read write'
		}
	}))

const response = await client.get('/protected/')
```

PKCE is enabled by default. You can provide your own `code_verifier`, but normally you do not need to.

## Confidential/server clients

If you are using Metro in a server-side or otherwise confidential client, you may configure a client secret. The middleware supports these token endpoint authentication methods:

- `none`
- `client_secret_post`
- `client_secret_basic`

For backwards compatibility, if `client_secret` is present and no explicit method is configured, Metro uses `client_secret_post`. If there is no `client_secret`, Metro uses `none`.

```javascript
const client = metro.client('https://api.example.com')
	.with(oauth2.oauth2mw({
		oauth2_configuration: {
			client_id: myClientId,
			client_secret: myClientSecret,
			token_endpoint_auth_method: 'client_secret_basic',
			authorization_endpoint: 'https://issuer.example/authorize',
			token_endpoint: 'https://issuer.example/token',
			redirect_uri: 'https://server.example/oauth2/callback'
		}
	}))
```

Do not put a real client secret in browser code.

## Redirect handling

The OAuth2 server redirects the browser back to your `redirect_uri` with an authorization code and state. Metro stores the expected state and rejects callbacks with the wrong state.

To handle a full-page redirect:

```javascript
import oauth2 from '@muze-nl/metro-oauth2'

if (oauth2.isRedirected()) {
	const response = await client.get('/protected/')
}
```

## Popup authorization

For single-page applications, you can use the popup helper:

```javascript
import oauth2 from '@muze-nl/metro-oauth2'

const client = metro.client('https://api.example.com')
	.with(oauth2.oauth2mw({
		authorize_callback: oauth2.authorizePopup,
		oauth2_configuration: {
			client_id: myClientId,
			token_endpoint_auth_method: 'none',
			authorization_endpoint: 'https://issuer.example/authorize',
			token_endpoint: 'https://issuer.example/token',
			redirect_uri: `${location.origin}/oauth2-callback.html`
		}
	}))
```

Your callback page should call `popupHandleRedirect()` and then close itself:

```html
<script type="module">
	import oauth2 from '@muze-nl/metro-oauth2'
	oauth2.popupHandleRedirect()
	window.close()
</script>
```

The popup helper validates message origin and OAuth state before resolving the authorization code.

## Configuration

Top-level options:

- `authorize_callback` - function called with the authorization URL. It may redirect the page, open a popup, or return an authorization code. The default redirects the current page.
- `client` - base Metro client to use for token endpoint requests. Default is `metro.client()`.
- `force_authorization` - if `true`, every request uses OAuth2. If `false`, Metro first tries the request and authorizes only after an authentication failure. Default is `false`.
- `site` - identity-provider key used for token and state storage.
- `state` - Map-like state store. Defaults to localStorage when available.
- `tokens` - Map-like token store. Defaults to localStorage when available.
- `oauth2_configuration` - OAuth2 protocol settings.

`oauth2_configuration` options:

- `access_token` - existing access token, if already known.
- `authorization_code` - existing authorization code, if already known.
- `authorization_endpoint` - URL of the authorization endpoint.
- `client_id` - OAuth2 client id.
- `client_secret` - OAuth2 client secret for confidential clients only.
- `code_verifier` - PKCE code verifier. Defaults to a generated verifier; set to `false` to disable PKCE.
- `grant_type` - `authorization_code` or `client_credentials`.
- `redirect_uri` - redirect URL registered with the authorization server.
- `refresh_token` - existing refresh token.
- `scope` - requested scopes.
- `token_endpoint` - URL of the token endpoint.
- `token_endpoint_auth_method` - `none`, `client_secret_post`, or `client_secret_basic`.

## Token handling

Metro validates token responses before storing them:

- `access_token` is required.
- `token_type` is required.
- `Bearer` and `DPoP` token types are understood.
- `expires_in` is optional; when missing, expiry is treated as unknown.
- A refresh response may omit a new `refresh_token`; in that case the existing refresh token remains available.

When a resource server returns a Bearer/DPoP `WWW-Authenticate` challenge with `error="insufficient_scope"`, Metro surfaces the response instead of silently retrying authorization.

## OAuth2 mock-server middleware

The `oauth2mockserver` middleware implements a mock OAuth2 server for tests and examples. It does not call `fetch()` or `next()`, so no network requests are made. The mock server is exported from `@muze-nl/metro-oauth2/testing` rather than the production browser bundle.

```javascript
import metro from '@muze-nl/metro'
import oauth2 from '@muze-nl/metro-oauth2'
import oauth2mockserver from '@muze-nl/metro-oauth2/testing'

const client = metro.client('https://oauth2api.example.com')
	.with(oauth2mockserver())
	.with(oauth2.oauth2mw({
		oauth2_configuration: {
			client_id: 'mockClientId',
			client_secret: 'mockClientSecret',
			authorization_endpoint: '/authorize/',
			token_endpoint: '/token/',
			redirect_uri: 'https://client.example/callback'
		}
	}))
```

The mock server handles these paths:

- `/authorize/` - validates the authorization request and returns an authorization code.
- `/token/` - handles authorization-code, refresh-token, and client-credentials token requests.
- `/protected/` - requires an access token.
- `/insufficient-scope/` - returns an insufficient-scope challenge.
- `/public/` - does not require an access token.

Useful mock options include:

- `client_id`
- `client_secret`
- `redirect_uri`
- `requirePKCE`
- `issueRefreshToken`
- `includeExpiresIn`
- `acceptedAuthMethods`
- `token_type`

[project-stage-badge: Experimental]: https://img.shields.io/badge/Project%20Stage-Experimental-yellow.svg
[project-stage-page]: https://blog.pother.ca/project-stages/
