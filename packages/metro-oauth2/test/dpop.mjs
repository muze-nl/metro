import tap from 'tap'
import metro from '@muze-nl/metro'
import dpopmw from '../src/oauth2.dpop.mjs'

const site = 'https://issuer.example/'

/**
 * dpopmw keeps its key pair in IndexedDB and DPoP nonces in localStorage,
 * which Node does not have. These in-memory stand-ins cover what it uses.
 */
function useBrowserStorage(t)
{
	const keyPairs = new Map()
	const later = callback => setTimeout(callback, 0)
	const objectStore = tx => ({
		put(value) {
			keyPairs.set(value.domain, value)
			later(() => tx.oncomplete?.())
		},
		get(key) {
			const request = {}
			later(() => {
				request.result = keyPairs.get(key)
				request.onsuccess?.()
			})
			return request
		}
	})
	const db = {
		transaction() {
			const tx = {}
			tx.objectStore = () => objectStore(tx)
			return tx
		}
	}
	globalThis.indexedDB = {
		open() {
			const request = { result: db }
			later(() => request.onsuccess?.({ target: request }))
			return request
		}
	}
	const items = new Map()
	globalThis.localStorage = {
		getItem: key => items.has(key) ? items.get(key) : null,
		setItem: (key, value) => items.set(key, String(value))
	}
	t.teardown(() => {
		delete globalThis.indexedDB
		delete globalThis.localStorage
	})
}

function resourceClient()
{
	const seen = {}
	const client = metro.client(async req => {
		seen.authorization = req.headers.get('Authorization')
		seen.dpop = req.headers.get('DPoP')
		return metro.response('ok')
	}).with(dpopmw({
		site,
		token_endpoint: site + 'token'
	}))
	return { client, seen }
}

tap.test('a DPoP-bound access token is sent with a DPoP proof', async t => {
	useBrowserStorage(t)
	const { client, seen } = resourceClient()

	await client.get('https://pod.example/resource', {
		headers: { Authorization: 'DPoP boundToken' }
	})

	t.equal(seen.authorization, 'DPoP boundToken')
	t.match(seen.dpop, /^ey/)
})

tap.test('a Bearer access token is sent unchanged, without a DPoP proof', async t => {
	useBrowserStorage(t)
	const { client, seen } = resourceClient()

	await client.get('https://pod.example/resource', {
		headers: { Authorization: 'Bearer plainToken' }
	})

	t.equal(seen.authorization, 'Bearer plainToken')
	t.equal(seen.dpop, null)
})

tap.test('other Authorization schemes are sent unchanged', async t => {
	useBrowserStorage(t)
	const { client, seen } = resourceClient()

	await client.get('https://other.example/resource', {
		headers: { Authorization: 'Basic dXNlcjpwYXNz' }
	})

	t.equal(seen.authorization, 'Basic dXNlcjpwYXNz')
	t.equal(seen.dpop, null)
})

tap.test('token endpoint requests get a DPoP proof', async t => {
	useBrowserStorage(t)
	const { client, seen } = resourceClient()

	await client.post(site + 'token', { body: 'grant_type=refresh_token' })

	t.match(seen.dpop, /^ey/)
})

tap.test('the proof names the request URI without its query and fragment', async t => {
	useBrowserStorage(t)
	const { client, seen } = resourceClient()

	await client.get('https://pod.example/container/?filter=notes#top', {
		headers: { Authorization: 'DPoP boundToken' }
	})

	const claims = JSON.parse(Buffer.from(seen.dpop.split('.')[1], 'base64url').toString())
	t.equal(claims.htu, 'https://pod.example/container/')
})
