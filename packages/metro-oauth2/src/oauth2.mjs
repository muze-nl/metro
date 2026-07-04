import * as metro from '@muze-nl/metro-core'
import { assert, Required, validURL } from '@muze-nl/assert'
import {tokenStore} from './tokenstore.mjs'

const SUPPORTED_TOKEN_TYPES = new Map([
	['bearer', 'Bearer'],
	['dpop', 'DPoP']
])

const SUPPORTED_TOKEN_ENDPOINT_AUTH_METHODS = new Set([
	'none',
	'client_secret_post',
	'client_secret_basic'
])

/**
 * oauth2mw returns a middleware for @muze-nl/metro that
 * implements oauth2 authentication in the metro client.
 * it supports the authorization_code, refresh_token and
 * client_credentials grant_type.
 * Since implicit flow is deemed insecure, it is not supported.
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
		authorize_callback: async url => {
			if (window.location.href != url.href) {
				window.location.replace(url.href)
			}
			return false
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

	for (let option in oauth2) {
		switch(option) {
			case 'access_token':
			case 'authorization_code':
			case 'refresh_token':
				options.tokens.set(option, normalizeInitialToken(option, oauth2[option]))
			break
		}
	}

	/**
	 * This is the Metro middleware function. It lets public requests pass through
	 * unchanged, but retries through the OAuth2 flow when the resource responds
	 * as if authorization is required. Exceptions from downstream middleware are
	 * intentionally not caught here; network/programming errors should remain
	 * visible to the caller instead of being mistaken for an auth challenge.
	 */
	return async function(req, next) {
		if (options.force_authorization) {
			return oauth2authorized(req, next)
		}
		const res = await next(req)
		if (res.ok || !shouldAuthorizeResponse(res)) {
			return res
		}
		return oauth2authorized(req, next)
	}

	/**
	 * Implements the OAuth2 authorization flow for a single request. It retrieves
	 * an authorization code from the current location when returning from a
	 * redirect, fetches or refreshes an access token when needed, and finally
	 * sends the request with the correct Authorization header.
	 */
	async function oauth2authorized(req, next)
	{
		getTokensFromLocation()
		const accessToken = options.tokens.get('access_token')
		const refreshToken = options.tokens.get('refresh_token')
		const tokenIsExpired = isExpired(accessToken)
		if (!accessToken || (tokenIsExpired && !refreshToken)) {
			const token = await fetchAccessToken()
			if (!token) {
				return metro.response('false')
			}
			return oauth2authorized(req, next)
		} else if (tokenIsExpired && refreshToken) {
			const token = await refreshAccessToken()
			if (!token) {
				return metro.response('false')
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
	 * Fetches the authorization_code from a redirected URI or hash fragment,
	 * validates the stored state, and removes OAuth2 callback parameters from the
	 * browser URL. Authorization endpoint errors are surfaced immediately.
	 */
	function getTokensFromLocation()
	{
		if (typeof window !== 'undefined' && window?.location) {
			let url = metro.url(window.location)
			let code, state, params
			if (url.searchParams.has('code') || url.searchParams.has('error')) {
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
				if (params.has('error')) {
					throw metro.metroError('oauth2mw: authorization failed: '+params.get('error')+(params.get('error_description') ? ' ('+params.get('error_description')+')' : ''))
				}
				code = params.get('code')
				state = params.get('state')
				validateState(state)
				if (code) {
					options.tokens.set('authorization_code', code)
				}
			}
		}
	}

	/**
	 * Fetches an access token. For authorization_code flow, this first asks the
	 * configured authorize_callback to obtain an authorization code. Token
	 * responses are validated and normalized before they are stored.
	 */
	async function fetchAccessToken()
	{
		if (oauth2.grant_type === 'authorization_code' && !options.tokens.has('authorization_code')) {
			let authReqURL = await getAuthorizationCodeURL()
			if (!options.authorize_callback || typeof options.authorize_callback !== 'function') {
				throw metro.metroError('oauth2mw: oauth2 with grant_type:authorization_code requires a callback function in client options.authorize_callback')
			}
			let authorization = await options.authorize_callback(authReqURL)
			if (authorization) {
				storeAuthorizationResult(authorization)
			} else {
				return false
			}
		}
		let tokenReq = getAccessTokenRequest()
		let response = await options.client.post(tokenReq)
		if (!response.ok) {
			let msg = await response.text()
			throw metro.metroError('OAuth2mw: fetch access_token: '+response.status+': '+response.statusText+' ('+msg+')', {cause: tokenReq} )
		}
		let data = await response.json()
		storeTokenResponse(data)
		options.tokens.delete('authorization_code')
		return data
	}

	/**
	 * Fetches a new access token using the stored refresh token. If the server
	 * returns a replacement refresh token, it replaces the stored token; if not,
	 * the existing refresh token remains valid until the provider rejects it.
	 */
	async function refreshAccessToken()
	{
		let refreshTokenReq = getAccessTokenRequest('refresh_token')
		let response = await options.client.post(refreshTokenReq)
		if (!response.ok) {
			let msg = await response.text()
			throw metro.metroError('OAuth2mw: refresh access_token: '+response.status+': '+response.statusText+' ('+msg+')', {cause: refreshTokenReq} )
		}
		let data = await response.json()
		storeTokenResponse(data)
		return data
	}

	/**
	 * Returns the front-channel authorization URL used to obtain an authorization
	 * code. Client secrets are deliberately never included here; confidential
	 * client authentication belongs at the token endpoint only.
	 */
	async function getAuthorizationCodeURL()
	{
		if (!oauth2.authorization_endpoint) {
			throw metro.metroError('oauth2mw: Missing options.oauth2_configuration.authorization_endpoint')
		}
		let url = metro.url(oauth2.authorization_endpoint, {hash: ''})
		assert(oauth2, {
			client_id: /.+/,
			redirect_uri: /.+/,
			scope: /.*/
		})
		let search = {
			response_type: 'code',
			client_id:     oauth2.client_id,
			redirect_uri:  oauth2.redirect_uri,
			state:         oauth2.state || createState(40)
		}
		if (oauth2.response_type) {
			search.response_type = oauth2.response_type
		}
		if (oauth2.response_mode) {
			search.response_mode = oauth2.response_mode
		}
		options.state.set(search.state)
		if (oauth2.code_verifier) {
			options.tokens.set('code_verifier', oauth2.code_verifier)
			search.code_challenge = await generateCodeChallenge(oauth2.code_verifier)
			search.code_challenge_method = 'S256'
		}
		if (oauth2.scope) {
			search.scope = oauth2.scope
		}
		if (oauth2.prompt) {
			search.prompt = oauth2.prompt
		}
		if (oauth2.nonce) {
			search.nonce = oauth2.nonce
		}
		return metro.url(url, { search })
	}

	/**
	 * Returns a token endpoint request for the configured grant_type. The returned
	 * request contains the form-encoded body and, when needed, the token endpoint
	 * client authentication headers.
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
		let url = metro.url(oauth2.token_endpoint, {hash: ''})
		let params = {
			grant_type: grant_type || oauth2.grant_type
		}
		let headers = {}
		applyTokenEndpointAuthentication(params, headers)
		if (oauth2.scope) {
			params.scope = oauth2.scope
		}
		switch(params.grant_type) {
			case 'authorization_code':
				params.redirect_uri = oauth2.redirect_uri
				params.code = options.tokens.get('authorization_code')
				const code_verifier = options.tokens.get('code_verifier')
				if (code_verifier) {
					params.code_verifier = code_verifier
				}
			break
			case 'client_credentials':
			break
			case 'refresh_token':
				params.refresh_token = tokenValue(options.tokens.get('refresh_token'))
			break
			default:
				throw new Error('Unknown grant_type: '+params.grant_type)
			break
		}
		return metro.request(url, {method: 'POST', headers, body: new URLSearchParams(params) })
	}

	/**
	 * Adds client authentication to the token endpoint request. Public clients use
	 * token_endpoint_auth_method 'none'; confidential clients can use
	 * client_secret_post or client_secret_basic.
	 */
	function applyTokenEndpointAuthentication(params, headers)
	{
		const method = tokenEndpointAuthMethod(oauth2)
		if (method === 'none') {
			params.client_id = oauth2.client_id
			return
		}
		if (!oauth2.client_secret) {
			throw metro.metroError('oauth2mw: token_endpoint_auth_method '+method+' requires oauth2_configuration.client_secret')
		}
		if (method === 'client_secret_post') {
			params.client_id = oauth2.client_id
			params.client_secret = oauth2.client_secret
			return
		}
		if (method === 'client_secret_basic') {
			headers.Authorization = basicAuth(oauth2.client_id, oauth2.client_secret)
			return
		}
	}

	/**
	 * Stores the authorization code returned by the authorize_callback. Callbacks
	 * may return either a plain code string or an object containing code/state.
	 */
	function storeAuthorizationResult(authorization)
	{
		let code = authorization
		if (authorization && typeof authorization === 'object') {
			if (authorization.error) {
				throw metro.metroError('oauth2mw: authorization failed: '+authorization.error)
			}
			validateState(authorization.state)
			code = authorization.authorization_code || authorization.code
		}
		if (!code) {
			throw metro.metroError('oauth2mw: authorization callback did not return an authorization code')
		}
		options.tokens.set('authorization_code', code)
	}

	/**
	 * Validates the OAuth2 state value to protect the authorization response from
	 * being accepted in the wrong client flow.
	 */
	function validateState(state)
	{
		let storedState = options.state.get()
		if (!state || state!==storedState) {
			throw metro.metroError('oauth2mw: authorization state mismatch')
		}
	}

	/**
	 * Validates and stores a token endpoint response. Unknown extra fields are
	 * ignored, as required by OAuth2, while access_token/token_type are required.
	 */
	function storeTokenResponse(data)
	{
		const token = validateTokenResponse(data)
		options.tokens.set('access_token', token)
		if (data.refresh_token) {
			options.tokens.set('refresh_token', { value: data.refresh_token })
		}
	}
}

/**
 * Returns true when a resource response should trigger OAuth2 authorization.
 * A 401 usually means missing/invalid credentials. A Bearer/DPoP
 * insufficient_scope challenge is not recoverable by simply retrying login, so
 * it is passed back to the caller.
 */
function shouldAuthorizeResponse(res)
{
	if (!res) {
		return false
	}
	if (res.status === 400) {
		return true
	}
	const challenge = parseBearerChallenge(res.headers?.get('WWW-Authenticate'))
	if (challenge?.error === 'insufficient_scope') {
		return false
	}
	return res.status === 401
}

/**
 * Normalizes tokens supplied directly in oauth2_configuration so older calling
 * code can still pass plain token strings while the middleware internally uses
 * token objects for access tokens.
 */
function normalizeInitialToken(name, token)
{
	if (name === 'access_token' && token && typeof token === 'object') {
		return token
	}
	if (name === 'access_token') {
		return { value: token, type: 'Bearer', expires: null }
	}
	if (name === 'refresh_token' && token && typeof token === 'object') {
		return token
	}
	return token
}

/**
 * Validates the client-relevant fields of a token endpoint response and returns
 * the internal access-token shape used by the middleware.
 */
function validateTokenResponse(data)
{
	if (!data || typeof data !== 'object') {
		throw metro.metroError('OAuth2mw: token endpoint did not return a JSON object')
	}
	if (!data.access_token) {
		throw metro.metroError('OAuth2mw: token response did not include access_token')
	}
	if (!data.token_type) {
		throw metro.metroError('OAuth2mw: token response did not include token_type')
	}
	const tokenType = normalizeTokenType(data.token_type)
	return {
		value: data.access_token,
		expires: data.expires_in === undefined ? null : getExpires(data.expires_in),
		type: tokenType,
		scope: data.scope
	}
}

/**
 * Normalizes supported token types to the spelling used in Authorization
 * headers. Unsupported token types are rejected because the client would not
 * know how to use them safely.
 */
function normalizeTokenType(type)
{
	const normalized = SUPPORTED_TOKEN_TYPES.get(String(type).toLowerCase())
	if (!normalized) {
		throw metro.metroError('OAuth2mw: unsupported token_type '+type)
	}
	return normalized
}

/**
 * Determines the token endpoint authentication method. The legacy default is
 * kept for compatibility: clients with a secret use client_secret_post, public
 * clients use none.
 */
function tokenEndpointAuthMethod(oauth2)
{
	const method = oauth2.token_endpoint_auth_method || (oauth2.client_secret ? 'client_secret_post' : 'none')
	if (!SUPPORTED_TOKEN_ENDPOINT_AUTH_METHODS.has(method)) {
		throw metro.metroError('oauth2mw: unsupported token_endpoint_auth_method '+method)
	}
	return method
}

/**
 * Builds a client_secret_basic Authorization header value for the token
 * endpoint. The credentials are form-encoded before base64 encoding.
 */
function basicAuth(clientId, clientSecret)
{
	const value = formEncode(clientId)+':'+formEncode(clientSecret)
	return 'Basic '+base64_encode(value)
}

function formEncode(value)
{
	return encodeURIComponent(value).replace(/%20/g, '+')
}

function base64_encode(value)
{
	if (typeof btoa === 'function') {
		return btoa(value)
	}
	return Buffer.from(value, 'binary').toString('base64')
}

/**
 * Returns the raw token value from either the current object form or the older
 * plain-string form.
 */
function tokenValue(token)
{
	return token && typeof token === 'object' ? token.value : token
}

/**
 * Returns true if the access token is expired. Tokens without an expires value
 * are treated as having unknown/non-expiring lifetime.
 */
export function isExpired(token)
{
	if (!token) {
		return true
	}
	if (!token.expires) {
		return false
	}
	let expires = new Date(token.expires)
	let now = new Date();
	return now.getTime() > expires.getTime();
}

/**
 * Returns a Date based on a duration, which can either be a Date instance or a
 * number of seconds from now.
 */
export function getExpires(duration)
{
	if (duration instanceof Date) {
		return new Date(duration.getTime());
	}
	if (typeof duration === 'number') {
		let date = new Date();
		date.setSeconds(date.getSeconds() + duration);
		return date;
	}
	throw new TypeError('Unknown expires type '+duration);
}

/**
 * Returns a PKCE code_verifier. The result is already base64url encoded and can
 * be stored until the matching authorization code is exchanged.
 */
export function	generateCodeVerifier(size=64)
{
	const code_verifier = new Uint8Array(size)
	globalThis.crypto.getRandomValues(code_verifier)
	return base64url_encode(code_verifier)
}

/**
 * Returns the PKCE S256 code_challenge derived from a code_verifier. This is
 * async because it uses WebCrypto's SHA-256 digest API.
 */
export async function generateCodeChallenge(code_verifier)
{
	const encoder = new TextEncoder()
	const data = encoder.encode(code_verifier)
	const challenge = await globalThis.crypto.subtle.digest('SHA-256', data)
	return base64url_encode(challenge)
}

/**
 * Base64url encoding for byte buffers. Used for PKCE verifier/challenge and
 * generated state values.
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
 * Creates a random OAuth2 state value. Uses cryptographic randomness when
 * available, with the previous Math.random fallback kept only for older/test
 * environments where WebCrypto is absent.
 */
export function createState(length)
{
	const bytes = new Uint8Array(Math.ceil(length * 3 / 4) + 1)
	if (globalThis.crypto?.getRandomValues) {
		globalThis.crypto.getRandomValues(bytes)
		return base64url_encode(bytes).slice(0, length)
	}
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
 * Returns true if the current document.location contains an OAuth2 code
 * parameter in either the query string or hash fragment.
 */
export function isRedirected() {
	let url = new URL(document.location.href)
	if (!url.searchParams.has('code')) {
		if (url.hash) {
			let query = url.hash.substr(1)
			const params = new URLSearchParams('?'+query)
			if (params.has('code')) {
				return true
			}
		}
		return false
	}
	return true
}

/**
 * Returns true if there is a valid access token or any refresh token in the
 * provided token store. If a string is passed, it is treated as a tokenStore
 * site/issuer name for backwards compatibility.
 */
export function isAuthorized(tokens) {
	if (typeof tokens == 'string') {
		tokens = tokenStore(tokens).tokens
	}
	let accessToken = tokens.get('access_token')
	if (accessToken && !isExpired(accessToken)) {
		return true
	}
	let refreshToken = tokens.get('refresh_token')
	if (refreshToken) {
		return true
	}
	return false
}

/**
 * Parses Bearer and DPoP WWW-Authenticate challenge headers into a small object
 * so the middleware can distinguish invalid_token from insufficient_scope and
 * similar OAuth2 resource-server errors.
 */
export function parseBearerChallenge(value)
{
	if (!value || typeof value !== 'string') {
		return null
	}
	const trimmed = value.trim()
	const index = trimmed.search(/\s/)
	const scheme = index < 0 ? trimmed : trimmed.slice(0, index)
	const rest = index < 0 ? '' : trimmed.slice(index + 1)
	if (!['bearer', 'dpop'].includes(scheme.toLowerCase())) {
		return null
	}
	const result = { scheme }
	const pattern = /([A-Za-z][A-Za-z0-9_-]*)=("(?:[^"\\]|\\.)*"|[^,\s]*)/g
	let match
	while ((match = pattern.exec(rest))) {
		let value = match[2]
		if (value.startsWith('"') && value.endsWith('"')) {
			value = value.slice(1, -1).replace(/\\"/g, '"')
		}
		result[match[1]] = value
	}
	return result
}
