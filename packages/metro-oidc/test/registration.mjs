import tap from 'tap'
import metro from '@muze-nl/metro'
import oidcmw from '../src/oidcmw.mjs'
import oidcmockserver from '../src/oidc.mockserver.mjs'

const issuer = 'https://issuer.example/'
const redirect_uri = 'https://client.example/callback'

function memoryStore()
{
	const items = new Map()
	return {
		get: name => items.get(name),
		set: (name, value) => items.set(name, value),
		has: name => items.has(name)
	}
}

/**
 * Logs in at a mock issuer, recording the registration request and the
 * token requests.
 */
async function login(mockOptions = {})
{
	const seen = { registration: null, tokenRequests: [] }
	const record = async (req, next) => {
		if (req.url.endsWith('/register/')) {
			seen.registration = JSON.parse(await req.clone().text())
		}
		if (req.url.endsWith('/token/')) {
			seen.tokenRequests.push(new URLSearchParams(await req.clone().text()))
		}
		return next(req)
	}
	const client = metro.client(issuer)
		.with(oidcmockserver({ issuer, redirect_uri, ...mockOptions }))
		.with(record)
	const store = memoryStore()
	const api = client.with(oidcmw({
		client,
		issuer,
		store,
		use_dpop: false,
		client_info: {
			redirect_uris: [redirect_uri],
			client_name: 'Metro Test Client'
		},
		authorize_callback: async url => {
			const res = await client.get(url)
			return (await res.json()).code
		}
	}))
	const response = await api.get('/protected/')
	return { response, seen, clientInfo: store.get('client_info') }
}

tap.test('the client registers as a public client with the refresh grant', async t => {
	const { seen } = await login()

	t.equal(seen.registration.token_endpoint_auth_method, 'none')
	t.same(seen.registration.grant_types, ['authorization_code', 'refresh_token'])
	t.same(seen.registration.response_types, ['code'])
})

tap.test('a public client stores no secret and sends none', async t => {
	const { response, seen, clientInfo } = await login({ client_secret: null })

	t.ok(response.ok)
	t.equal(clientInfo.client_secret, undefined)
	t.equal(seen.tokenRequests[0].get('client_secret'), null)
	t.equal(seen.tokenRequests[0].get('client_id'), 'mockClientId')
})

tap.test('the registered authentication method is used when the issuer insists on a secret', async t => {
	const { response, seen, clientInfo } = await login()

	t.ok(response.ok)
	t.equal(clientInfo.token_endpoint_auth_method, 'client_secret_post')
	t.equal(seen.tokenRequests[0].get('client_secret'), 'mockClientSecret')
})
