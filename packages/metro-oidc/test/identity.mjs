import tap from 'tap'
import metro from '@muze-nl/metro'
import oidcmw, { idTokenClaims } from '../src/oidcmw.mjs'
import oidcmockserver from '../src/oidc.mockserver.mjs'

const issuer = 'https://issuer.example/'
const redirect_uri = 'https://client.example/callback'
const alice = 'https://alice.example/profile/card#me'
const bob = 'https://bob.example/profile/card#me'

/**
 * Tokens persist in localStorage in the browser. The tests install an
 * in-memory stand-in so a second login can find what the first one stored.
 */
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

/**
 * Logs in at the mock issuer. The issuer answers with idTokenClaims, which
 * lets a test play an issuer whose session belongs to someone else.
 */
async function login(options)
{
	const client = metro.client(issuer).with(oidcmockserver({
		issuer,
		redirect_uri,
		idTokenClaims: options.idTokenClaims ?? {}
	}))
	const authorizations = []
	const oidcClient = client.with(oidcmw({
		client,
		issuer,
		use_dpop: false,
		client_info: {
			redirect_uris: [redirect_uri],
			client_name: 'Metro Test Client'
		},
		authorize_callback: async url => {
			authorizations.push(url)
			const res = await client.get(url)
			return (await res.json()).code
		},
		...options.oidc
	}))
	const response = await oidcClient.get('/protected/')
	return { response, authorizations }
}

tap.test('a login for another WebID at the same issuer does not reuse tokens', async t => {
	useLocalStorage(t)
	const first = await login({
		idTokenClaims: { webid: alice },
		oidc: { webid: alice }
	})
	t.ok(first.response.ok)

	const second = login({
		idTokenClaims: { webid: alice },
		oidc: { webid: bob }
	})

	await t.rejects(second, /different user/)
})

tap.test('a login for another WebID starts a new authorization', async t => {
	useLocalStorage(t)
	await login({
		idTokenClaims: { webid: alice },
		oidc: { webid: alice }
	})

	const second = await login({
		idTokenClaims: { webid: bob },
		oidc: { webid: bob }
	})

	t.ok(second.response.ok)
	t.equal(second.authorizations.length, 1)
	t.equal(idTokenClaims({ issuer, webid: bob }).webid, bob)
	t.equal(idTokenClaims({ issuer, webid: alice }).webid, alice)
})

tap.test('the WebID is sent to the issuer as login_hint', async t => {
	const { authorizations } = await login({
		idTokenClaims: { webid: alice },
		oidc: { webid: alice }
	})

	t.equal(authorizations[0].searchParams.get('login_hint'), alice)
})

tap.test('a WebID in sub is accepted when the id_token has no webid claim', async t => {
	const { response } = await login({
		idTokenClaims: { sub: alice },
		oidc: { webid: alice }
	})

	t.ok(response.ok)
})

tap.test('expected_claims identify the user without a WebID', async t => {
	const accepted = await login({
		oidc: {
			login_hint: 'mockSubject',
			expected_claims: { sub: 'mockSubject' }
		}
	})
	t.ok(accepted.response.ok)
	t.equal(accepted.authorizations[0].searchParams.get('login_hint'), 'mockSubject')

	await t.rejects(login({
		oidc: { expected_claims: { sub: 'someoneElse' } }
	}), /different user/)
})
