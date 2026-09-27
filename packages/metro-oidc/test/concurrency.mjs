import tap from 'tap'
import metro from '@muze-nl/metro'
import oidcmw from '../src/oidcmw.mjs'
import oidcmockserver from '../src/oidc.mockserver.mjs'

const issuer = 'https://issuer.example/'
const redirect_uri = 'https://client.example/callback'

/**
 * A mock issuer that counts client registrations.
 */
function countingClient()
{
	const counts = { registrations: 0 }
	const countRegistrations = async (req, next) => {
		if (req.method == 'POST' && req.url.endsWith('/register/')) {
			counts.registrations++
		}
		return next(req)
	}
	const client = metro.client(issuer)
		.with(oidcmockserver({ issuer, redirect_uri }))
		.with(countRegistrations)
	return { client, counts }
}

function oidcOptions(client, overrides = {})
{
	return {
		client,
		issuer,
		use_dpop: false,
		client_info: {
			redirect_uris: [redirect_uri],
			client_name: 'Metro Test Client'
		},
		authorize_callback: url => authorizeWithMock(client, url),
		...overrides
	}
}

async function authorizeWithMock(client, url)
{
	const res = await client.get(url)
	return (await res.json()).code
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

tap.test('concurrent first requests register the client once', async t => {
	useLocalStorage(t)
	const { client, counts } = countingClient()
	const api = client.with(oidcmw(oidcOptions(client)))

	const responses = await Promise.all([
		api.get('/protected/'),
		api.get('/protected/')
	])

	t.ok(responses.every(res => res.ok))
	t.equal(counts.registrations, 1)
})

tap.test('a request waiting for a login does not replace its nonce', async t => {
	useLocalStorage(t)
	const { client } = countingClient()
	let releaseLogin
	const loginStarted = new Promise(resolve => {
		releaseLogin = resolve
	})
	const api = client.with(oidcmw(oidcOptions(client, {
		authorize_callback: async url => {
			await loginStarted
			return authorizeWithMock(client, url)
		}
	})))

	const first = api.get('/protected/')
	await new Promise(resolve => setTimeout(resolve, 20))
	const second = api.get('/protected/')
	await new Promise(resolve => setTimeout(resolve, 20))
	releaseLogin()

	const responses = await Promise.all([first, second])
	t.ok(responses.every(res => res.ok))
})

tap.test('the first request after a login redirect keeps the nonce of that login', async t => {
	useLocalStorage(t)
	globalThis.history = { pushState() {} }
	t.teardown(() => {
		delete globalThis.window
		delete globalThis.history
	})
	const { client } = countingClient()

	// page one: the login redirects the browser to the issuer
	let authorizationUrl
	const beforeRedirect = client.with(oidcmw(oidcOptions(client, {
		authorize_callback: async url => {
			authorizationUrl = url
			return false
		}
	})))
	await t.rejects(beforeRedirect.get('/protected/'), /authorization was not completed/)

	// the issuer redirects back with a code
	const code = await authorizeWithMock(client, authorizationUrl)
	const state = authorizationUrl.searchParams.get('state')
	globalThis.window = {
		location: new URL(redirect_uri + '?code=' + code + '&state=' + state)
	}

	// page two: a new page load exchanges the code
	const afterRedirect = client.with(oidcmw(oidcOptions(client, {
		authorize_callback: async () => {
			throw new Error('no second login expected')
		}
	})))
	const res = await afterRedirect.get('/protected/')

	t.ok(res.ok)
})
