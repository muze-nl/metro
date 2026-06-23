# Metro Oauth2 middleware

[![Project stage: Experimental][project-stage-badge: Experimental]][project-stage-page]

The Oauth2 middleware allows you to configure the metro client to handle OAuth2 connections, fetching and refreshing tokens automatically:

```javascript
import oauth2mw from '@muze-nl/metro-oauth2'
const client = metro.client('https://oauth2api.example.com')
.with( oauth2mw({
	client_id: myClientId,
	client_secret: myClientSecret
}) )

function fetchSomething(url) {
	return client.get(url)
}
````

You pass the OAuth2 configuration options to the `oauth2mw()` function. This returns the middleware function for the metro client.

The oauth2 protocol can redirect the browser page to the oauth2 servers login page. When logged in, the browser is then redirected back to your clients `redirect_uri`, with the `authorization_code` either in the URL's search query, or in its fragment or hash. The `redirect_uri` is set to your `document.location.href` by default, but you can override this if you want to.

To handle this redirect, use the provided `isRedirected` function like this:

```javascript
import oauth2mw, {isRedirected} from '@muze-nl/metro-oauth2'

const client = metro.client('https://oauth2api.example.com')
.with( oauth2mw({
	client_id: myClientId,
	client_secret: myClientSecret
}) )

function fetchMovies() {
	return client.get('movies.ttl')
}

if (isRedirected()) {
	movies = await fetchMovies()
}
```

If your application calls the fetchMovies() function, and the browser is redirected to allow the user to login, then, when the browser is redirected back to your application, the isRedirected() function will return true. Now the user is logged in, so the fetchMovies() call will succeed.

This does mean that your application will reload and lose its state. That is often undesirable, so you can opt to create your own authorize_callback function, that could open a new tab to log the user in, and then close it and return the authorization_code as a Promise instead. Since this is so common, this function is provided for you as `authorizePopup`:

```javascript
import oauth2mw, {authorizePopup} from '@muze-nl/metro-oauth2'

const client = metro.client('https://oauth2api.example.com')
.with( oauth2mw({
	authorize_callback: authorizePopup,
	client_id: myClientId,
	client_secret: myClientSecret
}) )
````

However, it does require that you create a separate page as your `redirect_uri`, that will send the authorization_code to your application, e.g.:

```html
<script src="metro-oidc/dist/browser.js"></script>
<script>
	metro.oauth2.popupHandleRedirect()
	window.close()
</script>
```

You can also use an iframe to show the login screen of and OAuth2 Provider, however, not all providers allow their login screens to be shown inside an iframe. However, if they do, use something like this as your `authorize_callback`:

```javascript
	function authorizeIframe(authorizeURL) {
		return new Promise((resolve, reject) => {
			window.addEventListener('message', (event) => {
				if (event.data.authorization_code) {
					resolve(event.data.authorization_code)
				} else {
					reject('Error: '.event.data.error)
				}
				document.getElementById('authorize').close()
			})
			document.getElementById('authorizeIframe').src=authorizeURL
			document.getElementById('authorize').showModal()
		})
	}
```

This code assumes you have a dialog and iframe like this:

```html
<dialog id="authorize">
	<iframe id="authorizeIframe"></iframe>
</dialog>
```

You can still use the same redirect page as for `authorizePopup`, it will automatically determine it is running in an iframe instead of a new window.

## Configuration

Valid configuration options are:
- `authorize_callback` - Allows you to set a callback function for the `authorize` step, e.g. by doing a full page redirect or using a new window. The callback function takes one parameter, the authorization URL to use and can optionally return a Promise with the `authorization_code`. By default this redirects the current page to the authorize URL.
- `client` - sets the base metro client to use by the OAuth2 middleware. Default is a clean `metro.client()`.
- `force_authorization` - if not set or `false`, the OAuth2 middleware will only use OAuth2 if a normal--unauthorized--fetch doesn't work. If set to `true`, all requests will use OAuth2. Default value is `false`.
- `site` - URL of the identity provider, used to store token specific for that provider
- `state` - How to store the state parameter, defaults to `localStorage`
- `tokens` - How to store tokens. Either a normal object, or a Map-like object.
- `oauth2_configuration` - OAuth2 standard parameters
	- `access_token` - if you've stored an OAuth2 access token, you can set it here
	- `authorization_code` - if you've retrieved an OAuth2 authorization code, set it here
	- `client_id` - the OAuth2 client id
	- `client_secret` - the OAuth2 client secret
	- `code_verifier` - the PKCE code verifier, code_challenge is automatically calculated
	- `grant_type` - currently only `authorization_code` is implemented
	- `redirect_uri` - The URL the OAuth2 authorization server will redirect back to
	- `refresh_token` - sets the refresh token to use when the access token must be refreshed
	- `token_endpoint` - URL of the access and refresh token endpoint
	- `authorization_endpoint` - URL of the authorize endpoint

## Defaults

Only the `client_id` and `client_secret` don't have valid defaults. The defaults are:

- `grant_type`: `authorization_code`
- `force_authorization`: false
- `redirect_uri`: `document.location`
- `state`:`localStorage`
- `tokens`: `localStorage`
- `client`: `metro.client().with(jsonmw())`
- `authorize_callback`: `url => document.location = url`
- `authorization_endpoint`: `/authorize`
- `token_endpoint`: `/token`

## OAuth2 Mock-server Middleware

The `oauth2mockserver` middleware implements a mock of an OAuth2 server for tests and examples. It does not call `fetch()` or `next()`, so no network requests are made. Instead it parses the request and implements OAuth2 authorization-code, refresh-token, and client-credentials test flows. The mock server is intentionally exported from `@muze-nl/metro-oauth2/testing` rather than the production browser bundle.

```javascript
import oauth2mw from '@muze-nl/metro-oauth2'
import oauth2mockserver from '@muze-nl/metro-oauth2/testing'
const client = metro.client('https://oauth2api.example.com')
	.with( oauth2mockserver() )
	.with( oauth2mw({
		client_id: 'mockClientId',
		client_secret: 'mockClientSecret'
	}))
```

The `oauth2mock` server handles requests with the following pathnames--regardless of the domain used.

- `/authorize/` - returns an authorization_code
- `/token/` - returns an access_token
- `/protected/` - requires an access_token, or returns 401 Forbidden
- `/public/` - doesn't require an access_token

Any other requests will return a 404 Not Found response.

The OAuth2 mock server expects/provides the following values for the OAuth2 settings:

- `client_id`: `mockClientId`
- `client_secret`: `mockClientSecret`
- `authorization_code`: `mockAuthorizeToken`
- `refresh_token`: `mockRefreshToken`
- `access_token`: `mockAccessToken`

[project-stage-badge: Experimental]: https://img.shields.io/badge/Project%20Stage-Experimental-yellow.svg
[project-stage-page]: https://blog.pother.ca/project-stages/
