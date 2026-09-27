import tap from 'tap'
import metro from '@muze-nl/metro'
import oidcmw, { idTokenClaims } from '../src/oidcmw.mjs'
import oidcmockserver from '../src/oidc.mockserver.mjs'

const issuer = 'https://issuer.example/'
const redirect_uri = 'https://client.example/callback'

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
 * Makes the stored access token expired, so the next request refreshes it.
 */
function expireAccessToken()
{
	const key = issuer + ':access_token'
	const token = JSON.parse(localStorage.getItem(key))
	token.expires = new Date(Date.now() - 1000)
	localStorage.setItem(key, JSON.stringify(token))
}

function oidcClient(mockOptions = {})
{
	const client = metro.client(issuer).with(oidcmockserver({
		issuer,
		redirect_uri,
		...mockOptions
	}))
	let logins = 0
	const api = client.with(oidcmw({
		client,
		issuer,
		use_dpop: false,
		client_info: {
			redirect_uris: [redirect_uri],
			client_name: 'Metro Test Client'
		},
		authorize_callback: async url => {
			logins++
			const res = await client.get(url)
			return (await res.json()).code
		}
	}))
	return { api, logins: () => logins }
}

tap.test('a refresh response without an id_token keeps the stored one', async t => {
	useLocalStorage(t)
	const { api, logins } = oidcClient({ refreshIdToken: false })
	t.ok((await api.get('/protected/')).ok)
	const loginClaims = idTokenClaims({ issuer })

	expireAccessToken()
	const res = await api.get('/protected/')

	t.ok(res.ok)
	t.equal(logins(), 1, 'refreshed without a new login')
	t.same(idTokenClaims({ issuer }), loginClaims)
})

tap.test('a refreshed id_token without a nonce is accepted', async t => {
	useLocalStorage(t)
	const { api, logins } = oidcClient()
	t.ok((await api.get('/protected/')).ok)

	expireAccessToken()
	const res = await api.get('/protected/')

	t.ok(res.ok)
	t.equal(logins(), 1, 'refreshed without a new login')
	t.equal(idTokenClaims({ issuer }).nonce, undefined)
})
