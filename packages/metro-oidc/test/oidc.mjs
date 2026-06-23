import tap from 'tap'
import metro from '@muze-nl/metro'
import oidcDiscovery from '../src/oidc.discovery.mjs'
import oidcRegister from '../src/oidc.register.mjs'
import oidcmw, { idToken } from '../src/oidcmw.mjs'
import oidcmockserver from '../src/oidc.mockserver.mjs'

const issuer = 'https://issuer.example/'
const redirect_uri = 'https://client.example/callback'

function mockClient(options = {}) {
	return metro.client(issuer).with(oidcmockserver({ issuer, redirect_uri, ...options }))
}

async function authorizeWithMock(client, authorizationUrl) {
	const res = await client.get(authorizationUrl)
	if (!res.ok) {
		throw new Error(await res.text())
	}
	const body = await res.json()
	return body.code
}

tap.test('OIDC mock server exposes discovery metadata', async t => {
	const client = mockClient()
	const config = await oidcDiscovery({ issuer, client })

	t.equal(config.issuer, issuer)
	t.equal(config.authorization_endpoint, `${issuer}authorize/`)
	t.equal(config.token_endpoint, `${issuer}token/`)
	t.equal(config.registration_endpoint, `${issuer}register/`)
	t.ok(config.scopes_supported.includes('openid'))
	t.ok(config.response_types_supported.includes('code'))
})

tap.test('OIDC mock server supports dynamic client registration', async t => {
	const client = mockClient()
	const clientInfo = await oidcRegister({
		client,
		registration_endpoint: `${issuer}register/`,
		client_info: {
			redirect_uris: [redirect_uri],
			client_name: 'Metro Test Client'
		}
	})

	t.equal(clientInfo.client_id, 'mockClientId')
	t.equal(clientInfo.client_secret, 'mockClientSecret')
	t.same(clientInfo.redirect_uris, [redirect_uri])
})

tap.test('oidcmw discovers, dynamically registers, authorizes and stores the id_token', async t => {
	const client = mockClient()
	const storeMap = new Map()
	const store = {
		get: name => storeMap.get(name),
		set: (name, value) => storeMap.set(name, value),
		has: name => storeMap.has(name)
	}
	const oidcClient = client.with(oidcmw({
		client,
		issuer,
		store,
		use_dpop: false,
		client_info: {
			redirect_uris: [redirect_uri],
			client_name: 'Metro Test Client'
		},
		authorize_callback: url => authorizeWithMock(client, url)
	}))

	const res = await oidcClient.get('/protected/')
	t.ok(res.ok)
	t.same(await res.json(), { result: 'Success' })
	t.equal(idToken({ store }), 'mockHeader.mockPayload.mockSignature')
	t.ok(store.has('openid_configuration'))
	t.ok(store.has('client_info'))
})

tap.test('OIDC userinfo endpoint requires the access token', async t => {
	const client = mockClient()
	let res = await client.get('/userinfo/')
	t.equal(res.status, 401)

	res = await client.get('/userinfo/', {
		headers: {
			Authorization: 'Bearer mockAccessToken'
		}
	})
	t.ok(res.ok)
	t.match(await res.json(), {
		sub: 'mockSubject',
		name: 'Mock User'
	})
})
