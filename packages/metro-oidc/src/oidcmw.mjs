import * as metro from '@muze-nl/metro'
import oauth2mw from '@muze-nl/metro-oauth2'
import assert from '@muze-nl/metro/src/assert.mjs'

//TODO: these should return functions, compatible with metro.assert
const Required = new Symbol('required')
const Recommended = new Symbol('recommended')
const Optional = new Symbol('optional')
const oneOf = (...options) => 
	(value) => options.includes(value)
const anyOf = (...options) => 
	(value) => Array.isArray(value) && value.filter(v => !options.includes(v)).length == 0
const MustNotHave = (...options) => 
	(value, container) => options.filter(o => container.hasOwnKey(o)).length == 0

//FIXME: list valid algorithms per usecase, these are for JWK
const validAlgorithms = [
	'HS256','HS384','HS512','RS256','RS384','RS512','ES256','ES384','ES512'
]
//FIXME: other auth methods may be defined by extensions to openid connect discovery
const validAuthMethods = [
	'client_secret_post', 'client_secret_base','client_secret_jwt','private_key_jwt'
]

//openid provider metadata (openid_configuration) openid connect discovery 1.0 #3
//https://openid.net/specs/openid-connect-discovery-1_0.html
const openid_provider_metadata = {
	issuer: Required(options.issuer),
	authorization_endpoint: Required(validURL),
	token_endpoint: Required(validURL),
	userinfo_endpoint: Recommended(validURL),
	jwks_uri: Required(validURL),
	registration_endpoint: Recommended(validURL),
	scopes_supported: Recommended([]),
	response_types_supported: Required([]),
	response_modes_supported: Optional([]),
	grant_types_supported: Optional([]),
	acr_values_supported: Optional([]),
	subject_types_supported: Required([]),
	id_token_signing_alg_values_supported: Required(oneOf(...validAlgorithms)),
	id_token_encryption_alg_values_supported: Optional(oneOf(...validAlgorithms)),
	id_token_encryption_enc_values_supported: Optional(oneOf(...validAlgorithms)),
	userinfo_signing_alg_values_supported: Optional(oneOf(...validAlgorithms)),
	userinfo_encryption_alg_values_supported: Optional(oneOf(...validAlgorithms)),
	userinfo_encryption_enc_values_supported: Optional(oneOf(...validAlgorithms)),
	request_object_signing_alg_values_supported: Optional(oneOf(...validAlgorithms)),
	request_object_encryption_alg_values_supported: Optional(oneOf(...validAlgorithms)),
	request_object_encryption_enc_values_supported: Optional(oneOf(...validAlgorithms)),
	token_endpoint_auth_methods_supported: Optional(oneOf(...validAuthMethods)),
	token_endpoint_auth_signing_alg_values_supported: Optional(oneOf(validAlgorithms)),
	display_values_supported: Optional(anyOf('page','popup','touch','wap')),
	claim_types_supported: Optional(anyOf('normal','aggregated','distributed')),
	claims_supported: Recommended([]),
	service_documentation: Optional(validURL),
	claims_locales_supported: Optional([]),
	ui_locales_supported: Optional([]),
	claims_parameter_supported: Optional(Boolean),
	request_parameter_supported: Optional(Boolean),
	request_uri_parameter_supported: Optional(Boolean),
	op_policy_uri: Optional(validURL),
	op_tos_uri: Optional(validURL)
//	https://datatracker.ietf.org/doc/html/rfc8414#section-3
	
}

