import tap from 'tap'
import metro from '@muze-nl/metro'
import oauth2mw from '../src/oauth2.mjs'
import oauth2mockserver from '../src/oauth2.mockserver.mjs'
import {
	base64url_encode,
	createState,
	generateCodeChallenge,
	getExpires,
	isExpired,
	parseBearerChallenge
} from '../src/oauth2.mjs'

const redirect_uri = 'https://client.example/callback'

function mockClient(options = {}) {
	return metro.client().with(oauth2mockserver({ redirect_uri, ...options }))
}

async function authorizeWithMock(client, authorizationUrl) {
	const res = await client.get(authorizationUrl)
	if (!res.ok) {
		throw new Error(await res.text())
	}
	const body = await res.json()
	return body.code
}

function oauth2Options(client, options = {}) {
	return {
		client,
		site: `test-${Math.random()}`,
		force_authorization: options.force_authorization,
		oauth2_configuration: {
			client_id: 'mockClientId',
			client_secret: 'mockClientSecret',
			grant_type: 'authorization_code',
			authorization_endpoint: '/authorize/',
			token_endpoint: '/token/',
			redirect_uri,
			...options.oauth2_configuration
		},
		authorize_callback: Object.hasOwn(options, 'authorize_callback')
			? options.authorize_callback
			: (url => authorizeWithMock(client, url))
	}
}

tap.test('mock server allows public requests', async t => {
	const client = mockClient()
	const res = await client.get('/public/')
	t.ok(res.ok)
	t.same(await res.json(), { result: 'Success' })
})

tap.test('mock server rejects protected resource without a bearer token', async t => {
	const client = mockClient()
	const res = await client.get('/protected/')
	t.equal(res.status, 401)
	t.match(res.headers.get('WWW-Authenticate'), /Bearer/)
})

tap.test('mock server validates authorization request shape', async t => {
	const client = mockClient()
	const res = await client.get('/authorize/', {
		searchParams: {
			client_id: 'mockClientId',
			redirect_uri,
			state: 'state'
		}
	})
	t.equal(res.status, 400)
	t.match(await res.json(), {
		error: 'invalid_request',
		error_description: /response_type is required/
	})
})

tap.test('authorization code flow gets an access token and retries the protected request', async t => {
	const client = mockClient()
	const oauth2client = client.with(oauth2mw(oauth2Options(client)))

	const res = await oauth2client.get('/protected/')
	t.ok(res.ok)
	t.same(await res.json(), { result: 'Success' })
})

tap.test('oauth2 middleware lets downstream errors propagate unchanged', async t => {
	const client = mockClient()
	const expected = new Error('downstream network failure')
	const throwingMiddleware = async () => {
		throw expected
	}
	const oauth2client = client.with(throwingMiddleware, oauth2mw(oauth2Options(client)))

	await t.rejects(oauth2client.get('/protected/'), expected)
})

tap.test('authorization URL does not expose client_secret', async t => {
	const client = mockClient()
	let seenAuthorizationUrl
	const oauth2client = client.with(oauth2mw(oauth2Options(client, {
		authorize_callback: async url => {
			seenAuthorizationUrl = url
			return authorizeWithMock(client, url)
		}
	})))

	const res = await oauth2client.get('/protected/')
	t.ok(res.ok)
	t.notOk(seenAuthorizationUrl.searchParams.has('client_secret'))
})

tap.test('authorization code flow uses PKCE and the mock server validates the verifier', async t => {
	const client = mockClient({ requirePKCE: true })
	let seenAuthorizationUrl
	const oauth2client = client.with(oauth2mw(oauth2Options(client, {
		oauth2_configuration: {
			code_verifier: '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-._~'
		},
		authorize_callback: async url => {
			seenAuthorizationUrl = url
			return authorizeWithMock(client, url)
		}
	})))

	const res = await oauth2client.get('/protected/')
	t.ok(res.ok)
	t.equal(seenAuthorizationUrl.searchParams.get('code_challenge_method'), 'S256')
	t.ok(seenAuthorizationUrl.searchParams.get('code_challenge'))
})

