/**
 * This module adheres to OpenID Connect Discovery 1.0 incorporating errata set 2 - december 15, 2023
 * https://openid.net/specs/openid-connect-discovery-1_0.html
 */
import * as metro from '@muze-nl/metro-core'
import jsonmw from '@muze-nl/metro-middleware/json'
import throwermw from '@muze-nl/metro-middleware/thrower'
import { validJWA, MustInclude, validAuthMethods } from './oidc.util.mjs'
import { assert, fails, Required, Recommended, Optional, oneOf, anyOf, allOf, validURL, instanceOf, not, error } from '@muze-nl/assert'

/**
 * Given options.issuer will get the .well-known/openid-configuration information
 * parse it, assert if follows the specification and return it as a javascript object
 * @param options.issuer Required: URL with the root of the oidc issuer
 * @param options.client Optional: metro client to use in the request
 * @returns object with openid-configuration
 * @throws Error when a network error occurs while fetching openid-configuration
 * @throws assertError when either the options or the openid-configuration fail assertions (and assertion testing is enabled)
 */
export default async function oidcDiscovery(options={}) {
	assert(options, {
		client: Optional(instanceOf(metro.client().constructor)),
		issuer: Required(validURL)
	})

	const defaultOptions = {
		client: metro.client().with(throwermw()).with(jsonmw()),
		requireDynamicRegistration: false
	}

	options = Object.assign({},defaultOptions,options)
	options.client = options.client.with(throwermw()).with(jsonmw())
	requireSecureURL('issuer', options.issuer)

	function MustUseHTTPS(url) {
		if (isSecureURL(url)) {
			return false
		}
		return error('url must use https', url)
	}

	// https://openid.net/specs/openid-connect-discovery-1_0.html#ProviderMetadata
	// @TODO: this is a first approximation of the specced requirements, needs to implement
	// all MUST/MUST NOT etc. notes in the specification.
	const openid_provider_metadata = {
		issuer: Required(allOf(options.issuer, MustUseHTTPS)),
		authorization_endpoint: Required(validURL),
		token_endpoint: Required(validURL),
		userinfo_endpoint: Recommended(validURL), // todo: test for https protocol
		jwks_uri: Required(validURL),
		registration_endpoint: options.requireDynamicRegistration 
			? Required(validURL) 
			: Recommended(validURL),
		scopes_supported: Recommended(MustInclude('openid')),
		response_types_supported: options.requireDynamicRegistration
			? Required(MustInclude('code','id_token','id_token token')) 
			: Required([]),
		response_modes_supported: Optional([]),
		grant_types_supported: options.requireDynamicRegistration
			? Optional(MustInclude('authorization_code')) // implicit is required according to the spec, but not used in web apps
			: Optional([]),
		acr_values_supported: Optional([]),
		subject_types_supported: Required([]),
		id_token_signing_alg_values_supported: Required(MustInclude('RS256')),
		id_token_encryption_alg_values_supported: Optional([]),
		id_token_encryption_enc_values_supported: Optional([]),
		userinfo_signing_alg_values_supported: Optional([]),
		userinfo_encryption_alg_values_supported: Optional([]),
		userinfo_encryption_enc_values_supported: Optional([]),
		request_object_signing_alg_values_supported: Optional(MustInclude('RS256')), // not testing for 'none'
		request_object_encryption_alg_values_supported: Optional([]),
		request_object_encryption_enc_values_supported: Optional([]),
		token_endpoint_auth_methods_supported: Optional(anyOf(...validAuthMethods)),
		token_endpoint_auth_signing_alg_values_supported: Optional(MustInclude('RS256'), not(MustInclude('none'))),
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
	}

	// fetch openid configuration from wellknown and return the json
	const configURL = metro.url(options.issuer, '.well-known/openid-configuration')

	const response = await options.client.get(
		// https://openid.net/specs/openid-connect-discovery-1_0.html#ProviderConfigurationRequest
		// note: this allows path components in the options.issuer url
		configURL
	)
	const openid_config = response.data
	// the full metadata schema is a diagnostic, only checked when assertions
	// are enabled; the checks that protect the login always run
	assert(openid_config, openid_provider_metadata)
	checkProviderMetadata(openid_config, options.issuer)
	return openid_config
}

const REQUIRED_ENDPOINTS = ['authorization_endpoint', 'token_endpoint', 'jwks_uri']

/**
 * The metadata the login depends on, checked whether or not assertions are
 * enabled: the document must describe the issuer it was fetched for
 * (Discovery section 4.3), so iss checks compare against the right issuer,
 * and every endpoint that receives codes, tokens or keys must use https.
 */
function checkProviderMetadata(config, issuer)
{
	if (!config || typeof config !== 'object') {
		throw metro.metroError('metro.oidc.discovery: openid-configuration for '+issuer+' is not a JSON object')
	}
	if (!sameIssuer(config.issuer, issuer)) {
		throw metro.metroError('metro.oidc.discovery: openid-configuration is for issuer '+config.issuer+', expected '+issuer)
	}
	requireSecureURL('issuer', config.issuer)
	for (const name of REQUIRED_ENDPOINTS) {
		if (!config[name]) {
			throw metro.metroError('metro.oidc.discovery: openid-configuration for '+issuer+' has no '+name)
		}
		requireSecureURL(name, config[name])
	}
	if (config.registration_endpoint) {
		requireSecureURL('registration_endpoint', config.registration_endpoint)
	}
}

/**
 * Issuer identifiers must be identical. The only difference allowed is a
 * trailing slash, which WebID profiles and discovery documents often
 * disagree on.
 */
function sameIssuer(discovered, requested)
{
	if (typeof discovered != 'string') {
		return false
	}
	return withoutTrailingSlash(discovered) === withoutTrailingSlash(String(requested))
}

function withoutTrailingSlash(value)
{
	return value.replace(/\/$/, '')
}

function requireSecureURL(name, value)
{
	if (!isSecureURL(value)) {
		throw metro.metroError('metro.oidc.discovery: '+name+' must use https: '+value)
	}
}

/**
 * https is required; plain http is only accepted on the local machine, for
 * development servers.
 */
function isSecureURL(value)
{
	let url
	try {
		url = new URL(String(value))
	}
	catch(e) {
		return false
	}
	if (url.protocol == 'https:') {
		return true
	}
	return url.protocol == 'http:' && isLoopback(url.hostname)
}

function isLoopback(hostname)
{
	return hostname == 'localhost'
		|| hostname.endsWith('.localhost')
		|| hostname == '127.0.0.1'
		|| hostname == '[::1]'
}