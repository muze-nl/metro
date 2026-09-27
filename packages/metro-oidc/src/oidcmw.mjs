import * as metro from '@muze-nl/metro-core'
import oauth2mw, * as oauth2 from '@muze-nl/metro-oauth2/oauth2'
import dpopmw from '@muze-nl/metro-oauth2/dpop'
import { assert, Required, Optional, validURL, instanceOf } from '@muze-nl/assert'
import discover from './oidc.discovery.mjs'
import register from './oidc.register.mjs'
import oidcStore from './oidc.store.mjs'
import jsonmw from '@muze-nl/metro-middleware/json'
import throwermw from '@muze-nl/metro-middleware/thrower'
import { validateIdToken } from './oidc.jwt.mjs'

const pendingClientSetups = new Map()

function sharedClientSetup(key, setup) {
	if (!pendingClientSetups.has(key)) {
		const pending = setup().finally(() => {
			pendingClientSetups.delete(key)
		})
		pendingClientSetups.set(key, pending)
	}
	return pendingClientSetups.get(key)
}

export default function oidcmw(options={}) {

	const defaultOptions = {
		client: metro.client(),
		force_authorization: false,
		use_dpop: true,
		authorize_callback: async url => {
			if (window.location.href != url.href) {
				window.location.replace(url.href)
			}
			return false
		}
	}

	options = Object.assign({}, defaultOptions, options)
	const requestedClientInfo = options.client_info

	assert(options, {
		client: Required(instanceOf(metro.client().constructor)), // required because it is set in defaultOptions
		client_info: Required(),
		issuer: Required(validURL),
		oauth2: Optional({}),
		openid_configuration: Optional()
	})

	// Discovery and client registration belong to the issuer. Tokens belong to
	// the user they were issued for, so a login as one user can never reuse
	// another user's tokens at the same issuer.
	const account = accountFor(options)
	const expectedClaims = expectedClaimsFor(options)
	const site = siteFor(options.issuer, account)
	const clientSetupKey = options.issuer + ' '
		+ JSON.stringify(requestedClientInfo?.redirect_uris ?? null)
	let userStore = options.store
	if (!options.store) {
		options.store = oidcStore(options.issuer)
		userStore = oidcStore(site)
	}
	if (!options.openid_configuration && options.store.has('openid_configuration')) {
		options.openid_configuration = options.store.get('openid_configuration')
	}
	if (!options.client_info?.client_id && options.store.has('client_info')) {
		const storedClientInfo = options.store.get('client_info')
		if (clientInfoMatchesRequest(storedClientInfo, requestedClientInfo)) {
			options.client_info = storedClientInfo
		}
	}

	/**
	 * Discovers the issuer and registers this client once. Concurrent requests
	 * wait for the same registration, so tokens are never issued to one
	 * registered client while another client_id is stored.
	 */
	async function prepareClient()
	{
		if (options.openid_configuration && options.client_info?.client_id) {
			return
		}
		const prepared = await sharedClientSetup(clientSetupKey, discoverAndRegister)
		options.openid_configuration = prepared.openid_configuration
		options.client_info = prepared.client_info
		options.store.set('openid_configuration', options.openid_configuration)
		options.store.set('client_info', options.client_info)
	}

	async function discoverAndRegister()
	{
		let openid_configuration = options.openid_configuration
		if (!openid_configuration) {
			openid_configuration = await discover({
				issuer: options.issuer,
				client: options.client.with(options.issuer)
			})
		}
		let client_info = options.client_info
		if (!client_info?.client_id) {
			if (!openid_configuration.registration_endpoint) {
				throw metro.metroError('metro.oidcmw: Error: issuer '+options.issuer+' does not support dynamic client registration, but you haven\'t specified a client_id')
			}
			client_info = await register({
				registration_endpoint: openid_configuration.registration_endpoint,
				client: options.client,
				client_info
			})
		}
		return { openid_configuration, client_info }
	}

	/**
	 * The id_token must carry the nonce of the authorization request that
	 * produced it. Storing the nonce when that request starts means a request
	 * waiting for someone else's login, or the first request after a redirect
	 * back from the issuer, cannot replace it.
	 */
	function rememberNonce(authorizeCallback)
	{
		if (typeof authorizeCallback != 'function') {
			return authorizeCallback
		}
		return async url => {
			userStore.set('pending_nonce', url.searchParams.get('nonce'))
			return authorizeCallback(url)
		}
	}

	return async (req, next) => {
		let res
		if (!options.force_authorization) {
			// Middleware that turns responses into errors or data, such as
			// thrower and getdata, belongs outside oidcmw, so the status of the
			// actual response is visible here.
			res = await next(req)
			if (res.ok || (res.status!=401 && res.status!=403)) {
				return res
			}
		}
		await prepareClient()

		// now initialize an oauth2 client stack, using options.client as default
		// with forceAuthentication: true
		const scope = options.scope || 'openid'
		const nonce = options.nonce || oauth2.generateCodeVerifier(32)

		const oauth2Options = Object.assign(
			{
				site,
				client: options.client,
				force_authorization: true,
				authorize_callback: rememberNonce(options.authorize_callback),
				oauth2_configuration: {
					client_id: options.client_info?.client_id,
					client_secret: options.client_info?.client_secret,
					grant_type: 'authorization_code',
					response_type: 'code',
					response_mode: 'query',
					authorization_endpoint: options.openid_configuration.authorization_endpoint,
					token_endpoint: options.openid_configuration.token_endpoint,
					scope, //FIXME: should only use scopes supported by server
					redirect_uri: options.client_info.redirect_uris[0],
					login_hint: options.login_hint ?? options.webid,
					issuer: options.openid_configuration.issuer,
					authorization_response_iss_parameter_supported:
						options.openid_configuration.authorization_response_iss_parameter_supported,
					nonce
				}
			}
			//...
		)
		
		const storeIdToken = async (req, next) => {
			const res = await next(req)
			const tokenEndpoint = metro.url(options.openid_configuration.token_endpoint, { hash: '' }).href
			const requestUrl = metro.url(req.url, { hash: '' }).href
			if (requestUrl !== tokenEndpoint) {
				return res
			}
			const contentType = res.headers.get('content-type')
			if (!res.ok || !contentType?.startsWith('application/json')) {
				// oauth2mw reports the token endpoint's own error
				return res
			}

			let data = res.data && typeof res.data === 'object' ? res.data : null
			if (!data) {
				const res2 = res.clone() // otherwise res.body can't be read again
				data = await res2.json()
			}

			const id_token = data?.id_token
			const isRefresh = await grantTypeOf(req) == 'refresh_token'
			if (isRefresh && !id_token) {
				// a refresh response may omit the id_token; the stored one stays
				return res
			}
			const jwks = await getJwks()
			const validation = await validateIdToken(id_token, {
				issuer: options.openid_configuration.issuer,
				client_id: options.client_info.client_id,
				jwks,
				openid_configuration: options.openid_configuration,
				nonce: isRefresh ? undefined : userStore.get('pending_nonce')
			})
			if (isRefresh) {
				assertSameUserAsLogin(validation.claims, userStore.get('id_token_claims'))
			}
			assertExpectedUser(validation.claims, expectedClaims)
			userStore.set('id_token', id_token)
			userStore.set('id_token_claims', validation.claims)
			return res
		}

		const getJwks = async () => {
			if (!options.jwks) {
				const jwksClient = options.client.with(throwermw()).with(jsonmw())
				const response = await jwksClient.get(options.openid_configuration.jwks_uri)
				options.jwks = response.data
			}
			return options.jwks
		}

		let oauth2client = options.client.with(options.issuer).with(storeIdToken)

		if (options.use_dpop) {
			const dpopOptions = {
				site: options.issuer,
				authorization_endpoint: options.openid_configuration.authorization_endpoint,
				token_endpoint: options.openid_configuration.token_endpoint,
				dpop_signing_alg_values_supported: options.openid_configuration.dpop_signing_alg_values_supported
			}
			oauth2client = oauth2client.with(dpopmw(dpopOptions)) // add DPoP headers in requests with Authorization headers
		}
		oauth2Options.client = oauth2client // make sure token requests use the OIDC token-observing stack

		oauth2client = oauth2client.with(oauth2mw(oauth2Options))

		res = await oauth2client.fetch(req)

		return res
	}

}

