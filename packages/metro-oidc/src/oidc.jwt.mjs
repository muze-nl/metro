import { createLocalJWKSet, jwtVerify } from 'jose'
import * as metro from '@muze-nl/metro/src/metro.mjs'

const jwksCache = new WeakMap()

function keySetFor(jwks) {
	if (!jwks || !Array.isArray(jwks.keys)) {
		throw metro.metroError('metro.oidc: Error: jwks must be an object with a keys array')
	}
	if (!jwksCache.has(jwks)) {
		jwksCache.set(jwks, createLocalJWKSet(jwks))
	}
	return jwksCache.get(jwks)
}

function supportedAlgorithms(openidConfiguration = {}) {
	const algorithms = openidConfiguration.id_token_signing_alg_values_supported
	if (Array.isArray(algorithms) && algorithms.length) {
		return algorithms.filter(algorithm => algorithm !== 'none')
	}
	return ['RS256']
}

/**
 * Validate an OpenID Connect ID Token.
 *
 * This intentionally keeps jose behind a tiny Metro/OIDC helper so the public
 * OIDC middleware API can stay small while still delegating JWT/JWS/JWKS
 * validation to a mature library.
 */
export async function validateIdToken(idToken, options = {}) {
	if (!idToken) {
		throw metro.metroError('metro.oidc: Error: token response did not include an id_token')
	}
	if (!options.jwks) {
		throw metro.metroError('metro.oidc: Error: cannot validate id_token without jwks')
	}
	if (!options.issuer) {
		throw metro.metroError('metro.oidc: Error: cannot validate id_token without issuer')
	}
	if (!options.client_id) {
		throw metro.metroError('metro.oidc: Error: cannot validate id_token without client_id')
	}

	const { payload, protectedHeader } = await jwtVerify(
		idToken,
		keySetFor(options.jwks),
		{
			issuer: options.issuer,
			audience: options.client_id,
			algorithms: options.algorithms || supportedAlgorithms(options.openid_configuration),
			clockTolerance: options.clockTolerance ?? 60,
			requiredClaims: ['iss', 'sub', 'aud', 'exp', 'iat']
		}
	)

	if (options.nonce !== undefined && payload.nonce !== options.nonce) {
		throw metro.metroError('metro.oidc: Error: id_token nonce mismatch')
	}

	return {
		header: protectedHeader,
		claims: payload
	}
}
