import tap from 'tap'
import { client, response } from '@muze-nl/metro-core'
import mw, { json, thrower, getdata, retry, timeout, abort, backoff, echoMock, errorMock } from '@muze-nl/metro-middleware'

tap.test('middleware package exports the generic middleware factories', async t => {
	for (const fn of [json, thrower, getdata, retry, timeout, abort, backoff, echoMock, errorMock]) {
		t.equal(typeof fn, 'function')
	}
	t.equal(typeof mw.json, 'function')
	t.equal(typeof mw.retry, 'function')

	const api = client(async req => {
		t.equal(req.headers.get('Accept'), 'application/json')
		t.equal(req.headers.get('Content-Type'), 'application/json')
		t.same(JSON.parse(await req.clone().text()), { title: 'Metro' })
		return response(JSON.stringify({ ok: true }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		})
	}).with(json(), getdata())

	const data = await api.post('https://example.test/posts', {
		body: { title: 'Metro' }
	})
	t.same(data, { ok: true })
})
