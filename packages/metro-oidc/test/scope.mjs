import tap from 'tap'
import metro from '@muze-nl/metro'
import oidcmw from '../src/oidcmw.mjs'
import oidcmockserver from '../src/oidc.mockserver.mjs'

const issuer = 'https://issuer.example/'
const redirect_uri = 'https://client.example/callback'
const webid = 'https://alice.example/profile/card#me'

/**
 * Logs in and returns the scope of the authorization request.
 */
async function requestedScope(oidcOptions = {}, mockOptions = {})
{
	const client = metro.client(issuer).with(oidcmockserver({
		issuer,
		redirect_uri,
		idTokenClaims: { webid },
		...mockOptions
	}))
	let scope
	const api = client.with(oidcmw({
		client,
		issuer,
		use_dpop: false,
		client_info: {
			redirect_uris: [redirect_uri],
			client_name: 'Metro Test Client'
		},
		authorize_callback: async url => {
			scope = url.searchParams.get('scope')
			const res = await client.get(url)
			return (await res.json()).code
		},
		...oidcOptions
	}))
	await api.get('/protected/')
	return scope
}

tap.test('the webid scope is requested when a WebID is given', async t => {
	t.equal(await requestedScope({ webid }), 'openid webid')
})

tap.test('the webid scope is requested from a Solid-OIDC issuer', async t => {
	const scope = await requestedScope({}, {
		scopes_supported: ['openid', 'webid']
	})
	t.equal(scope, 'openid webid')
})

tap.test('other issuers get the openid scope', async t => {
	t.equal(await requestedScope(), 'openid')
})

tap.test('an explicit scope is used as given', async t => {
	t.equal(await requestedScope({ webid, scope: 'openid profile' }), 'openid profile')
})
