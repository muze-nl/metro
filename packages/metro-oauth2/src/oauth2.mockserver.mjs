import metro from '@muze-nl/metro'
import { generateCodeChallenge } from './oauth2.mjs'

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

function oauthError(error, description, status = 400) {
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
	return Object.fromEntries(new URLSearchParams(text).entries())
}

function paramValue(params, name) {
	return typeof params.get === 'function' ? params.get(name) : params[name]
}

function required(params, name) {
	if (!paramValue(params, name)) {
		return `${name} is required`
	}
	return null
}

function same(value, expected, name) {
	if (expected !== undefined && value !== expected) {
		return `${name} must be ${expected}`
	}
	return null
}

function randomToken(prefix) {
	return `${prefix}-${Math.random().toString(36).slice(2)}`
}

/**
 * Small OAuth2 authorization server mock for Metro tests and examples.
 *
 * The mock intentionally models the parts of the OAuth2 authorization-code,
 * refresh-token and client-credentials flows that Metro middleware depends on:
 * authorization request validation, one-use authorization codes, PKCE matching,
 * token requests, refresh requests and protected-resource bearer-token checks.
 */
export default function oauth2mockserver(options = {}) {
	const defaultOptions = {
		client_id: 'mockClientId',
		client_secret: 'mockClientSecret',
		redirect_uri: 'https://client.example/callback',
		scope: 'read write',
		token_type: 'Bearer',
		access_token: 'mockAccessToken',
		refresh_token: 'mockRefreshToken',
		expires_in: 3600,
		requirePKCE: false,
		issueRefreshToken: true,
		id_token: null
	}
	options = Object.assign({}, defaultOptions, options)

	const authorizationCodes = new Map()
	const accessTokens = new Set([options.access_token])
	const refreshTokens = new Set([options.refresh_token])

	return async (req, next) => {
		const url = metro.url(req.url)
		switch (url.pathname) {
			case '/authorize/':
			case '/authorize':
				return authorize(url)
			case '/token/':
			case '/token':
				return token(req)
			case '/protected/':
			case '/protected':
				return protectedResource(req)
			case '/public/':
			case '/public':
				return jsonResponse({ result: 'Success' })
			default:
				if (next) {
					return next(req)
				}
				return metro.response({
					status: 404,
					statusText: 'Not Found',
					headers: textHeaders,
					body: `404 Not Found ${url.href}`
				})
		}
	}

	function authorize(url) {
		const params = url.searchParams
		let error
		for (const name of ['response_type', 'client_id', 'redirect_uri', 'state']) {
			error = required(params, name)
			if (error) return oauthError('invalid_request', error)
		}
		error = same(paramValue(params, 'response_type'), 'code', 'response_type')
			|| same(paramValue(params, 'client_id'), options.client_id, 'client_id')
			|| same(paramValue(params, 'redirect_uri'), options.redirect_uri, 'redirect_uri')
		if (error) return oauthError('invalid_request', error)

		const codeChallenge = paramValue(params, 'code_challenge')
		const codeChallengeMethod = paramValue(params, 'code_challenge_method')
		if (options.requirePKCE && !codeChallenge) {
			return oauthError('invalid_request', 'code_challenge is required')
		}
		if (codeChallenge && !codeChallengeMethod) {
			return oauthError('invalid_request', 'code_challenge_method is required')
		}
		if (codeChallengeMethod && !['S256', 'plain'].includes(codeChallengeMethod)) {
			return oauthError('invalid_request', 'unsupported code_challenge_method')
		}

		const code = randomToken('mockAuthorizeCode')
		authorizationCodes.set(code, {
			client_id: paramValue(params, 'client_id'),
			redirect_uri: paramValue(params, 'redirect_uri'),
			scope: paramValue(params, 'scope') || options.scope,
			nonce: paramValue(params, 'nonce'),
			state: paramValue(params, 'state'),
			code_challenge: codeChallenge,
			code_challenge_method: codeChallengeMethod,
			used: false
		})

		return jsonResponse({
			code,
			state: paramValue(params, 'state'),
			redirect_uri: paramValue(params, 'redirect_uri')
		})
	}

	async function token(req) {
		if (req.method !== 'POST') {
			return oauthError('invalid_request', 'token endpoint requires POST')
		}

		const body = await requestData(req)
		const grantType = body.grant_type
		let error = required(body, 'grant_type') || required(body, 'client_id')
		if (error) return oauthError('invalid_request', error)
		error = same(body.client_id, options.client_id, 'client_id')
		if (error) return oauthError('invalid_client', error, 401)

		switch (grantType) {
			case 'authorization_code':
				return authorizationCodeGrant(body)
			case 'refresh_token':
				return refreshTokenGrant(body)
			case 'client_credentials':
				return clientCredentialsGrant(body)
			default:
				return oauthError('unsupported_grant_type', `unsupported grant_type ${grantType}`)
		}
	}

	async function authorizationCodeGrant(body) {
		let error = required(body, 'code') || required(body, 'redirect_uri')
		if (error) return oauthError('invalid_request', error)

		const code = authorizationCodes.get(body.code)
		if (!code || code.used) {
			return oauthError('invalid_grant', 'authorization code is invalid or already used')
		}
		if (code.client_id !== body.client_id || code.redirect_uri !== body.redirect_uri) {
			return oauthError('invalid_grant', 'authorization code was not issued for this client or redirect_uri')
		}

		if (code.code_challenge) {
			if (!body.code_verifier) {
				return oauthError('invalid_request', 'code_verifier is required')
			}
			const expectedChallenge = code.code_challenge_method === 'S256'
				? await generateCodeChallenge(body.code_verifier)
				: body.code_verifier
			if (expectedChallenge !== code.code_challenge) {
				return oauthError('invalid_grant', 'code_verifier does not match code_challenge')
			}
		}

		code.used = true
		return issueToken(code.scope, { authorization: code, grant_type: 'authorization_code' })
	}

	async function refreshTokenGrant(body) {
		let error = required(body, 'refresh_token')
		if (error) return oauthError('invalid_request', error)
		if (!refreshTokens.has(body.refresh_token?.value || body.refresh_token)) {
			return oauthError('invalid_grant', 'refresh_token is invalid')
		}
		return issueToken(body.scope || options.scope, { grant_type: 'refresh_token' })
	}

	async function clientCredentialsGrant(body) {
		if (options.client_secret && body.client_secret !== options.client_secret) {
			return oauthError('invalid_client', 'client_secret is invalid', 401)
		}
		return issueToken(body.scope || options.scope, { refresh: false })
	}

	async function issueToken(scope, tokenOptions = {}) {
		const token = options.access_token
		accessTokens.add(token)
		const body = {
			access_token: token,
			token_type: options.token_type,
			expires_in: options.expires_in,
			scope,
			example_parameter: 'mockExampleValue'
		}
		const includeRefresh = tokenOptions.refresh !== false && options.issueRefreshToken
		if (includeRefresh) {
			refreshTokens.add(options.refresh_token)
			body.refresh_token = options.refresh_token
		}
		if (options.id_token) {
			body.id_token = typeof options.id_token === 'function'
				? await options.id_token({ scope, ...tokenOptions })
				: options.id_token
		}
		return jsonResponse(body)
	}

	function protectedResource(req) {
		const auth = req.headers.get('Authorization')
		const [type, token] = auth ? auth.split(' ') : []
		if (type !== options.token_type || !accessTokens.has(token)) {
			return metro.response({
				status: 401,
				statusText: 'Unauthorized',
				headers: textHeaders,
				body: '401 Unauthorized'
			})
		}
		return jsonResponse({ result: 'Success' })
	}
}
