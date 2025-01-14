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
It will then configure the correct OAuth2 settings and handle the request with [metro oauth2](https://github.com/muze-nl/metro-oauth2) middleware. It may redirect the browser to let the user login with the OIDC issuer. You can skip the automatic configuration step, if you provide the `openid_configuration` parameter set yourself, the oidcmw middleware will only do this once, and store the information in localStorage. The same with the client_info.

## Security features

metro.oidc uses OAuth2.1 by default, including PKCE and DPoP. The Keypair used in DPoP is created non-extractable, so they cannot be leaked. This means that the access_token and refresh_token, even if leaked, cannot be used anywhere else.

You can disable PCKE by setting `options.client_info.code_verifier` to false.
You can disable DPoP by setting `options.use_dpop` to false.
