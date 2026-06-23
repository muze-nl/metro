# Metro OpenID Connect middleware

[![Project stage: Experimental][project-stage-badge: Experimental]][project-stage-page]

The OpenID Connect middleware allows you to configure a [metro client](https://github.com/muze-nl/metro) to handle authorization and authentication using OpenID Connect:

```javascript
import oidc from '@muze-nl/metro-oidc'

const client = metro.client('https://oauth2api.example.com')
.with( oidc.oidcmw({
	client_info: {
		client_name: 'My Client',
		redirect_uris: [
			'https://www.example.com/my_app.html'
		]
	},
	issuer: 'https://solidcommunity.net/'
}) )

async function fetchMovies() {
	return await client.get('https://example.solidcommunity.net/movies/')
}
````

_Note_: If your client has more than 1 possible `redirect_uri`, all will be used to register that client, but the first one will be used for this session. So make sure to put the `redirect_uri` you want to use now at `redirect_uris[0]``.

The OIDC middleware will automatically discover the configuration of the issuer, as well as do a dynamic client registration, if you haven't set a `client_info.client_id`.
It will then configure the correct OAuth2 settings and handle the request with [metro oauth2](https://github.com/muze-nl/metro-oauth2) middleware. It may redirect the browser to let the user login with the OIDC issuer. You can skip the automatic configuration step, if you provide the `openid_configuration` parameter set yourself. If you don't, the oidcmw middleware will only run the discovery process once, and store the information in localStorage. The same with the client_info and dynamic registration.

## Security features

metro.oidc uses the OAuth2 authorization-code flow with PKCE and DPoP by default. DPoP is part of the normal OIDC middleware path because Solid identity and storage servers commonly require sender-constrained tokens. The key pair used for DPoP is created non-extractable where the runtime supports that.

You can disable PKCE by setting `options.client_info.code_verifier` to false.
You can disable DPoP by setting `options.use_dpop` to false, but this is mainly useful for providers or tests that do not support DPoP.

## id_token

The metro OIDC middleware validates the `id_token` before storing it. Validation uses the issuer JWKS and checks the token signature, issuer, audience, expiry, required claims, and nonce. You can retrieve the raw `id_token` or the validated claims after the user is logged in:

```javascript
	import oidc from '@muze-nl/metro-oidc'

	let id_token = oidc.idToken({issuer:"oidc issuer url"})
	let claims = oidc.idTokenClaims({issuer:"oidc issuer url"})
```

`idToken()` expects either the store or the issuer option that you passed on to the `oidcmw()` function.


[project-stage-badge: Experimental]: https://img.shields.io/badge/Project%20Stage-Experimental-yellow.svg
[project-stage-page]: https://blog.pother.ca/project-stages/

## OIDC Mock-server Middleware

The OIDC mock server is intended for tests and examples, not for production browser bundles. Import it from the explicit testing entry:

```javascript
import oidcmockserver from '@muze-nl/metro-oidc/testing'
```

The mock server exposes discovery metadata, dynamic client registration, JWKS, signed ID Tokens, userinfo, and OAuth2-backed protected-resource behavior.
