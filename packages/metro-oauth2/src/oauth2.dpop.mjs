import * as metro from '@muze-nl/metro-core'
import * as DPoP from 'dpop'
import { assert, Required, Optional, validURL } from '@muze-nl/assert'
import keysStore from './keysstore.mjs'
import { parseBearerChallenge } from './oauth2.mjs'

/**
 * The latest DPoP-Nonce each server sent, by origin. Nonces are short-lived
 * and specific to a server, so they are kept in memory and shared by all
 * dpopmw instances.
 */
const serverNonces = new Map()

export default function dpopmw(options) {

	assert(options, {
		site: Required(validURL),
		token_endpoint: Required(validURL),
		dpop_signing_alg_values_supported: Optional([]) // this property is unfortunately rarely supported
	})

	/**
	 * Sends the request with a DPoP proof when it needs one. When the server
	 * asks for a nonce (use_dpop_nonce), the request is sent once more with a
	 * proof that includes the nonce it supplied (RFC 9449 sections 8 and 9).
	 */
	return async (req, next) => {
		const keyPair = await keyPairFor(options.site)
		const origin = metro.url(req.url).origin
		let res = await next(await withProof(req, keyPair))
		rememberNonce(origin, res)
		if (needsProof(req) && await asksForNonce(res)) {
			res = await next(await withProof(req, keyPair))
			rememberNonce(origin, res)
		}
		return res
	}

	function needsProof(req)
	{
		return req.url.startsWith(options.token_endpoint)
			|| isDPoPAuthorization(req.headers.get('Authorization'))
	}

	/**
	 * Token endpoint requests get a proof, so the issuer binds the tokens to
	 * this key. Requests with a DPoP-bound access token get a proof with the
	 * token's hash. Bearer tokens, and Authorization headers for other
	 * schemes, are sent unchanged.
	 */
	async function withProof(req, keyPair)
	{
		if (!needsProof(req)) {
			return req
		}
		const nonce = serverNonces.get(metro.url(req.url).origin)
		const htu = targetURI(req.url)
		if (req.url.startsWith(options.token_endpoint)) {
			const proof = await DPoP.generateProof(keyPair, htu, req.method, nonce)
			return req.with({
				headers: {
					'DPoP': proof
				}
			})
		}
		const accessToken = req.headers.get('Authorization').split(' ')[1]
		const proof = await DPoP.generateProof(keyPair, htu, req.method, nonce, accessToken)
		return req.with({
			headers: {
				'Authorization': 'DPoP '+accessToken,
				'DPoP': proof
			}
		})
	}
}

/**
 * Returns the DPoP key pair for a site, creating it the first time. The key
 * is not extractable, so a script on the page cannot copy it.
 */
async function keyPairFor(site)
{
	const keys = await keysStore()
	let keyInfo = await keys.get(site)
	if (!keyInfo) {
		// FIXME fetch from dpop_signing_alg_values_supported
		// which is unfortunately not available usually
		const keyPair = await DPoP.generateKeyPair('ES256')
		keyInfo = { domain: site, keyPair }
		await keys.set(keyInfo)
	}
	return keyInfo.keyPair
}

/**
 * The htu claim of a proof is the request URI without its query and
 * fragment (RFC 9449 section 4.2).
 */
function targetURI(url)
{
	const target = new URL(url)
	target.search = ''
	target.hash = ''
	return target.href
}

function rememberNonce(origin, res)
{
	const nonce = res.headers.get('DPoP-Nonce')
	if (nonce) {
		serverNonces.set(origin, nonce)
	}
}

/**
 * A resource server asks for a nonce with a 401 DPoP challenge, the token
 * endpoint with a 400 error response; both include a DPoP-Nonce header.
 */
async function asksForNonce(res)
{
	if (!res.headers.get('DPoP-Nonce')) {
		return false
	}
	if (res.status == 401) {
		const challenge = parseBearerChallenge(res.headers.get('WWW-Authenticate'))
		return challenge?.error == 'use_dpop_nonce'
	}
	if (res.status == 400) {
		const body = await res.clone().json().catch(() => null)
		return body?.error == 'use_dpop_nonce'
	}
	return false
}

function isDPoPAuthorization(value)
{
	return /^DPoP\s/i.test(value || '')
}
