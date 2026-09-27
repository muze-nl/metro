import tap from 'tap'
import metro from '@muze-nl/metro'
import oidcmw from '../src/oidcmw.mjs'
import oidcmockserver from '../src/oidc.mockserver.mjs'

const issuer = 'https://issuer.example/'
const redirect_uri = 'https://client.example/callback'

function oidcOptions(client)
{
	return {
		client,
		issuer,
		use_dpop: false,
		client_info: {
			redirect_uris: [redirect_uri],
			client_name: 'Metro Test Client'
		},
		authorize_callback: async url => {
			const res = await client.get(url)
			return (await res.json()).code
		}
	}
}

tap.test('oidcmw authorizes when thrower is added after it', async t => {
	const client = metro.client(issuer).with(oidcmockserver({ issuer, redirect_uri }))
	const api = client.with(oidcmw(oidcOptions(client))).with(metro.mw.thrower())

	const res = await api.get('/protected/')

	t.ok(res.ok)
})

tap.test('oidcmw only sees responses, not errors from middleware inside it', async t => {
	const client = metro.client(issuer).with(oidcmockserver({ issuer, redirect_uri }))
	const api = client.with(metro.mw.thrower()).with(oidcmw(oidcOptions(client)))

	await t.rejects(api.get('/protected/'), /^401: Unauthorized/)
})
