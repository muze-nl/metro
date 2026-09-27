import tap from 'tap'
import metro from '@muze-nl/metro'
import oidcmw from '../src/oidcmw.mjs'
import oidcmockserver from '../src/oidc.mockserver.mjs'

const issuer = 'https://issuer.example/'
const redirect_uri = 'https://client.example/callback'

/**
 * Logs in with an authorize_callback that returns the full authorization
 * response with the given iss, as authorizePopup does.
 */
function login(responseIss)
{
	const client = metro.client(issuer).with(oidcmockserver({ issuer, redirect_uri }))
	const api = client.with(oidcmw({
		client,
		issuer,
		use_dpop: false,
		client_info: {
			redirect_uris: [redirect_uri],
			client_name: 'Metro Test Client'
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

tap.test('oidcmw accepts an authorization response from its issuer', async t => {
	const res = await login(issuer)
	t.ok(res.ok)
})

tap.test('oidcmw refuses an authorization response from another issuer', async t => {
	await t.rejects(login('https://evil.example/'), /from issuer https:\/\/evil\.example\//)
})