function clientInfoMatchesRequest(storedClientInfo, requestedClientInfo) {
	if (!storedClientInfo?.client_id) {
		return false
	}
	if (!Array.isArray(requestedClientInfo?.redirect_uris)) {
		return true
	}
	const storedRedirectUris = new Set(storedClientInfo.redirect_uris || [])
	return requestedClientInfo.redirect_uris.every(uri => storedRedirectUris.has(uri))
}

/**
 * A WebID identifies the user when available (Solid-OIDC puts it in the
 * webid claim); otherwise login_hint and expected_claims do.
 */
function accountFor(options) {
	return options.webid ?? options.login_hint
}

function expectedClaimsFor(options) {
	if (options.webid) {
		return Object.assign({ webid: options.webid }, options.expected_claims)
	}
	return options.expected_claims || {}
}

function siteFor(issuer, account) {
	if (!account) {
		return issuer
	}
	return issuer + '|' + account
}

/**
 * Refuses tokens issued for another user than the one requested, e.g. when
 * the issuer still has a login session for a different account.
 */
function assertExpectedUser(claims, expectedClaims) {
	for (const [name, expected] of Object.entries(expectedClaims)) {
		const actual = claimValue(claims, name)
		if (actual !== expected) {
			throw metro.metroError('metro.oidcmw: id_token is for a different user: '
				+ 'expected ' + name + ' ' + expected + ', got ' + actual)
		}
	}
}

async function grantTypeOf(req) {
	const body = await req.clone().text()
	return new URLSearchParams(body).get('grant_type')
}

/**
 * An id_token from a refresh has no nonce of its own. It must describe the
 * same login: same issuer (checked by validateIdToken) and same subject.
 */
function assertSameUserAsLogin(claims, loginClaims) {
	if (loginClaims && claims.sub !== loginClaims.sub) {
		throw metro.metroError('metro.oidcmw: refreshed id_token is for a different user: '
			+ 'expected sub ' + loginClaims.sub + ', got ' + claims.sub)
	}
}

/**
 * Solid-OIDC issuers put the WebID in the webid claim; older issuers only
 * use sub for it.
 */
function claimValue(claims, name) {
	if (name == 'webid' && claims.webid === undefined) {
		return claims.sub
	}
	return claims[name]
}

export function isRedirected() {
	return oauth2.isRedirected()
}

export function idToken(options) {
	if (!options.store) {
		if (!options.issuer) {
			throw metro.metroError('Must supply options.issuer or options.store to get the id_token')
		}
		options.store = oidcStore(siteFor(options.issuer, accountFor(options)))
	}
	return options.store.get('id_token')
}

export function idTokenClaims(options) {
	if (!options.store) {
		if (!options.issuer) {
			throw metro.metroError('Must supply options.issuer or options.store to get the id_token claims')
		}
		options.store = oidcStore(siteFor(options.issuer, accountFor(options)))
	}
	return options.store.get('id_token_claims')
}
