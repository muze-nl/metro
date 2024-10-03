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
````

You pass the OAuth2 configuration options to the `oauth2mw()` function. This returns the middleware function for the metro client.

## Configuration

Valid configuration options are:

- `access_token` - if you've stored an OAuth2 access token, you can set it here
- `authorization_code` - if you've retrieved an OAuth2 authorization code, set it here
- `refresh_token` - sets the refresh token to use when the access token must be refreshed
- `client` - sets the base metro client to use by the OAuth2 middleware
- `client_id` - the OAuth2 client id
- `client_secret` - the OAuth2 client secret
- `grant_type` - currently only `authorization_code` is implemented
- `force_authorization` - if not set or `false`, the OAuth2 middleware will only use OAuth2 if a normal--unauthorized--fetch doesn't work. If set to `true`, all requests will use OAuth2.
- `redirect_uri` - The URL the OAuth2 authorization server will redirect back to
- `state` - How to store the state parameter, defaults to `localStorage`
- `tokens` - How to store tokens. Either a normal object, or a Map-like object.
- `endpoints` - Allows you to set the specific OAuth2 endpoints for `authorization` and getting the access token (`token`)
- `callbacks` - Allows you to set a callback function for the `authorize` step, e.g. by doing a full page redirect or using a new window. The callback function takes one parameter, the authorization URL to use.

## Defaults

Only the `client_id` and `client_secret` don't have valid defaults. The defaults are:

- `grant_type`: `authorization_code`
- `force_authorization`: false
- `redirect_uri`: `document.location`
- `state`:`localStorage`
- `tokens`: `localStorage`
- `client`: `metro.client().with(jsonmw())`
- `callbacks.authorize`: `url => document.location = url`
- `endpoints.authorize`: `/authorize`
- `endpoints.token`: `/token`

## OAuth2 Mock-server Middleware

The `oauth2mockserver` middleware implements a mock of an OAuth2 server. It doesn't actually call `fetch()` or `next()`, so no network requests are made. Instead it parses the request and implements a very basic OAuth2 authorization_code flow.

```javascript
import oauth2mw from '@muze-nl/metro-oauth2'
import oauth2mockserver from '@muze-nl/metro-auth2/src/oauth2.mockserver.mjs'
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