tap.test('authorization callback object validates state before accepting the code', async t => {
	const client = mockClient()
	const oauth2client = client.with(oauth2mw(oauth2Options(client, {
		authorize_callback: async url => {
			const res = await client.get(url)
			const body = await res.json()
			return { authorization_code: body.code, state: 'wrong-state' }
		}
	})))

	await t.rejects(oauth2client.get('/protected/'), /state mismatch/)
})

tap.test('mock server rejects a token request with a reused authorization code', async t => {
	const client = mockClient()
	const authURL = metro.url('/authorize/', {
		searchParams: {
			response_type: 'code',
			client_id: 'mockClientId',
			redirect_uri,
			state: 'state'
		}
	})
	const code = await authorizeWithMock(client, authURL)
	const body = new URLSearchParams({
		grant_type: 'authorization_code',
		client_id: 'mockClientId',
		client_secret: 'mockClientSecret',
		redirect_uri,
		code
	})

	let res = await client.post('/token/', { body })
	t.ok(res.ok)
	res = await client.post('/token/', { body })
	t.equal(res.status, 400)
	t.match(await res.json(), {
		error: 'invalid_grant',
		error_description: /already used/
	})
})

tap.test('refresh token flow replaces an expired access token', async t => {
	const client = mockClient()
	const oauth2client = client.with(oauth2mw(oauth2Options(client, {
		oauth2_configuration: {
			access_token: {
				type: 'Bearer',
				value: 'expiredAccessToken',
				expires: new Date(Date.now() - 1000)
			},
			refresh_token: { value: 'mockRefreshToken' }
		},
		force_authorization: true
	})))

	const res = await oauth2client.get('/protected/')
	t.ok(res.ok)
	t.same(await res.json(), { result: 'Success' })
})

tap.test('refresh token flow succeeds when the refresh response omits a replacement refresh_token', async t => {
	const client = mockClient({ issueRefreshToken: false })
	const oauth2client = client.with(oauth2mw(oauth2Options(client, {
		oauth2_configuration: {
			access_token: {
				type: 'Bearer',
				value: 'expiredAccessToken',
				expires: new Date(Date.now() - 1000)
			},
			refresh_token: { value: 'mockRefreshToken' }
		},
		force_authorization: true
	})))

	const res = await oauth2client.get('/protected/')
	t.ok(res.ok)
	t.same(await res.json(), { result: 'Success' })
})

tap.test('client credentials grant can fetch a token without an authorization callback', async t => {
	const client = mockClient()
	const oauth2client = client.with(oauth2mw(oauth2Options(client, {
		oauth2_configuration: {
			grant_type: 'client_credentials',
			code_verifier: false
		},
		authorize_callback: null,
		force_authorization: true
	})))

	const res = await oauth2client.get('/protected/')
	t.ok(res.ok)
	t.same(await res.json(), { result: 'Success' })
})

tap.test('client credentials grant supports client_secret_basic', async t => {
	const client = mockClient({ acceptedAuthMethods: ['client_secret_basic'] })
	const oauth2client = client.with(oauth2mw(oauth2Options(client, {
		oauth2_configuration: {
			grant_type: 'client_credentials',
			code_verifier: false,
			token_endpoint_auth_method: 'client_secret_basic'
		},
		authorize_callback: null,
		force_authorization: true
	})))

	const res = await oauth2client.get('/protected/')
	t.ok(res.ok)
	t.same(await res.json(), { result: 'Success' })
})

tap.test('authorization code flow supports public clients with token_endpoint_auth_method none', async t => {
	const client = mockClient({ client_secret: null })
	const oauth2client = client.with(oauth2mw(oauth2Options(client, {
		oauth2_configuration: {
			client_secret: undefined,
			token_endpoint_auth_method: 'none'
		}
	})))

	const res = await oauth2client.get('/protected/')
	t.ok(res.ok)
	t.same(await res.json(), { result: 'Success' })
})

