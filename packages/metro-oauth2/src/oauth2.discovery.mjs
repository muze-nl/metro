import * as metro from '@muze-nl/metro'
import { assert, Required, Recommended, Optional, oneOf, anyOf } from '@muze-nl/assert'
import jsonmw from '@muze-nl/metro/src/mw/json.mjs'
import mwOauth2 from './oauth2.mjs'
import mwOAuth2PKCE from './oauth2.pkce.mjs'
// import mwOauth2DPoP from './oauth2.DPoP.mjs'

/**
 * This module allows for oauth2 discovery and returns an oauth2
 * client with all required middleware and options configured
 * 
 * oauth2 discovery: https://datatracker.ietf.org/doc/html/rfc8414
 */

const MustNotHave = (...options) => 
	(value, root) => options.filter(o => root.hasOwnKey(o)).length == 0

//FIXME: list valid algorithms per usecase, these are for JWK
const validAlgorithms = [
	'HS256','HS384','HS512','RS256','RS384','RS512','ES256','ES384','ES512'
]
//FIXME: other auth methods may be defined by extensions to openid connect discovery
const validAuthMethods = [
	'client_secret_post', 'client_secret_base','client_secret_jwt','private_key_jwt'
]

const oauth_authorization_server_metadata = {
	issuer: Required(validURL),
	authorization_endpoint: Required(validURL),
	token_endpoint: Required(validURL),
	jwks_uri: Optional(validURL),
	registration_endpoint: Optional(validURL),
	scopes_supported: Recommended([]),
	response_types_supported: Required(anyOf('code','token')),
	response_modes_supported: Optional([]),
	grant_types_supported: Optional([]),
	token_endpoint_auth_methods_supported: Optional([]),
	token_endpoint_auth_signing_alg_values_supported: Optional([]),
	service_documentation: Optional(validURL),
	ui_locales_supported: Optional([]),
	op_policy_uri: Optional(validURL),
	op_tos_uri: Optional(validURL),
	revocation_endpoint: Optional(validURL),
	revocation_endpoint_auth_methods_supported: Optional(validAuthMethods),
	revocation_endpoint_auth_signing_alg_values_supported: Optional(validAlgorithms),
	introspection_endpoint: Optional(validURL),
	introspection_endpoint_auth_methods_supported: Optional(validAuthMethods),
	introspection_endpoint_auth_signing_alg_values_supported: Optional(validAlgorithms),
	code_challendge_methods_supported: Optional([])
}

export default function makeClient(options={}) {
	const defaultOptions = {
		client: metro.client()
	}
	options = Object.assign({}, defaultOptions, options)
	assert(options, {
		issuer: Required(validURL)
	})

	// start discovery
	const oauth_authorization_server_configuration = fetchWellknownOauthAuthorizationServer(options.issuer)
	let client = options.client.with(options.issuer)
}

async function fetchWellknownOauthAuthorizationServer(issuer)
{
	let res = options.client.get(metro.url(issuer,'.wellknown/oauth_authorization_server'))
	if (res.ok) {
		assert(res.headers.get('Content-Type'), /application\/json.*/)
		let configuration = await res.json()
		assert(configuration, oauth_authorization_server_metadata)
		return configuration
	}
	throw metro.metroError('metro.oidcmw: Error while fetching '+issuer+'.wellknown/oauth_authorization_server', res)
}