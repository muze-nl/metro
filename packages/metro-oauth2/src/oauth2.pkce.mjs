import * as metro from '../metro.mjs'
import * as assert from '../assert.mjs'

export default function mwOAuth2PKCE(options)
{
	let code_challenge

	let pkce = {
		code_verifier: '',
		endpoints: {
			authorize: '/authorize',
			token: '/token'
		}
	}

	if (options?.endpoints?.authorize) {
		pkce.endpoints.authorize = options.endpoints.authorize
	}

	if (options?.endpoints?.token) {
		pkce.endpoints.token = options.endpoints.token
	}

	if (options.code_verifier) {
		pkce.code_verifier = options.code_verifier
	} else {
		// TODO: allow code_verifier to be saved
		pkce.code_verifier = crypto.randomBytes(64).toString('hex');
	}

	return async function(req, next) {
		// check if req needs to be altered with code_verifier or code_challenge
		req.url = metro.url(req.url)
		if (req.url.pathname == pkce.endpoints.authorize) {
			req.url.searchParams.set('code_challenge', generateCodeChallenge(options.code_verifier))
			req.url.searchParams.set('code_challend_method', 'S256');
			req.url.searchParams.delete('client_secret')
		} else if (req.url.pathname == pkce.endpoints.token) {
			req.url.searchParams.set('code_verifier', pkce.code_verifier)
			req.url.searchParams.delete('client_secret')
		}
		return await next(req)
	}

	/**
	 * Returns a PKCE code_challenge derived from a code_verifier
	 */
	async function generateCodeChallenge(code_verifier) {
		return await globalThis.crypto.subtle.digest('SHA-256', base64url_encode(code_verifier))
	}

	/**
	 * Base64url encoding, which handles UTF-8 input strings correctly.
	 */
	function base64url_encode(buffer) {
		const byteString = Array.from(new Uint8Array(buffer), b => String.fromCharCode(b)).join('')
	    return btoa(byteString)
	        .replace(/\+/g, '-')
	        .replace(/\//g, '_')
	        .replace(/=+$/, '');
	}
}