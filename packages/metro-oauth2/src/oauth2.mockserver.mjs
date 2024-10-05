import * as metro from '@muze-nl/metro'
import * as assert from '@muze-nl/assert'

const baseResponse = {
	status: 200,
	statusText: 'OK',
	headers: {
		'Content-Type':'application/json'
	}
}

const badRequest = (error) => {
	return {
		status: 400,
		statusText: 'Bad Request',
		headers: {
			'Content-Type':'application/json'
		},
		body: JSON.stringify({
			error: 'invalid_request',
			error_description: error
		})
	}
}

let error, expect, token
let pkce = {}

export default function oauth2mockserver(options={}) {

	// TODO: add PCKE support, so assert either client_secret or code_verifier / code_challenge
	// store code_challenge and code_challenge_method for each authorization_code
	// TODO: add DPoP support
	const defaultOptions = {
		'PKCE': false,
		'DPoP': false
	}
	options = Object.assign({}, defaultOptions, options)

	return (req, next) => {
		let url = metro.url(req.url)
		switch(url.pathname) {
			case '/authorize/':
				if (error = assert.fails(url.searchParams, {
					response_type: 'code',
					client_id: 'mockClientId',
					state: assert.Optional(/.*/)
				})) {
					return metro.response(badRequest(error))
				}
				if (url.searchParams.has('code_challenge')) {
					if (!url.searchParams.has('code_challenge_method')) {
						return metro.response(badRequest('missing code_challenge_method'))
					}
					pkce.code_challenge = url.searchParams.get('code_challenge')
					pcke.code_challenge_method = url.searchParams.get('code_challenge_method')
				}
				return metro.response(baseResponse, {
					body: JSON.stringify({
						code: 'mockAuthorizeToken',
						state: url.searchParams.get('state')
					})
				})
			break
			case '/token/':
				if (error = assert.fails(url.searchParams, {
					grant_type: assert.oneOf('refresh_token','authorization_code')
				})) {
					return metro.response(badRequest(error))
				}
				switch(url.searchParams.grant_type) {
					case 'refresh_token':
						if (error = assert.fails(url.searchParams, assert.oneOf({
							refresh_token: 'mockRefreshToken',
							client_id: 'mockClientId',
							client_secret: 'mockClientSecret'
						}, {
							refresh_token: 'mockRefreshToken',
							client_id: 'mockClientId',
							code_verifier: /.+/
						}))) {
							return metro.response(badRequest(error))
						}
					break
					case 'access_token':
						if (error = assert.fails(url.searchParams, assert.oneOf({
							client_id: 'mockClientId',
							client_secret: 'mockClientSecret'
						}, {
							client_id: 'mockClientId',
							code_challenge: /.*/, //FIXME: check that this matches code_verifier
							code_challenge_method: 'S256'
						}))) {
							return metro.response(badRequest(error))
						}
					break
				}
				return metro.response(baseResponse, {
					body: JSON.stringify({
						access_token: 'mockAccessToken',
						token_type: 'mockExample',
						expires_in: 3600,
						refresh_token: 'mockRefreshToken',
						example_parameter: 'mockExampleValue'
					})
				})
			break
			case '/protected/':
				let auth = req.headers.get('Authorization')
				let [type,token] = auth ? auth.split(' ') : []
				if (!token || token!=='mockAccessToken') {
					return metro.response({
						status: 401,
						statusText: 'Forbidden',
						body: '401 Forbidden'
					})
				}
				return metro.response(baseResponse, {
					body: JSON.stringify({
						result: 'Success'
					})
				})
			break
			case '/public/':
				return metro.response(baseResponse, {
					body: JSON.stringify({
						result: 'Success'
					})
				})
			break
			default:
				return metro.response({
					status: 404,
					statusText: 'not found',
					body: '404 Not Found '+url
				})
			break
		}
	}
}