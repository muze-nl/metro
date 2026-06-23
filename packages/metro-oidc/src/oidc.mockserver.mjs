import metro from '@muze-nl/metro'
import oauth2mockserver from '@muze-nl/metro-oauth2/src/oauth2.mockserver.mjs'

const defaultIssuer = 'https://issuer.example/'
const defaultRedirectUri = 'https://client.example/callback'
const jsonHeaders = {
	'Content-Type': 'application/json'
}
const textHeaders = {
	'Content-Type': 'text/plain'
}

function jsonResponse(body, status = 200, statusText = 'OK') {
	return metro.response({
		status,
		statusText,
		headers: jsonHeaders,
		body: JSON.stringify(body)
	})
}

function errorResponse(error, description, status = 400) {
	return jsonResponse({
		error,
		error_description: description
	}, status, status === 401 ? 'Unauthorized' : 'Bad Request')
}

async function requestData(req) {
	if (req.data instanceof URLSearchParams) {
		return Object.fromEntries(req.data.entries())
	}
	if (req.data && typeof req.data === 'object') {
		return req.data
	}
	if (!req.body) {
		return {}
	}
	const text = await req.clone().text()
	try {
		return JSON.parse(text)
	} catch (e) {
		return Object.fromEntries(new URLSearchParams(text).entries())
	}
}

/**
 * Small OIDC provider mock for Metro tests.
 *
 * It exposes discovery metadata, dynamic client registration, userinfo and
 * delegates the OAuth2 authorization/token/protected-resource endpoints to the
 * OAuth2 mock server. This keeps OIDC tests on the same path as OAuth2 tests.
 */
export default function oidcmockserver(options = {}) {
	options = Object.assign({
		issuer: defaultIssuer,
		client_id: 'mockClientId',
		client_secret: 'mockClientSecret',
		redirect_uri: defaultRedirectUri,
		id_token: 'mockHeader.mockPayload.mockSignature',
		sub: 'mockSubject'
	}, options)

	const issuer = metro.url(options.issuer)
	const oauth2 = oauth2mockserver({
		client_id: options.client_id,
		client_secret: options.client_secret,
		redirect_uri: options.redirect_uri,
		scope: 'openid profile email',
		id_token: options.id_token,
		requirePKCE: options.requirePKCE ?? false
	})
	const clients = new Map()

	return async (req, next) => {
		const url = metro.url(req.url)
		switch (url.pathname) {
			case '/.well-known/openid-configuration':
				return discovery()
			case '/register/':
			case '/register':
				return register(req)
			case '/userinfo/':
			case '/userinfo':
				return userinfo(req)
			case '/jwks/':
			case '/jwks':
				return jsonResponse({ keys: [] })
			default:
				return oauth2(req, next)
		}
	}

	function endpoint(path) {
		return metro.url(issuer, path).href
	}

	function discovery() {
		return jsonResponse({
			issuer: issuer.href,
			authorization_endpoint: endpoint('/authorize/'),
			token_endpoint: endpoint('/token/'),
			userinfo_endpoint: endpoint('/userinfo/'),
			jwks_uri: endpoint('/jwks/'),
			registration_endpoint: endpoint('/register/'),
			scopes_supported: ['openid', 'profile', 'email'],
			response_types_supported: ['code', 'id_token', 'id_token token'],
			grant_types_supported: ['authorization_code', 'refresh_token'],
			subject_types_supported: ['public'],
			id_token_signing_alg_values_supported: ['RS256'],
			claims_supported: ['sub', 'name', 'email']
		})
	}

	async function register(req) {
		if (req.method !== 'POST') {
			return errorResponse('invalid_request', 'registration endpoint requires POST')
		}
		const body = await requestData(req)
		if (!Array.isArray(body.redirect_uris) || body.redirect_uris.length === 0) {
			return errorResponse('invalid_client_metadata', 'redirect_uris is required')
		}
		const info = {
			...body,
			client_id: options.client_id,
			client_secret: options.client_secret,
			client_id_issued_at: Math.floor(Date.now() / 1000),
			token_endpoint_auth_method: 'client_secret_post'
		}
		clients.set(info.client_id, info)
		return jsonResponse(info, 201, 'Created')
	}

	function userinfo(req) {
		const auth = req.headers.get('Authorization')
		if (auth !== 'Bearer mockAccessToken') {
			return metro.response({
				status: 401,
				statusText: 'Unauthorized',
				headers: textHeaders,
				body: '401 Unauthorized'
			})
		}
		return jsonResponse({
			sub: options.sub,
			name: 'Mock User',
			email: 'mock@example.test'
		})
	}
}
