import tap from 'tap'
import metro from '@muze-nl/metro'
import oauth2mw from '../src/oauth2.mjs'
import oauth2mockserver from '../src/oauth2.mockserver.mjs'

const redirect_uri = 'https://client.example/callback'

/**
 * A client for a mock issuer that issues tokens of issuedType, using
 * oauth2mw configured to require requiredType.
 */
function api(issuedType, requiredType, extraConfiguration = {})
{
	const client = metro.client().with(oauth2mockserver({
		redirect_uri,
		token_type: issuedType
	}))
	return client.with(oauth2mw({
		client,
		site: `test-${Math.random()}`,
		force_authorization: true,
		oauth2_configuration: {
			client_id: 'mockClientId',
			client_secret: 'mockClientSecret',
			grant_type: 'authorization_code',
			authorization_endpoint: '/authorize/',
			token_endpoint: '/token/',
			redirect_uri,
			token_type: requiredType,
			...extraConfiguration
		},
		authorize_callback: async url => {
			const res = await client.get(url)
			return (await res.json()).code
		}
	}))
}

tap.test('a Bearer token is refused when DPoP is required', async t => {
	await t.rejects(api('Bearer', 'DPoP').get('/protected/'),
		/returned a Bearer token, but DPoP is required/)
})

tap.test('a DPoP token is accepted when DPoP is required', async t => {
	const res = await api('DPoP', 'DPoP').get('/protected/')
	t.ok(res.ok)
})

tap.test('a refresh that returns a Bearer token is refused when DPoP is required', async t => {
	const refreshing = api('Bearer', 'DPoP', {
		access_token: {
			type: 'DPoP',
			value: 'expiredAccessToken',
			expires: new Date(Date.now() - 1000)
		},
		refresh_token: { value: 'mockRefreshToken' }
	})
	await t.rejects(refreshing.get('/protected/'), /but DPoP is required/)
})

tap.test('Bearer tokens are accepted when no token type is required', async t => {
	const res = await api('Bearer', undefined).get('/protected/')
	t.ok(res.ok)
})
