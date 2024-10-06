import * as metro from '@muze-nl/metro'
import jsonmw from '@muze-nl/metro/src/mw/json.mjs'
import throwermw from '@muze-nl/metro/src/mw/thrower.mjs'
import { validJWA, validAuthMethods, MustHave } from './oidc.util.mjs'
import { assert, Required, Optional, oneOf, anyOf, validURL, validEmail, not, instanceOf } from '@muze-nl/assert'

export default async function register(options)
{
	const defaultOptions = {
		client: metro.client().with(throwermw()).with(jsonmw())
	}

	options = Object.assign({}, defaultOptions, options)

    // https://openid.net/specs/openid-connect-registration-1_0.html#ClientMetadata
	const openid_client_metadata = {
		redirect_uris: Required([validURL]),
		response_types: Optional([]),
		grant_types: Optional(anyOf('authorization_code','refresh_token')), //TODO: match response_types with grant_types
		application_type: Optional(oneOf('native','web')),
		contacts: Optional([validEmail]),
		client_name: Optional(String),
		logo_uri: Optional(validURL),
		client_uri: Optional(validURL),
		policy_uri: Optional(validURL),
		tos_uri: Optional(validURL),
		jwks_uri: Optional(validURL, not(MustHave('jwks'))),
		jwks: Optional(validURL, not(MustHave('jwks_uri'))),
		sector_identifier_uri: Optional(validURL),
		subject_type: Optional(String),
		id_token_signed_response_alg: Optional(oneOf(...validJWA)),
		id_token_encrypted_response_alg: Optional(oneOf(...validJWA)),
		id_token_encrypted_response_enc: Optional(oneOf(...validJWA), MustHave('id_token_encrypted_response_alg')),
		userinfo_signed_response_alg: Optional(oneOf(...validJWA)),
		userinfo_encrypted_response_alg: Optional(oneOf(...validJWA)),
		userinfo_encrypted_response_enc: Optional(oneOf(...validJWA), MustHave('userinfo_encrypted_response_alg')),
		request_object_signing_alg: Optional(oneOf(...validJWA)),
		request_object_encryption_alg: Optional(oneOf(...validJWA)),
		request_object_encryption_enc: Optional(oneOf(...validJWA)),
		token_endpoint_auth_method: Optional(oneOf(...validAuthMethods)),
		token_endpoint_auth_signing_alg: Optional(oneOf(...validJWA)),
		default_max_age: Optional(Number),
		require_auth_time: Optional(Boolean),
		default_acr_values: Optional([String]),
		initiate_login_uri: Optional([validURL]),
		request_uris: Optional([validURL])
	}

	assert(options, {
		client: instanceOf(metro.client().constructor),
		registration_endpoint: validURL, 
		client_info: openid_client_metadata
	})

	let response = await options.client
		.post(options.registration_endpoint, {
			body: options.client_info
		})
	let info = response.body
	if (!info.client_id || !info.client_secret) {
		throw metro.metroError('metro.oidc: Error: dynamic registration of client failed, no client_id or client_secret returned', response)
	}
	options.client_info = Object.assign(options.client_info, info)
	return options.client_info
}