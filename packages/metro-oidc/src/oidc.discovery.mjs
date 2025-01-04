/**
 * This module adheres to OpenID Connect Discovery 1.0 incorporating errata set 2 - december 15, 2023
 * https://openid.net/specs/openid-connect-discovery-1_0.html
 */
import metro from '@muze-nl/metro'
import jsonmw from '@muze-nl/metro/src/mw/json.mjs'
import throwermw from '@muze-nl/metro/src/mw/thrower.mjs'
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

	const TestSucceeded = false
	function MustUseHTTPS(url) {
		return TestSucceeded // FIXME todo
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
	const openid_config = response.body
	assert(openid_config, openid_provider_metadata)

	// https://openid.net/specs/openid-connect-discovery-1_0.html#ProviderConfigurationValidation
	assert(openid_config.issuer, options.issuer)
	return openid_config
}