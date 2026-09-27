import tap from 'tap'
import metro from '@muze-nl/metro'
import dpopmw from '../src/oauth2.dpop.mjs'

const site = 'https://issuer.example/'

/**
 * An in-memory stand-in for the IndexedDB key store. There is deliberately
 * no localStorage: dpopmw must not need it.
 */
function useKeyStore(t)
{
	const keyPairs = new Map()
	const later = callback => setTimeout(callback, 0)
	const db = {
		transaction() {
			const tx = {}
			tx.objectStore = () => ({
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
	t.teardown(() => {
		delete globalThis.indexedDB
	})
}

function proofClaims(proof)
{
	const payload = proof.split('.')[1]
	return JSON.parse(Buffer.from(payload, 'base64url').toString())
}

/**
 * A server that answers the first request with the given nonce challenge
 * and later requests with 200, recording the proof of every request.
 */
function nonceServer(challenge)
{
	const proofs = []
	const client = metro.client(async req => {
		proofs.push(proofClaims(req.headers.get('DPoP')))
		if (proofs.length == 1) {
			return metro.response(challenge)
		}
		return metro.response({
			status: 200,
			headers: { 'DPoP-Nonce': 'nonce-2' },
			body: 'ok'
		})
	}).with(dpopmw({ site, token_endpoint: site + 'token' }))
	return { client, proofs }
}

tap.test('a resource that asks for a nonce gets the request again with that nonce', async t => {
	useKeyStore(t)
	const { client, proofs } = nonceServer({
		status: 401,
		headers: {
			'WWW-Authenticate': 'DPoP error="use_dpop_nonce", error_description="nonce required"',
			'DPoP-Nonce': 'nonce-1'
		},
		body: ''
	})

	const res = await client.get('https://pod.example/resource', {
		headers: { Authorization: 'DPoP boundToken' }
	})

	t.equal(res.status, 200)
	t.equal(proofs.length, 2)
	t.equal(proofs[0].nonce, undefined)
	t.equal(proofs[1].nonce, 'nonce-1')
})

tap.test('the token endpoint asking for a nonce gets the request again with that nonce', async t => {
	useKeyStore(t)
	const { client, proofs } = nonceServer({
		status: 400,
		headers: {
			'Content-Type': 'application/json',
			'DPoP-Nonce': 'nonce-1'
		},
		body: JSON.stringify({ error: 'use_dpop_nonce' })
	})

	const res = await client.post(site + 'token', { body: 'grant_type=refresh_token' })

	t.equal(res.status, 200)
	t.equal(proofs[1].nonce, 'nonce-1')
})

tap.test('later proofs for a server include its latest nonce', async t => {
	useKeyStore(t)
	const { client, proofs } = nonceServer({
		status: 401,
		headers: {
			'WWW-Authenticate': 'DPoP error="use_dpop_nonce"',
			'DPoP-Nonce': 'nonce-1'
		},
		body: ''
	})
	await client.get('https://pod.example/resource', {
		headers: { Authorization: 'DPoP boundToken' }
	})

	await client.get('https://pod.example/other', {
		headers: { Authorization: 'DPoP boundToken' }
	})

	t.equal(proofs[2].nonce, 'nonce-2')
})

tap.test('a 401 that does not ask for a nonce is not sent again', async t => {
	useKeyStore(t)
	const { client, proofs } = nonceServer({
		status: 401,
		headers: {
			'WWW-Authenticate': 'DPoP error="invalid_token"',
			'DPoP-Nonce': 'nonce-1'
		},
		body: ''
	})

	const res = await client.get('https://pod.example/resource', {
		headers: { Authorization: 'DPoP boundToken' }
	})

	t.equal(res.status, 401)
	t.equal(proofs.length, 1)
})
