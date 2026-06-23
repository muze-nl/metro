import tap from 'tap'
import metro from '@muze-nl/metro'
import oidcDiscovery from '../src/oidc.discovery.mjs'
import oidcRegister from '../src/oidc.register.mjs'
import oidcmw, { idToken, idTokenClaims } from '../src/oidcmw.mjs'
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

function memoryStore() {
	const storeMap = new Map()
	return {
		get: name => storeMap.get(name),
		set: (name, value) => storeMap.set(name, value),
		has: name => storeMap.has(name)
	}
}

async function runOidcFlow(t, mockOptions = {}, middlewareOptions = {}) {
	const client = mockClient(mockOptions)
	const store = memoryStore()
	const oidcClient = client.with(oidcmw({
		client,
		issuer,
		store,
		use_dpop: false,
		client_info: {
			redirect_uris: [redirect_uri],
			client_name: 'Metro Test Client'
		},
		authorize_callback: url => authorizeWithMock(client, url),
		...middlewareOptions
	}))

	return {
		client,
		store,
		response: await oidcClient.get('/protected/')
	}
}

tap.test('OIDC mock server exposes discovery metadata', async t => {
	const client = mockClient()
	const config = await oidcDiscovery({ issuer, client })

	t.equal(config.issuer, issuer)
	t.equal(config.authorization_endpoint, `${issuer}authorize/`)
	t.equal(config.token_endpoint, `${issuer}token/`)
	t.equal(config.registration_endpoint, `${issuer}register/`)
	t.equal(config.jwks_uri, `${issuer}jwks/`)
	t.ok(config.scopes_supported.includes('openid'))
	t.ok(config.response_types_supported.includes('code'))
})

tap.test('OIDC mock server exposes a signing key through JWKS', async t => {
	const client = mockClient()
	const res = await client.get('/jwks/')
	const jwks = await res.json()

	t.ok(Array.isArray(jwks.keys))
	t.equal(jwks.keys.length, 1)
	t.equal(jwks.keys[0].kid, 'mock-signing-key')
	t.equal(jwks.keys[0].alg, 'RS256')
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


tap.test('OIDC dynamic client registration accepts public clients without a client_secret', async t => {
	const client = mockClient({ client_secret: null })
	const clientInfo = await oidcRegister({
		client,
		registration_endpoint: `${issuer}register/`,
		client_info: {
			redirect_uris: [redirect_uri],
			client_name: 'Metro Public Test Client'
		}
	})

	t.equal(clientInfo.client_id, 'mockClientId')
	t.notOk(clientInfo.client_secret)
	t.equal(clientInfo.token_endpoint_auth_method, 'none')
})

tap.test('oidcmw discovers, dynamically registers, authorizes, validates and stores the id_token', async t => {
	const { response, store } = await runOidcFlow(t)

	t.ok(response.ok)
	t.same(await response.json(), { result: 'Success' })
	t.type(idToken({ store }), 'string')
	t.match(idToken({ store }), /^ey/)
	t.match(idTokenClaims({ store }), {
		iss: issuer,
		sub: 'mockSubject',
		aud: 'mockClientId'
	})
	t.equal(idTokenClaims({ store }).nonce, store.get('pending_nonce'))
	t.ok(store.has('openid_configuration'))
	t.ok(store.has('client_info'))
})

tap.test('oidcmw rejects an id_token with the wrong issuer', async t => {
	await t.rejects(
		runOidcFlow(t, { idTokenClaims: { iss: 'https://other-issuer.example/' } }),
		/issuer|iss/i
	)
})

tap.test('oidcmw rejects an id_token with the wrong audience', async t => {
	await t.rejects(
		runOidcFlow(t, { idTokenClaims: { aud: 'otherClientId' } }),
		/audience|aud/i
	)
})

tap.test('oidcmw rejects an expired id_token', async t => {
	await t.rejects(
		runOidcFlow(t, { idTokenClaims: { exp: Math.floor(Date.now() / 1000) - 3600 } }),
		/expired|exp/i
	)
})

tap.test('oidcmw rejects an id_token with a nonce mismatch', async t => {
	await t.rejects(
		runOidcFlow(t, { idTokenClaims: { nonce: 'wrong-nonce' } }),
		/nonce/i
	)
})

tap.test('oidcmw rejects an id_token whose signing key is not in JWKS', async t => {
	await t.rejects(
		runOidcFlow(t, { publishSigningKey: false }),
		/key|jwks|signature/i
	)
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
