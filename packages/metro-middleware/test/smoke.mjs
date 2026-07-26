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

tap.test('getdata can always return a data object with response metadata', async t => {
	const responseProperty = Symbol('response')
	const res = response('', { status: 204 })
	const api = client(async () => res).with(getdata({
		alwaysData: true,
		responseProperty
	}))

	const data = await api.delete('https://example.test/posts/1')

	t.same(data, {})
	t.equal(data[responseProperty], res)
	t.same(Object.keys(data), [])
})

tap.test('getdata keeps primitive data unless response metadata must be attached', async t => {
	const responseProperty = Symbol('response')
	const primitiveResponse = {
		ok: true,
		data: false
	}
	const api = client(async () => primitiveResponse).with(getdata({ alwaysData: true }))

	t.equal(await api.get('https://example.test/flag'), false)

	const metadataApi = client(async () => primitiveResponse).with(getdata({
		alwaysData: true,
		responseProperty
	}))

	await t.rejects(
		metadataApi.get('https://example.test/flag'),
		/getdata: responseProperty requires response.data to be an object/
	)
})
