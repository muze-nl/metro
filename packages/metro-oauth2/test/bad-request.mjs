import tap from 'tap'
import metro from '@muze-nl/metro'
import oauth2mw from '../src/oauth2.mjs'
import oauth2mockserver from '../src/oauth2.mockserver.mjs'

const redirect_uri = 'https://client.example/callback'

/**
 * A mock issuer whose /bad/ resource answers 400 with the given headers,
 * counting logins and refreshes.
 */
function api(badRequestHeaders = {}, configuration = {})
{
	const counts = { logins: 0, refreshes: 0 }
	const badResource = async (req, next) => {
		if (req.url.endsWith('/bad/')) {
			return metro.response({
				status: 400,
				headers: badRequestHeaders,
				body: 'malformed turtle'
			})
		}
		if (req.url.endsWith('/token/')) {
			const body = await req.clone().text()
			if (body.includes('grant_type=refresh_token')) {
				counts.refreshes++
			}
		}
		return next(req)
	}
	const client = metro.client()
		.with(oauth2mockserver({ redirect_uri }))
		.with(badResource)
	const authorized = client.with(oauth2mw({
		client,
		site: `test-${Math.random()}`,
		force_authorization: configuration.force_authorization,
		oauth2_configuration: {
			client_id: 'mockClientId',
			client_secret: 'mockClientSecret',
			grant_type: 'authorization_code',
			authorization_endpoint: '/authorize/',
			token_endpoint: '/token/',
			redirect_uri,
			...configuration.oauth2_configuration
		},
		authorize_callback: async url => {
			counts.logins++
			const res = await client.get(url)
			return (await res.json()).code
		}
	}))
	return { authorized, counts }
}

tap.test('a plain 400 does not start a login', async t => {
	const { authorized, counts } = api()

	const res = await authorized.put('/bad/', { body: 'not turtle' })

	t.equal(res.status, 400)
	t.equal(counts.logins, 0)
})

tap.test('a plain 400 with a valid token does not refresh it', async t => {
	const { authorized, counts } = api({}, {
		force_authorization: true,
		oauth2_configuration: {
			access_token: { type: 'Bearer', value: 'mockAccessToken', expires: new Date(Date.now() + 60_000) },
			refresh_token: { value: 'mockRefreshToken' }
		}
	})

	const res = await authorized.put('/bad/', { body: 'not turtle' })

	t.equal(res.status, 400)
	t.equal(counts.refreshes, 0)
})

tap.test('a 400 whose challenge says the token is invalid does refresh it', async t => {
	const { authorized, counts } = api({
		'WWW-Authenticate': 'Bearer error="invalid_token"'
	}, {
		force_authorization: true,
		oauth2_configuration: {
			access_token: { type: 'Bearer', value: 'mockAccessToken', expires: new Date(Date.now() + 60_000) },
			refresh_token: { value: 'mockRefreshToken' }
		}
	})

	await authorized.put('/bad/', { body: 'not turtle' })

	t.equal(counts.refreshes, 1)
})
