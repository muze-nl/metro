import tap from 'tap'
import metro from '@muze-nl/metro'
import oauth2mw, { isRedirected } from '../src/oauth2.mjs'
import oauth2mockserver from '../src/oauth2.mockserver.mjs'

const redirect_uri = 'https://client.example/callback'
const issuer = 'https://issuer.example/'

/**
 * Logs in with an authorize_callback that returns the full authorization
 * response, with the given iss, as the popup flow does.
 */
function login(responseIss, oauth2_configuration = {})
{
	const client = metro.client().with(oauth2mockserver({ redirect_uri }))
	const api = client.with(oauth2mw({
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
			issuer,
			...oauth2_configuration
		},
		authorize_callback: async url => {
			const res = await client.get(url)
			return {
				authorization_code: (await res.json()).code,
				state: url.searchParams.get('state'),
				iss: responseIss
			}
		}
	}))
	return api.get('/protected/')
}

tap.test('an authorization response from the expected issuer is accepted', async t => {
	const res = await login(issuer)
	t.ok(res.ok)
})

tap.test('an authorization response from another issuer is refused', async t => {
	await t.rejects(login('https://evil.example/'),
		/authorization response is from issuer https:\/\/evil\.example\/, expected https:\/\/issuer\.example\//)
})

tap.test('a missing iss is refused when the issuer always sends it', async t => {
	await t.rejects(login(undefined, {
		authorization_response_iss_parameter_supported: true
	}), /missing iss/)
})

tap.test('a missing iss is accepted from issuers that do not send it', async t => {
	const res = await login(undefined)
	t.ok(res.ok)
})

tap.test('iss is checked for redirect logins as well', async t => {
	globalThis.window = {
		location: new URL(redirect_uri + '?code=someCode&state=someState&iss=https%3A%2F%2Fevil.example%2F')
	}
	globalThis.history = { pushState() {} }
	t.teardown(() => {
		delete globalThis.window
		delete globalThis.history
	})

	await t.rejects(login(issuer), /from issuer https:\/\/evil\.example\//)
})

tap.test('ordinary application URLs are not authorization redirects', async t => {
	t.teardown(() => {
		delete globalThis.window
		delete globalThis.document
		delete globalThis.history
	})
	for (const suffix of [
		'#webid=https%3A%2F%2Falice.example%2Fcard%23me',
		'#route?webid=https%3A%2F%2Falice.example%2Fcard%23me',
		'#section',
		'?webid=https%3A%2F%2Falice.example%2Fcard%23me',
		'?iss=https%3A%2F%2Fissuer.example%2F#section'
	]) {
		const location = new URL(redirect_uri + suffix)
		globalThis.window = { location }
		globalThis.document = { location }
		let historyChanges = 0
		globalThis.history = { pushState() { historyChanges += 1 } }
		const tokens = new Map([['access_token', {
			value: 'mockAccessToken', type: 'Bearer',
			expires: new Date(Date.now() + 3600000)
		}]])
		const client = metro.client().with(oauth2mockserver({ redirect_uri }))
		const api = client.with(oauth2mw({
			client, tokens, force_authorization: true,
			oauth2_configuration: {
				client_id: 'mockClientId',
				authorization_endpoint: '/authorize/', token_endpoint: '/token/',
				redirect_uri, issuer,
				authorization_response_iss_parameter_supported: true
			},
			authorize_callback() {
				t.fail('An application URL must not start authorization')
			}
		}))
		t.equal(isRedirected(), false, suffix)
		t.ok((await api.get('/protected/')).ok, suffix)
		t.equal(historyChanges, 0, 'The application URL is not consumed')
		t.equal(window.location.href, redirect_uri + suffix)
		t.equal(tokens.has('authorization_code'), false)
	}
})

// RFC 6749 sections 4.1.2/4.1.2.1 identify code/error responses. RFC 9207
// sections 2.4/3 govern issuer validation separately from callback detection.
tap.test('page redirects preserve optional issuer support and strict validation', async t => {
	t.teardown(() => {
		delete globalThis.window
		delete globalThis.document
		delete globalThis.history
	})
	const cases = [
		{ name: 'optional issuer omitted' },
		{ name: 'explicitly unsupported issuer omitted', supported: false },
		{ name: 'matching issuer', iss: issuer },
		{ name: 'required issuer present', supported: true, iss: issuer },
		{ name: 'required issuer missing', supported: true, error: /missing iss/ },
		{ name: 'required issuer empty', supported: true, iss: '', error: /missing iss/ },
		{ name: 'wrong issuer', iss: 'https://evil.example/', error: /from issuer/ },
		{ name: 'wrong state without issuer', wrongState: true, error: /state mismatch/ },
		{ name: 'wrong state with issuer', iss: issuer, wrongState: true, error: /state mismatch/ },
		{ name: 'denied without issuer', denied: true, error: /authorization failed: access_denied/ },
		{ name: 'denied with required issuer', denied: true, supported: true, iss: issuer,
			error: /authorization failed: access_denied/ },
		{ name: 'denied missing required issuer', denied: true, supported: true,
			error: /missing iss/ },
		{ name: 'denied wrong issuer', denied: true, iss: 'https://evil.example/',
			error: /from issuer/ }
	]
	for (const separator of ['?', '#']) {
		for (const scenario of cases) {
			await t.test(separator + ' ' + scenario.name, async t => {
				let storedState
				let authorizations = 0
				let exchanges = 0
				let historyChanges = 0
				const tokens = new Map()
				const state = {
					get: () => storedState,
					set: value => { storedState = value }
				}
				globalThis.window = { location: new URL(redirect_uri) }
				globalThis.document = { get location() { return window.location } }
				globalThis.history = { pushState(_state, _title, url) {
					historyChanges += 1
					window.location = new URL(url)
				} }
				const client = metro.client().with(oauth2mockserver({ redirect_uri }))
				const observed = client.with((req, next) => {
					if (new URL(req.url).pathname === '/token/') {
						exchanges += 1
					}
					return next(req)
				})
				const options = {
					client: observed, state, tokens, force_authorization: true,
					oauth2_configuration: {
						client_id: 'mockClientId', client_secret: 'mockClientSecret',
						authorization_endpoint: '/authorize/', token_endpoint: '/token/',
						redirect_uri, issuer,
						authorization_response_iss_parameter_supported: scenario.supported
					},
					authorize_callback: async url => {
						authorizations += 1
						const response = await observed.get(url)
						const params = new URLSearchParams({
							state: scenario.wrongState ? 'wrong' : url.searchParams.get('state')
						})
						if (scenario.denied) {
							params.set('error', 'access_denied')
						}
						else {
							params.set('code', (await response.json()).code)
						}
						if (scenario.iss !== undefined) {
							params.set('iss', scenario.iss)
						}
						window.location = new URL(redirect_uri + separator + params)
						return false
					}
				}
				await t.rejects(observed.with(oauth2mw(options)).get('/protected/'),
					{ code: 'authorization_not_completed' })
				t.equal(isRedirected(), true, 'callback is recognized before validation')
				// A new middleware instance represents returning to the client page.
				const resumed = observed.with(oauth2mw(options))
				if (scenario.error) {
					await t.rejects(resumed.get('/protected/'), scenario.error)
					t.equal(exchanges, 0, 'invalid/denied responses never redeem a code')
					t.equal(tokens.has('access_token'), false)
				}
				else {
					t.equal((await resumed.get('/protected/')).status, 200)
					t.equal(exchanges, 1, 'the code is exchanged once')
				}
				t.equal(authorizations, 1, 'returning does not start another login')
				t.equal(historyChanges, 1)
			})
		}
	}
})