tap.test('token endpoint rejects invalid client credentials', async t => {
	const client = mockClient()
	const res = await client.post('/token/', {
		body: new URLSearchParams({
			grant_type: 'client_credentials',
			client_id: 'mockClientId',
			client_secret: 'wrongSecret'
		})
	})

	t.equal(res.status, 401)
	t.match(await res.json(), {
		error: 'invalid_client',
		error_description: /client_secret/
	})
})

tap.test('token response without expires_in is accepted as non-expiring/unknown expiry', async t => {
	const client = mockClient({ includeExpiresIn: false })
	const oauth2client = client.with(oauth2mw(oauth2Options(client)))

	const res = await oauth2client.get('/protected/')
	t.ok(res.ok)
	t.same(await res.json(), { result: 'Success' })
})

tap.test('token response without access_token is rejected', async t => {
	const client = mockClient({ access_token: null })
	const oauth2client = client.with(oauth2mw(oauth2Options(client)))

	await t.rejects(oauth2client.get('/protected/'), /access_token/)
})

tap.test('token response without token_type is rejected', async t => {
	const client = mockClient({ token_type: null })
	const oauth2client = client.with(oauth2mw(oauth2Options(client)))

	await t.rejects(oauth2client.get('/protected/'), /token_type/)
})

tap.test('unsupported token_type is rejected', async t => {
	const client = mockClient({ token_type: 'MAC' })
	const oauth2client = client.with(oauth2mw(oauth2Options(client)))

	await t.rejects(oauth2client.get('/protected/'), /unsupported token_type/)
})

tap.test('Bearer insufficient_scope challenge does not trigger authorization retry', async t => {
	const client = mockClient()
	let authorized = false
	const oauth2client = client.with(oauth2mw(oauth2Options(client, {
		authorize_callback: async url => {
			authorized = true
			return authorizeWithMock(client, url)
		}
	})))

	const res = await oauth2client.get('/insufficient-scope/')
	t.equal(res.status, 403)
	t.notOk(authorized)
})

tap.test('generateCodeChallenge returns the expected S256 PKCE challenge', async t => {
	const codeVerifier = 'cdZvUojBXlScjLcNBGOwCvNGh2tm8oeHM7-a9KKod4MmMYny7waTqzMybbECDZWjsJpctl5YbMwGVQZqwx7yHg'
	const expectedCodeChallenge = 'AO8-0vf7_QrAqD_sITyMmjggKHkJwu95c8zsqXCiwFI'

	t.equal(await generateCodeChallenge(codeVerifier), expectedCodeChallenge)
})

tap.test('oauth2 utility functions keep their basic contracts', async t => {
	const future = getExpires(60)
	const past = new Date(Date.now() - 1000)

	t.ok(future instanceof Date)
	t.notOk(isExpired({ expires: future, value: 'token' }))
	t.ok(isExpired({ expires: past, value: 'token' }))
	t.notOk(isExpired({ value: 'token' }))
	t.ok(isExpired(null))
	t.match(createState(40), /^[A-Za-z0-9_-]{40}$/)
	t.equal(base64url_encode(new Uint8Array([251, 255, 254])), '-__-')
})

tap.test('parseBearerChallenge parses Bearer and DPoP authentication challenges', async t => {
	t.same(parseBearerChallenge('Bearer realm="mock", error="invalid_token", error_description="bad token"'), {
		scheme: 'Bearer',
		realm: 'mock',
		error: 'invalid_token',
		error_description: 'bad token'
	})
	t.same(parseBearerChallenge('DPoP realm="mock", error="insufficient_scope"'), {
		scheme: 'DPoP',
		realm: 'mock',
		error: 'insufficient_scope'
	})
	t.equal(parseBearerChallenge('Basic realm="mock"'), null)
})

tap.test('production browser export keeps the mock server out of the default API', async t => {
	const oauth2 = await import('@muze-nl/metro-oauth2')
	t.notOk(oauth2.default.mockserver)
	t.type(oauth2.default.dpopmw, 'function')
})

tap.test('testing entry exports the OAuth2 mock server explicitly', async t => {
	const testing = await import('@muze-nl/metro-oauth2/testing')
	t.type(testing.default, 'function')
	t.type(testing.oauth2mockserver, 'function')
})
