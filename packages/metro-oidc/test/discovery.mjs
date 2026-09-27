import tap from 'tap'
import metro from '@muze-nl/metro'
import discover from '../src/oidc.discovery.mjs'

/**
 * A client whose issuer serves the given discovery document.
 */
function issuerServing(document)
{
	return metro.client(async () => metro.response({
		status: 200,
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(document)
	}))
}

function metadata(issuer, overrides = {})
{
	return {
		issuer,
		authorization_endpoint: issuer + 'authorize',
		token_endpoint: issuer + 'token',
		jwks_uri: issuer + 'jwks',
		response_types_supported: ['code'],
		subject_types_supported: ['public'],
		id_token_signing_alg_values_supported: ['RS256'],
		...overrides
	}
}

tap.test('discovery accepts metadata for the requested issuer', async t => {
	const issuer = 'https://issuer.example/'
	const config = await discover({ issuer, client: issuerServing(metadata(issuer)) })
	t.equal(config.issuer, issuer)
})

tap.test('discovery refuses metadata for another issuer', async t => {
	const client = issuerServing(metadata('https://evil.example/'))
	await t.rejects(discover({ issuer: 'https://issuer.example/', client }),
		/openid-configuration is for issuer https:\/\/evil\.example\/, expected https:\/\/issuer\.example\//)
})

tap.test('discovery allows the issuer to differ only by a trailing slash', async t => {
	const client = issuerServing(metadata('https://issuer.example/', {
		issuer: 'https://issuer.example'
	}))
	const config = await discover({ issuer: 'https://issuer.example/', client })
	t.equal(config.issuer, 'https://issuer.example')
})

tap.test('discovery refuses an http issuer', async t => {
	const issuer = 'http://issuer.example/'
	await t.rejects(discover({ issuer, client: issuerServing(metadata(issuer)) }),
		/issuer must use https/)
})

tap.test('discovery refuses an http token endpoint', async t => {
	const issuer = 'https://issuer.example/'
	const client = issuerServing(metadata(issuer, {
		token_endpoint: 'http://issuer.example/token'
	}))
	await t.rejects(discover({ issuer, client }), /token_endpoint must use https/)
})

tap.test('discovery refuses metadata without a jwks_uri', async t => {
	const issuer = 'https://issuer.example/'
	const client = issuerServing(metadata(issuer, { jwks_uri: undefined }))
	await t.rejects(discover({ issuer, client }), /has no jwks_uri/)
})

tap.test('discovery allows http on the local machine', async t => {
	const issuer = 'http://localhost:3000/'
	const config = await discover({ issuer, client: issuerServing(metadata(issuer)) })
	t.equal(config.issuer, issuer)
})
