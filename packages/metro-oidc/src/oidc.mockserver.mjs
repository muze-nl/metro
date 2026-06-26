import * as metro from '@muze-nl/metro-core'
import oauth2mockserver from '@muze-nl/metro-oauth2/testing'
import { exportJWK, generateKeyPair, SignJWT } from 'jose'

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
 * It exposes discovery metadata, dynamic client registration, userinfo, JWKS
 * and delegates the OAuth2 authorization/token/protected-resource endpoints to
 * the OAuth2 mock server. Its token endpoint returns real signed ID Tokens so
 * the OIDC client tests exercise actual JWT/JWS/JWKS validation.
 */
export default function oidcmockserver(options = {}) {
	options = Object.assign({
		issuer: defaultIssuer,
		client_id: 'mockClientId',
		client_secret: 'mockClientSecret',
		redirect_uri: defaultRedirectUri,
		sub: 'mockSubject',
		alg: 'RS256',
		kid: 'mock-signing-key',
		publishSigningKey: true,
		idTokenClaims: {}
	}, options)

	const issuer = metro.url(options.issuer)
	const keyPair = createSigningKey(options)
	const oauth2 = oauth2mockserver({
		client_id: options.client_id,
		client_secret: options.client_secret,
		redirect_uri: options.redirect_uri,
		scope: 'openid profile email',
		id_token: tokenContext => idToken(tokenContext),
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
				return jwks()
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
			id_token_signing_alg_values_supported: [options.alg],
			claims_supported: ['iss', 'sub', 'aud', 'exp', 'iat', 'nonce', 'name', 'email']
		})
	}

	async function jwks() {
		if (!options.publishSigningKey) {
			return jsonResponse({ keys: [] })
		}
		const { publicKey } = await keyPair
		const jwk = await exportJWK(publicKey)
		jwk.kid = options.jwksKid || options.kid
		jwk.alg = options.alg
		jwk.use = 'sig'
		return jsonResponse({ keys: [jwk] })
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
			client_id_issued_at: Math.floor(Date.now() / 1000),
			token_endpoint_auth_method: options.client_secret ? 'client_secret_post' : 'none'
		}
		if (options.client_secret) {
			info.client_secret = options.client_secret
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

	async function idToken(tokenContext = {}) {
		const now = Math.floor(Date.now() / 1000)
		const authorization = tokenContext.authorization || {}
		const claims = {
			iss: issuer.href,
			sub: options.sub,
			aud: options.client_id,
			exp: now + 3600,
			iat: now,
			...(authorization.nonce ? { nonce: authorization.nonce } : {}),
			...options.idTokenClaims
		}
		const { privateKey } = await keyPair
		return new SignJWT(claims)
			.setProtectedHeader({ alg: options.alg, kid: options.kid })
			.sign(privateKey)
	}
}

function createSigningKey(options) {
	return generateKeyPair(options.alg, {
		extractable: true,
		modulusLength: 2048
	})
}