const openid_client_metadata = {
	redirect_uris: Required([]),
	response_types: Optional([]),
	grant_types: Optional([]),
	application_type: Optional(oneOf('native','web')),
	contacts: Optional([validEmail]),
	client_name: Optional(),
	logo_uri: Optional(validURL),
	client_uri: Optional(validURL),
	policy_uri: Optional(validURL),
	tos_uri: Optional(validURL),
	jwks_uri: Optional(validURL, MustNotHave('jwks')),
	jwks: Optional(validURL, MustNotHave('jwks_uri')),
	sector_identifier_uri: Optional(validURL),
	subject_type: Optional(),
	id_token_signed_response_alg: Optional(oneOf(...validAlgorithms)),
	id_token_encrypted_response_alg: Optional(oneOf(...validAlgorithms)),
	id_token_encrypted_response_end: Optional(oneOf(...validAlgorithms)),
	userinfo_signed_response_alg: Optional(oneOf(...validAlgorithms)),
	userinfo_encrypted_response_alg: Optional(oneOf(...validAlgorithms)),
	userinfo_encrypted_response_enc: Optional(oneOf(...validAlgorithms)),
	request_object_signing_alg: Optional(oneOf(...validAlgorithms)),
	request_object_encryption_alg: Optional(oneOf(...validAlgorithms)),
	request_object_encryption_enc: Optional(oneOf(...validAlgorithms)),
	token_endpoint_auth_method: Optional(oneOf(...validAuthMethods)),
	token_endpoint_auth_signing_alg: Optional(oneOf(...validAlgorithms)),
	default_max_age: Optional(Number),
	require_auth_time: Optional(Boolean),
	default_acr_values: Optional([]),
	initiate_login_uri: Optional([validURL]),
	request_uris: Optional([validURL])
}

export function oidcmw(options={}) {
	const defaultOptions = {
		client: metro.client(),
		force_authorization: false
	}

	options = Object.assign({}, defaultOptions, options)

	assert(options, {
		client: Required(metroClient), // required because it is set in defaultOptions
		client_info: Required(openid_client_metadata),
		issuer: Required(validURL),
		oauth2: Optional({}),
		openid_configuration: Optional(openid_provider_metadata)
	})

	return (req, next) => {
		let res
		if (!options.force_authorization) {
			try {
				res = await next(req)
			} catch(err) {
				if (res.status!=401 && res.status!=403) {
					throw err
				}
			}
			if (res.ok || (res.status!=401 && res.status!=403)) {
				return res
			}
		}
		if (!options.openid_configuration) {
			options.openid_configuration = fetchWellknownOpenIDConfiguration(options.issuer)
			assert(options.openid_configuration.issuer, options.issuer)
		}

		if (!options.client_info?.client_id) {
			assert(options.client_info?.client_name, Required())
			if (!options.openid_configuration.registration_endpoint) {
				throw metro.metroError('metro.oidcmw: Error: issuer '+options.issuer+' does not support dynamic client registration, but you haven\'t specified a client_id')
			}
			await registerClient(options.openid_configuration.registration_endpoint, options.client_info)
		}

		// now initialize an oauth2 client stack, using options.client as default
		// with forceAuthentication: true
		const oauth2Options = Object.assign(
			{
				site: options.issuer,
				client: options.client,
			}, 
			options.oauth2, 
			{
				force_authentication: true,
				//...
			}
		)

		const oauth2client = options.client.with(options.issuer)
		// optional: add oauth2pkce mw
		// optional: add oauth2dpop mw
		.with(oauth2mw(oauth2Options))

		res = await oauth2client.fetch(req) //TODO: add metro.client.fetch()
		// ...

		return res
	}

	async function fetchWellknownOpenIDConfiguration(issuer)
	{
		let res = options.client.get(metro.url(issuer,'.wellknown/openid_configuration'))
		if (res.ok) {
			assert(res.headers.get('Content-Type'), /application\/json.*/)
			let openid_configuration = await res.json()
			assert(openid_configuration, openid_provider_metadata) //FIXME: make this work
			return openid_configuration
		}
		throw metro.metroError('metro.oidcmw: Error while fetching '+issuer+'.wellknown/openid_configuration', res)
	}

	async function registerClient(registration_endpoint, client_info)
	{
		let response = await options.client.with(jsonmw).post(registration_endpoint, client_info)
		if (response.ok) {
			let info = response.body
			if (!info.client_id || !info.client_secret) {
				throw metro.metroError('metro.oidc: Error: dynamic registration of client failed, no client_id or client_secret returned', response)
			}
			options.client_info = Object.assign(options.client_info, info)
		}
	}
}