import tap from 'tap'
import * as metro from '@muze-nl/metro'
import oauth2mw from '../src/oauth2.mjs'
import oauth2mockserver from '../src/oauth2.mockserver.mjs'

let client = metro.client().with(oauth2mockserver())

tap.test('start', async t => {
	let res = await client.get('/public/')
	t.ok(res.ok)
	t.end()
})

tap.test('oauth2start', async t => {
	const oauth2client = client.with(oauth2mw({
		access_token: {
			type: 'Bearer',
			value: 'mockAccessToken'
		},
		force_authorization: true
	}))

	let res = await oauth2client.get('/protected/')
	t.ok(res.ok)
	let json = await res.json()
	t.equal(json.result,'Success')
	t.end()
})

tap.test('authorize', async t => {
	const oauth2client = client.with(oauth2mw({
		client: client, // with mock oauth2 middleware
		client_id: 'mockClientId',
		client_secret: 'mockClientSecret',
		grant_type: 'authorization_code',
		endpoints: {
			authorize: '/authorize/',
			token: '/token/'
		},
		callbacks: {
			authorize: (url) => 'mockAuthorizeToken'
		}
	}))
	let url = metro.url('/protected/')
//	metro.trace.add('group', metro.trace.group())
	metro.trace.add('group', {
		request: req => console.log(req.url)
	})
	let res = await oauth2client.get(url)
		t.ok(res.ok)
	let json = await res.json()
	t.equal(json.result,'Success')
	t.end()
})