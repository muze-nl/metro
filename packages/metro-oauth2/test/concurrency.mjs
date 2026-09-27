import tap from 'tap'
import metro from '@muze-nl/metro'
import oauth2mw from '../src/oauth2.mjs'
import oauth2mockserver from '../src/oauth2.mockserver.mjs'

const redirect_uri = 'https://client.example/callback'

/**
 * A mock issuer that counts refresh token exchanges, so tests can check
 * how often concurrent requests refreshed.
 */
function countingClient()
{
	const counts = { refresh: 0 }
	const countRefreshes = async (req, next) => {
		if (req.url.endsWith('/token/')) {
			const body = await req.clone().text()
			if (body.includes('grant_type=refresh_token')) {
				counts.refresh++
			}
		}
		return next(req)
	}
	const client = metro.client()
		.with(oauth2mockserver({ redirect_uri }))
		.with(countRefreshes)
	return { client, counts }
}

function options(client, site, accessToken)
{
	return {
		client,
		site,
		force_authorization: true,
		oauth2_configuration: {
			client_id: 'mockClientId',
			client_secret: 'mockClientSecret',
			grant_type: 'authorization_code',
			authorization_endpoint: '/authorize/',
			token_endpoint: '/token/',
			redirect_uri,
			access_token: accessToken,
			refresh_token: { value: 'mockRefreshToken' }
		},
		authorize_callback: async () => {
			throw new Error('no authorization expected')
		}
	}
}

function expiredToken()
{
	return {
		type: 'Bearer',
		value: 'expiredAccessToken',
		expires: new Date(Date.now() - 1000)
	}
}

function useLocalStorage(t)
{
	const items = new Map()
	globalThis.localStorage = {
		getItem: key => items.has(key) ? items.get(key) : null,
		setItem: (key, value) => items.set(key, String(value)),
		removeItem: key => items.delete(key)
	}
	t.teardown(() => {
		delete globalThis.localStorage
	})
}

tap.test('concurrent requests share one refresh', async t => {
	const { client, counts } = countingClient()
	const site = `test-${Math.random()}`
	const api = client.with(oauth2mw(options(client, site, expiredToken())))

	const responses = await Promise.all([
		api.get('/protected/'),
		api.get('/protected/')
	])

	t.ok(responses.every(res => res.ok))
	t.equal(counts.refresh, 1)
})

tap.test('middleware instances for one site share one refresh', async t => {
	useLocalStorage(t)
	const { client, counts } = countingClient()
	const site = `test-${Math.random()}`
	const first = client.with(oauth2mw(options(client, site, expiredToken())))
	const second = client.with(oauth2mw(options(client, site, expiredToken())))

	const responses = await Promise.all([
		first.get('/protected/'),
		second.get('/protected/')
	])

	t.ok(responses.every(res => res.ok))
	t.equal(counts.refresh, 1)
})

tap.test('a rejected token is refreshed once for concurrent requests', async t => {
	const { client, counts } = countingClient()
	const site = `test-${Math.random()}`
	const staleToken = {
		type: 'Bearer',
		value: 'staleAccessToken',
		expires: new Date(Date.now() + 60_000)
	}
	const api = client.with(oauth2mw(options(client, site, staleToken)))

	const responses = await Promise.all([
		api.get('/protected/'),
		api.get('/protected/')
	])

	t.ok(responses.every(res => res.ok))
	t.equal(counts.refresh, 1)
})
