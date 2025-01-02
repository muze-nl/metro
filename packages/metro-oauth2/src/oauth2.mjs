import * as metro from '@muze-nl/metro'
import { assert, Required, Optional, validURL, instanceOf } from '@muze-nl/assert'
import jsonmw from '@muze-nl/metro/src/mw/json.mjs'
import thrower from '@muze-nl/metro/src/mw/thrower.mjs'
import {tokenStore} from './tokenstore.mjs'

/**
 * oauth2mw returns a middleware for @muze-nl/metro that
 * implements oauth2 authentication in the metro client.
 * it supports the authorization_code, refresh_token and
 * client_credentials grant_type.
 * Since implicit flow is deemed insecure, it is not supported
 * This library follows the OAuth2.1 RFC - https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-11)
 * Referenced as Oauth2.1 RFC from here on
 */

export default function mwOAuth2(options) {

	const defaultOptions = {
		client: metro.client(),
		force_authorization: false,
		site: 'default',
		oauth2_configuration: {
			authorization_endpoint: '/authorize',
			token_endpoint: '/token',
			redirect_uri: globalThis.document?.location.href,
			grant_type: 'authorization_code',
			code_verifier: pkce.generateCodeVerifier(64)
		},
		callbacks: {
			authorize: url => document.location = url
		}
	}

	assert(options, {})	

	const oauth2 = Object.assign({}, defaultOptions.oauth2_configuration, options?.oauth2_configuration)
	options = Object.assign({}, defaultOptions, options)
	options.oauth2_configuration = oauth2

	const store = tokenStore(options.site)
	if (!options.tokens) {
		options.tokens = store.tokens
	}
	if (!options.state) {
		options.state = store.state
	}

	assert(options, {
		oauth2_configuration: {
			client_id: Required(),
			grant_type: 'authorization_code',
			authorization_endpoint: Required(),
			token_endpoint: Required(),
			redirect_uri: Required(validURL)
		}
	})

	for (let option in oauth2) {
		switch(option) {
			case 'access_token':
			case 'authorization_code':
			case 'refresh_token':
				options.tokens.set(option, oauth2[option])
			break
		}
	}

	/**
	 * This is the middleware function. It will intercept a request, and if needed
	 * go through the OAuth2 authorization flow first.
	 */
	return async function(req, next) {
		if (options.force_authorization) {
			return oauth2authorized(req, next)
		}
		let res = await next(req)
		if (res.ok) {
			return res
		}
		switch(res.status) { 
			case 400: // Oauth2.1 RFC 3.2.4
			case 401: // in case of incorrect authentication method
				//FIXME: check payload of response as well? yes - may be able to recover
				//FIXME: using thrower this needs a try/catch somewhere
				return oauth2authorized(req, next)
			break
		}
		return res
	}

	/**
	 * Implements the OAuth2 authorization flow for a request
	 */
	async function oauth2authorized(req, next) {
		getTokensFromLocation()
		if (!options.tokens.has('access_token')) {
			try {
				let token = await fetchAccessToken(req)
				if (!token) {
					return metro.response('false')
				}
			} catch(e){
				console.log('caught',e)
				throw(e)
			}
			return oauth2authorized(req, next)
		} else if (isExpired(req)) {
			let token = await fetchRefreshToken(req)
			if (!token) {
				return metro.response('false')
			}
			return oauth2authorized(req, next)
		} else {
			let accessToken = options.tokens.get('access_token')
			req = metro.request(req, {
				headers: {
					Authorization: accessToken.type+' '+accessToken.value
				}
			})
			return next(req)
		}
	}

	/**
	 * Fetches and stores the authorization_code from a redirected URI
	 * Then removes the authorization_code from the browser URL
	 * OAuth2 RFC 4.1.2
	 */
	function getTokensFromLocation() {
		if (typeof window !== 'undefined' && window?.location) {
			let url = metro.url(window.location)
			let code, state, params
			if (url.searchParams.has('code')) {
				params = url.searchParams
				url = url.with({ search:'' })
				history.pushState({},'',url.href)
			} else if (url.hash) {
				let query = url.hash.substr(1)
				params = new URLSearchParams('?'+query)
				url = url.with({ hash:'' })
				history.pushState({},'',url.href)
			}
			if (params) {
				code = params.get('code')
				state = params.get('state')
				let storedState = options.state.get('metro/state')
				if (!state || state!==storedState) {
					return
				}
				if (code) {
					options.tokens.set('authorization_code', code)
				}
			}
		}
	}

	/**
	 * Fetches the access_token. If the authorization_code hasn't been retrieved yet,
	 * it will first try to get that, using the options.callbacks.authorize function.
	 * If a refresh_token is also returned, it will store that in the options.tokens storage.
	 */
	async function fetchAccessToken(req) {
		if (oauth2.grant_type === 'authorization_code' && !options.tokens.has('authorization_code')) {
			let authReqURL = getAuthorizationCodeURL()
			if (!options.callbacks.authorize || typeof options.callbacks.authorize !== 'function') {
				throw metro.metroError('oauth2mw: oauth2 with grant_type:authorization_code requires a callback function in client options.options.callbacks.authorize')
			}
			//FIXME: authorize can do a redirect, so allow for that
			let token = await options.callbacks.authorize(authReqURL)
			if (token) {
				options.tokens.set('authorization_code', token)
			} else {
				return metro.response(false)
			}
		}
		let tokenReq = getAccessTokenRequest()
		let response = await options.client.post(tokenReq) //OAuth2.1 RFC 3.2
		if (!response.ok) {
			throw metro.metroError('OAuth2mw: fetch access_token: '+response.status+': '+response.statusText, {cause: tokenReq} )
		}
		let data = await response.json()
		// OAuth2.1 RFC 3.2.3
		options.tokens.set('access_token', {
			value: data.access_token,
			expires: getExpires(data.expires_in),
			type: data.token_type,
			scope: data.scope
		})
		if (data.refresh_token) {
			let token = {
				value: data.refresh_token
			}
			options.tokens.set('refresh_token', token)
		}
		return data
	}

	/**
	 * Fetches a new access_token using a stored refresh_token
	 * If a new refresh_token is also returned, it will update the stored refresh_token
	 * OAuth2.1 RFC 4.3
	 */
	async function fetchRefreshToken(req, next)
	{
		let refreshTokenReq = getAccessTokenRequest('refresh_token')
		let response = await options.client.post(refreshTokenReq)
		if (!response.ok) {
			throw metro.metroError('OAuth2mw: refresh access_token: '+response.status+': '+response.statusText, {cause: refreshTokenReq} )
		}
		let data = await response.json()
		options.tokens.set('access_token', {
			value:   data.access_token,
			expires: getExpires(data.expires_in),
			type:    data.token_type,
			scope:   data.scope
		})
		if (data.refresh_token) {
			let token = {
				value: data.refresh_token
			}
			options.tokens.set('refresh_token', token)
		}
		return data
	}

	/**
	 * Returns the URL to use to get a authorization_code
	 */
	function getAuthorizationCodeURL() {
		if (!oauth2.authorize_endpoint) {
			throw metro.metroError('oauth2mw: Missing options.endpoints.authorize url')
		}
		let url = metro.url(oauth2.authorize_endpoint, {hash: ''}) // OAuth2.1 RFC 3.1
		assert(oauth2, {
			client_id: /.+/,
			redirect_uri: /.+/,
			scope: /.*/
		})
		let search = {
			response_type: 'code', // implicit flow uses 'token' here, but is not considered safe, so not supported
			client_id:     oauth2.client_id,
			client_secret: oauth2.client_secret,
			redirect_uri:  oauth2.redirect_uri,
			state:         oauth2.state || createState(40) // OAuth2.1 RFC says optional, but its a good idea to always add/check it
		}
		if (oauth2.code_verifier) { //PKCE
			delete search.client_secret
			search.code_challenge = pkce.generateCodeChallenge(oauth2.code_verifier)
			search.code_challenge_method = 'S256'
		}
		if (oauth2.scope) {
			search.scope = oauth2.scope
		}
		return metro.url(url, { search })
	}

	/**
	 * Creates and stores a random state to use in the authorization code URL
	 */
	function createState(length) {
		const validChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
		let randomState = ''
		let counter = 0
	    while (counter < length) {
	        randomState += validChars.charAt(Math.floor(Math.random() * validChars.length))
	        counter++
	    }
		options.state.set(randomState)
		return randomState
	}

	/**
	 * Returns a token endpoint request with all the correct parameters, given the
	 * grant_type. This can then be used in a metro.post.
	 */
	function getAccessTokenRequest(grant_type=null) {
		assert(oauth2, {
			client_id: /.+/,
			redirect_uri: /.+/
		})
		if (!oauth2.token_endpoint) {
			throw metro.metroError('oauth2mw: Missing options.endpoints.token url')
		}
		let url = metro.url(oauth2.token_endpoint, {hash: ''}) // OAuth2.1 RFC 3.2
		let params = {
			grant_type: grant_type || oauth2.grant_type,
			client_id:  oauth2.client_id
		}
		if (oauth2.code_verifier) { //PKCE
			params.code_verifier = oauth2.code_verifier
		} else {
			params.client_secret = oauth2.client_secret
		}
		if (oauth2.scope) {
			params.scope = oauth2.scope
		}
		switch(oauth2.grant_type) {
			case 'authorization_code':
				params.redirect_uri = oauth2.redirect_uri
				params.code = options.tokens.get('authorization_code')
			break
			case 'client_credentials':
				// nothing to add
			break
			case 'refresh_token':
				params.refresh_token = oauth2.refresh_token
			break
			default:
				throw new Error('Unknown grant_type: '.oauth2.grant_type)
			break
		}
		return metro.request(url, { method: 'POST' }, metro.formdata(params))
	}

	/**
	 * Returns true if the access token in a request is expired. False otherwise.
	 */
	function isExpired(req) {
		if (req.oauth2 && req.options.tokens && req.options.tokens.has('access_token')) {
			let now = new Date();
			let token = req.options.tokens.get('access_token')
			return now.getTime() > token.expires.getTime();
		}
		return false;
	}

	/**
	 * Returns a new Date based on a duration, which can either be a date
	 * or a number of seconds from now.
	 */
	function getExpires(duration) {
		if (duration instanceof Date) {
			return new Date(duration.getTime()); // return a copy
		}
		if (typeof duration === 'number') {
			let date = new Date();
			date.setSeconds(date.getSeconds() + duration);
			return date;
		}
		throw new TypeError('Unknown expires type '+duration);
	}


}

export const pkce = {	
	generateCodeVerifier: function(size=64) {
		const code_verifier = new Uint8Array(64)
		globalThis.crypto.getRandomValues(code_verifier)
		return code_verifier.toString('hex')
	},

	/**
	 * Returns a PKCE code_challenge derived from a code_verifier
	 */
	generateCodeChallenge: async function(code_verifier) {
		const b64encoded = pkce.base64url_encode(code_verifier)
		const encoder = new TextEncoder()
		const data = encoder.encode(b64encoded)
		return await globalThis.crypto.subtle.digest('SHA-256', data)
	},

	/**
	 * Base64url encoding, which handles UTF-8 input strings correctly.
	 */
	base64url_encode: function(buffer) {
		const byteString = Array.from(new Uint8Array(buffer), b => String.fromCharCode(b)).join('')
	    return btoa(byteString)
	        .replace(/\+/g, '-')
	        .replace(/\//g, '_')
	        .replace(/=+$/, '');
	}	
}