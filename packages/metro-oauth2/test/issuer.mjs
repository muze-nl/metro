import tap from 'tap'
import metro from '@muze-nl/metro'
import oauth2mw from '../src/oauth2.mjs'
import oauth2mockserver from '../src/oauth2.mockserver.mjs'

const redirect_uri = 'https://client.example/callback'
const issuer = 'https://issuer.example/'

/**
 * Logs in with an authorize_callback that returns the full authorization
 * response, with the given iss, as the popup flow does.
 */
function login(responseIss, oauth2_configuration = {})
{
	const client = metro.client().with(oauth2mockserver({ redirect_uri }))
	const api = client.with(oauth2mw({
		client,
		site: `test-${Math.random()}`,
		force_authorization: true,
		oauth2_configuration: {
			client_id: 'mockClientId',
			client_secret: 'mockClientSecret',
			grant_type: 'authorization_code',
			authorization_endpoint: '/authorize/',
			token_endpoint: '/token/',
			redirect_uri,
			issuer,
			...oauth2_configuration
		},
		authorize_callback: async url => {
			const res = await client.get(url)
			return {
				authorization_code: (await res.json()).code,
				state: url.searchParams.get('state'),
				iss: responseIss
			}
		}
	}))
	return api.get('/protected/')
}

tap.test('an authorization response from the expected issuer is accepted', async t => {
	const res = await login(issuer)
	t.ok(res.ok)
})

tap.test('an authorization response from another issuer is refused', async t => {
	await t.rejects(login('https://evil.example/'),
		/authorization response is from issuer https:\/\/evil\.example\/, expected https:\/\/issuer\.example\//)
})

tap.test('a missing iss is refused when the issuer always sends it', async t => {
	await t.rejects(login(undefined, {
		authorization_response_iss_parameter_supported: true
	}), /missing iss/)
})

tap.test('a missing iss is accepted from issuers that do not send it', async t => {
	const res = await login(undefined)
	t.ok(res.ok)
})

tap.test('iss is checked for redirect logins as well', async t => {
	globalThis.window = {
		location: new URL(redirect_uri + '?code=someCode&state=someState&iss=https%3A%2F%2Fevil.example%2F')
	}
	globalThis.history = { pushState() {} }
	t.teardown(() => {
		delete globalThis.window
		delete globalThis.history
	})

	await t.rejects(login(issuer), /from issuer https:\/\/evil\.example\//)
})
