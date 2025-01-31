# Metro OpenID Connect middleware

[![Project stage: Experimental][project-stage-badge: Experimental]][project-stage-page]

The OpenID Connect middleware allows you to configure a [metro client](https://github.com/muze-nl/metro) to handle authorization and authentication using OpenID Connect:

```javascript
import oidcmw from '@muze-nl/metro-oidc'

const client = metro.client('https://oauth2api.example.com')
.with( oidcmw({
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

The OIDC middleware will automatically discover the configuration of the issuer, as well as do a dynamic client registration, if you haven't set a `client_info.client_id`.
It will then configure the correct OAuth2 settings and handle the request with [metro oauth2](https://github.com/muze-nl/metro-oauth2) middleware. It may redirect the browser to let the user login with the OIDC issuer. You can skip the automatic configuration step, if you provide the `openid_configuration` parameter set yourself. If you don't, the oidcmw middleware will only run the discovery process once, and store the information in localStorage. The same with the client_info and dynamic registration.

## Security features

metro.oidc uses OAuth2.1 by default, including PKCE and DPoP. The Keypair used in DPoP is created non-extractable, so they cannot be leaked. This means that the access_token and refresh_token, even if leaked, cannot be used anywhere else.

You can disable PKCE by setting `options.client_info.code_verifier` to false.
You can disable DPoP by setting `options.use_dpop` to false.

## id_token

The metro oidc middleware doesn't use the id_token, or verify any of its contents. This is left up to you, if you need it. You can retrieve the id_token by calling the `idToken` function, after the user is logged in:

```javascript
	import oidc from '@muze-nl/metro-oidc'

	let id_token = oidc.idToken()
```

[project-stage-badge: Experimental]: https://img.shields.io/badge/Project%20Stage-Experimental-yellow.svg
[project-stage-page]: https://blog.pother.ca/project-stages/
