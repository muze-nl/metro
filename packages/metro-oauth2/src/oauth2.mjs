import * as metro from '@muze-nl/metro'
import * as assert from '@muze-nl/metro/src/assert.mjs'
import jsonmw from '@muze-nl/metro/src/mw/json.mjs'

/**
 * oauth2mw returns a middleware for @muze-nl/metro that
 * implements oauth2 authentication in the metro client.
 * it supports the authorization_code, refresh_token and
 * client_credentials grant_type.
 * Since implicit flow is deemed insecure, it is not supported
 * (see the OAuth2.1 RFC)
 */
export default function mwOAuth2(options) {

	let site = 'default'
	if (options.site) {
		site = options.site
	}

	let localState, localTokens
	if (typeof localStorage !== 'undefined') {
		localState = {
			get: () => localStorage.getItem('metro/state:'+site),
			has: () => localStorage.getItem('metro/state:'+site),
			set: (value) => localStorage.setItem('metro/state:'+site, value)
		}
		localTokens = {
			get: (name) => localStorage.getItem(site+':'+name),
			set: (name, value) => localStorage.setItem(site+':'+name, value),
			has: (name) => localStorage.hasItem(site+':'+name)
		}
	} else {
		let stateMap = new Map()
		localState = {
			get: () => stateMap.get('metro/state:'+site),
			has: () => stateMap.get('metro/state:'+site),
			set: (value) => stateMap.set('metro/state:'+site, value)
		}
		localTokens = new Map()
	}

	const oauth2 = {
		tokens: localTokens,
		state: localState,
		endpoints: {
			authorize: '/authorize',
			token: '/token'
		},
		callbacks: {
			authorize: url => document.location = url
		},
		client: metro.client().with(jsonmw()),
		client_id: '',
		client_secret: '',
		redirect_uri: '',
		grant_type: 'authorization_code',
		force_authorization: false
	}

	for (let option in options) {
		switch(option) {
			case 'access_token':
			case 'authorization_code':
			case 'refresh_token':
				oauth2.tokens.set(option, options[option])
			break

			case 'client':
			case 'client_id':
			case 'client_secret':
			case 'grant_type':
			case 'force_authorization':
			case 'redirect_uri':
				oauth2[option] = options[option]
			break
			case 'state':
			case 'tokens':
				if (typeof options[option].set == 'function' && 
					typeof options[option].get == 'function' && 
					typeof options[option].has == 'function' ) {
					oauth2[option] = options[option]
				} else if (option == 'tokens' && typeof options.tokens == 'object') {
					for (let token in options.tokens) {
						oauth2.tokens.set(token, options.tokens[token])
					}
				} else if (option == 'state' && typeof options.state == 'object') {
					if (!options.state.random) {
						options.state.random = createState(40)
					}
					oauth2.state.set(JSON.stringify(options.state))
				} else {
					throw metro.metroError('metro/mw/oauth2: incorrect value for '+option)
				}
			break
			case 'endpoints':
				for (let endpoint in options.endpoints) {
					if (endpoint!='authorize' && endpoint!='token') {
						throw metro.metroError('Unknown endpoint, choose one of "authorize" or "token"',endpoint)
					}
				}
				Object.assign(oauth2.endpoints, options.endpoints)
			break
			case 'callbacks':
				for (let callback in options.callbacks) {
					if (callback != 'authorize') {
						throw metro.metroError('Unknown callback, choose one of "authorize"',callback)
					}
				}
				Object.assign(oauth2.callbacks, options.callbacks)
			break
			default:
				throw metro.metroError('Unknown oauth2mw option ',option)
			break
		}
		if (!oauth2.redirect_uri) {
			oauth2.redirect_uri = typeof window !== 'undefined' ? window.location?.href : ''
		}
		if (oauth2.redirect_uri) {
			oauth2.redirect_uri = metro.url(oauth2.redirect_uri).with('?metroRedirect=true')
		}
	}

	/**
	 * This is the middleware function. It will intercept a request, and if needed
	 * go through the OAuth2 authorization flow first.
	 */
	return async function(req, next) {
		if (oauth2.force_authorization) {
			return oauth2authorized(req, next)
		}
		let res = await next(req)
		if (res.ok) {
			return res
		}
		switch(res.status) {
			case 400:
			case 401:
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
		if (!oauth2.tokens.has('access_token')) {
			let token = await fetchAccessToken(req)
			if (!token) {
				return metro.response('false')
			}
			return oauth2authorized(req, next)
		} else if (isExpired(req)) {
			let token = await fetchRefreshToken(req)
			if (!token) {
				return metro.response('false')
			}
			return oauth2authorized(req, next)
		} else {
			let accessToken = oauth2.tokens.get('access_token')
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
				let storedState = oauth2.state.get('metro/state')
				if (!state || state!==storedState) {
					return
				}
				if (code) {
					oauth2.tokens.set('authorization_code', code)
				}
			}
		}
	}

	/**
	 * Fetches the access_token. If the authorization_code hasn't been retrieved yet,
	 * it will first try to get that, using the oauth2.callbacks.authorize function.
	 * If a refresh_token is also returned, it will store that in the oauth2.tokens storage.
	 */
	async function fetchAccessToken(req) {
		if (oauth2.grant_type === 'authorization_code' && !oauth2.tokens.has('authorization_code')) {
			let authReqURL = getAuthorizationCodeURL()
			if (!oauth2.callbacks.authorize || typeof oauth2.callbacks.authorize !== 'function') {
				throw metro.metroError('oauth2mw: oauth2 with grant_type:authorization_code requires a callback function in client options.oauth2.callbacks.authorize')
			}
			let token = await oauth2.callbacks.authorize(authReqURL)
			if (token) {
				oauth2.tokens.set('authorization_code', token)
			} else {
				return metro.response(false)
			}
		}
		let tokenReq = getAccessTokenURL()
		let response = await oauth2.client.get(tokenReq)
		if (!response.ok) {
			throw metro.metroError(response.status+':'+response.statusText, await response.text())
		}
		let data = await response.json()
		oauth2.tokens.set('access_token', {
			value: data.access_token,
			expires: getExpires(data.expires_in),
			type: data.token_type,
			scope: data.scope
		})
		if (data.refresh_token) {
			let token = {
				value: data.refresh_token
			}
			oauth2.tokens.set('refresh_token', token)
		}
		return data
	}

	/**
	 * Fetches a new access_token using a stored refresh_token
	 * If a new refresh_token is also returned, it will update the stored refresh_token
	 */
	async function fetchRefreshToken(req, next)
	{
		let refreshTokenReq = getAccessTokenURL('refresh_token')
		let response = await oauth2.client.get(refreshTokenReq)
		if (!response.ok) {
			throw metro.metroError(response.status+':'+response.statusText, await response.text())
		}
		let data = await response.json()
		oauth2.tokens.set('access_token', {
			value:   data.access_token,
			expires: getExpires(data.expires_in),
			type:    data.token_type,
			scope:   data.scope
		})
		if (data.refresh_token) {
			let token = {
				value: data.refresh_token
			}
			oauth2.tokens.set('refresh_token', token)
		}
		return data
	}

	/**
	 * Returns the URL to use to get a authorization_code
	 */
	function getAuthorizationCodeURL() {
		if (!oauth2.endpoints.authorize) {
			throw metro.metroError('oauth2mw: Missing options.endpoints.authorize url')
		}
		let url = metro.url(oauth2.endpoints.authorize, {hash: ''})
		assert.check(oauth2, {
			client_id: /.+/,
			redirect_uri: /.+/,
			scope: /.*/
		})
		let search = {
			response_type: 'code', // implicit flow uses 'token' here, but is not considered safe, so not supported
			client_id:     oauth2.client_id,
			redirect_uri:  oauth2.redirect_uri,
			state:         oauth2.state || createState(40)
		}
		search.client_secret = oauth2.client_secret
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
		oauth2.state.set(randomState)
		return randomState
	}

	/**
	 * Returns a token endpoint URL with all the correct parameters, given the
	 * grant_type. This can then be used in a metro.get.
	 */
	function getAccessTokenURL(grant_type=null) {
		assert.check(oauth2, {
			client_id: /.+/,
			redirect_uri: /.+/
		})
		if (!oauth2.endpoints.token) {
			throw metro.metroError('oauth2mw: Missing options.endpoints.token url')
		}
		let url = metro.url(oauth2.endpoints.token, {hash: ''})
		let params = {
			grant_type: grant_type || oauth2.grant_type,
			client_id:  oauth2.client_id
		}
		params.client_secret = oauth2.client_secret
		if (oauth2.scope) {
			params.scope = oauth2.scope
		}
		switch(oauth2.grant_type) {
			case 'authorization_code':
				params.redirect_uri = oauth2.redirect_uri
				params.code = oauth2.tokens.get('authorization_code')
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
		return metro.url(url, {
			searchParams: params
		})
	}

	/**
	 * Returns true if the access token in a request is expired. False otherwise.
	 */
	function isExpired(req) {
		if (req.oauth2 && req.oauth2.tokens && req.oauth2.tokens.has('access_token')) {
			let now = new Date();
			let token = req.oauth2.tokens.get('access_token')
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