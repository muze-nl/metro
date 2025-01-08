import metro from '@muze-nl/metro'
import { assert, Required, validURL } from '@muze-nl/assert'
import {tokenStore} from './tokenstore.mjs'

/**
 * oauth2mw returns a middleware for @muze-nl/metro that
 * implements oauth2 authentication in the metro client.
 * it supports the authorization_code, refresh_token and
 * client_credentials grant_type.
 * Since implicit flow is deemed insecure, it is not supported
 * This library follows the OAuth2.1 RFC - https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-11)
 * Referenced as Oauth2.1 RFC from here on
 * by default it will use PKCE and generate a random code_verifier,
 * to skip this, set options.oauth2_configuration.code_verifier to false
 */
export default function oauth2mw(options)
{
	const defaultOptions = {
		client: metro.client(),
		force_authorization: false,
		site: 'default',
		oauth2_configuration: {
			authorization_endpoint: '/authorize',
			token_endpoint: '/token',
			redirect_uri: globalThis.document?.location.href,
			grant_type: 'authorization_code',
			code_verifier: generateCodeVerifier(64)
		},
		callbacks: {
			authorize: async url => {
				if (window.location.href != url.href) {
					window.location.replace(url.href)
				}
				return false
			}
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
			client_id: Required(/.+/),
			grant_type: 'authorization_code',
			authorization_endpoint: Required(validURL),
			token_endpoint: Required(validURL),
			redirect_uri: Required(validURL)
		}
	})

	// FIXME: for oidc, we need to send the id_token instead of access token...
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
		let res
		try {
			res = await next(req)
			if (res.ok) {
				return res
			}
		} catch(err) {
			switch(res.status) { 
				case 400: // Oauth2.1 RFC 3.2.4
				case 401: // in case of incorrect authentication method
					//FIXME: check payload of response as well? yes - may be able to recover
					return oauth2authorized(req, next)
				break
			}
			throw err
		}
		if (!res.ok) {
			switch(res.status) { 
				case 400: // Oauth2.1 RFC 3.2.4
				case 401: // in case of incorrect authentication method
					//FIXME: check payload of response as well? yes - may be able to recover
					return oauth2authorized(req, next)
				break
			}
		}
		return res
	}

	/**
	 * Implements the OAuth2 authorization flow for a request
	 */
	async function oauth2authorized(req, next)
	{
		getTokensFromLocation()
		let accessToken = options.tokens.get('access_token')
		if (!accessToken) {
			try {
				let token = await fetchAccessToken()
				if (!token) {
					return metro.response('false')
				}
			} catch(e){
				//FIXME: handle some errors here
				throw(e)
			}
			return oauth2authorized(req, next)
		} else if (isExpired(accessToken)) {
			try {
				let token = await fetchRefreshToken()
				if (!token) {
					return metro.response('false')
				}
			} catch(e) {
				//FIXME: handle some errors here
				throw(e)
			}
			return oauth2authorized(req, next)
		} else {
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
	function getTokensFromLocation()
	{
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
	async function fetchAccessToken()
	{
		if (oauth2.grant_type === 'authorization_code' && !options.tokens.has('authorization_code')) {
			let authReqURL = await getAuthorizationCodeURL()
			if (!options.callbacks.authorize || typeof options.callbacks.authorize !== 'function') {
				throw metro.metroError('oauth2mw: oauth2 with grant_type:authorization_code requires a callback function in client options.options.callbacks.authorize')
			}
			//FIXME: authorize can do a redirect, so allow for that
			let token = await options.callbacks.authorize(authReqURL)
			if (token) {
				options.tokens.set('authorization_code', token)
			} else {
				return false
			}
		}
		let tokenReq = getAccessTokenRequest()
		let response = await options.client.post(tokenReq) //OAuth2.1 RFC 3.2
		if (!response.ok) {
			let msg = await response.text()
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
	async function fetchRefreshToken()
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
		} else {
			return false
		}
		return data
	}

	/**
	 * Returns the URL to use to get a authorization_code
	 */
	async function getAuthorizationCodeURL()
	{
		if (!oauth2.authorization_endpoint) {
			throw metro.metroError('oauth2mw: Missing options.oauth2_configuration.authorization_endpoint')
		}
		let url = metro.url(oauth2.authorization_endpoint, {hash: ''}) // OAuth2.1 RFC 3.1
		assert(oauth2, {
			client_id: /.+/,
			redirect_uri: /.+/,
			scope: /.*/
		})
		let search = {
			response_type: 'code', // implicit flow uses 'token' here, but is not considered safe, so not supported
			client_id:     oauth2.client_id,
			redirect_uri:  oauth2.redirect_uri,
			state:         oauth2.state || createState(40) // OAuth2.1 RFC says optional, but its a good idea to always add/check it
		}
		if (oauth2.response_type) {
			search.response_type = oauth2.response_type
		}
		if (oauth2.response_mode) {
			search.response_mode = oauth2.response_mode
		}
		options.state.set(search.state)
		if (oauth2.client_secret) {
			search.client_secret = oauth2.client_secret
		}
		if (oauth2.code_verifier) { //PKCE
			search.code_challenge = base64url_encode(await generateCodeChallenge(oauth2.code_verifier))
			search.code_challenge_method = 'S256'
		}
		if (oauth2.scope) {
			search.scope = oauth2.scope
		}
		if (oauth2.prompt) {
			search.prompt = oauth2.prompt
		}
		return metro.url(url, { search })
	}


	/**
	 * Returns a token endpoint request with all the correct parameters, given the
	 * grant_type. This can then be used in a metro.post.
	 */
	function getAccessTokenRequest(grant_type=null)
	{
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
			params.code_verifier = base64url_encode(oauth2.code_verifier)
		}
		if (oauth2.client_secret) {
			params.client_secret = oauth2.client_secret
		}
		if (oauth2.scope) {
			params.scope = oauth2.scope
		}
		switch(oauth2.grant_type) {
			case 'authorization_code':
				params.redirect_uri = oauth2.redirect_uri
				params.code = options.tokens.get('authorization_code')
				if (options.dpop) {
					const keyPair = options.tokens.get('keyPair')
					params.dpop_jkt = keyPair.publicKey
				}
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
		return metro.request(url, {method: 'POST', body: new URLSearchParams(params) })
	}

}

/**
 * Returns true if the access token is expired. False otherwise.
 */
export function isExpired(token)
{
	if (!token) {
		return true
	}
	let expires = new Date(token.expires)
	let now = new Date();
	return now.getTime() > expires.getTime();
}

/**
 * Returns a new Date based on a duration, which can either be a date
 * or a number of seconds from now.
 */
export function getExpires(duration)
{
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


/**
 * returns a PKCE code_verifier, as a uint8array
 * pass it to base64url_encode() to get a string
 */
export function	generateCodeVerifier(size=64)
{
	const code_verifier = new Uint8Array(size)
	globalThis.crypto.getRandomValues(code_verifier)
	return code_verifier
}

/**
 * Returns a PKCE code_challenge derived from a code_verifier
 * Note that this is an async function, so you can't just call
 * it in the defaultOptions part of oauth2mw, or it will become async as well
 * and that is not supported using metro.client().with() (yet)
 */
export async function generateCodeChallenge(code_verifier)
{
	const b64encoded = base64url_encode(code_verifier)
	const encoder = new TextEncoder()
	const data = encoder.encode(b64encoded)
	return await globalThis.crypto.subtle.digest('SHA-256', data)
}

/**
 * Base64url encoding, which handles UTF-8 input strings correctly.
 */
export function base64url_encode(buffer)
{
	const byteString = Array.from(new Uint8Array(buffer), b => String.fromCharCode(b)).join('')
    return btoa(byteString)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

/**
 * Creates a random state to use in the authorization code URL
 */
export function createState(length)
{
	const validChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
	let randomState = ''
	let counter = 0
    while (counter < length) {
        randomState += validChars.charAt(Math.floor(Math.random() * validChars.length))
        counter++
    }
	return randomState
}

/**
 * Returns true if a parameter 'code' is in the document.location searchParams or
 * in the hash, if parsed as searchParams
 */
export function isRedirected() {
	let url = new URL(document.location.href)
	if (!url.searchParams.has('code')) {
		if (url.hash) {
			let query = url.hash.substr(1)
			params = new URLSearchParams('?'+query)
			if (params.has('code')) {
				return true
			}
		}
		return false
	}
	return true
}
