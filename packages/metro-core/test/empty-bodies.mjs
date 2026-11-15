import tap from 'tap'
import {request, response} from '@muze-nl/metro-core'

const url = 'https://example.test/folder/'

for (const body of ['', 'content', 0, false]) {
	tap.test(`original request data remains replayable: ${JSON.stringify(body)}`, async t => {
		const original = request(url, {method: 'PUT', body})
		t.equal(await original.text(), String(body))
		for (const copy of [request(original), original.with({headers: {'X-Test': 'copy'}})]) {
			t.equal(copy.data, body)
			t.equal(await copy.text(), String(body))
		}
	})
	tap.test(`original response data remains replayable: ${JSON.stringify(body)}`, async t => {
		const original = response({body})
		t.equal(await original.text(), String(body))
		for (const copy of [response(original), original.with({headers: {'X-Test': 'copy'}})]) {
			t.equal(copy.data, body)
			t.equal(await copy.text(), String(body))
		}
	})
}

tap.test('body overrides replace retained data', async t => {
	const req = request(url, {method: 'PUT', body: ''})
	const res = response({body: ''})
	await req.text()
	await res.text()
	t.equal(await request(req, {body: 'new'}).text(), 'new')
	t.equal(await req.with({body: 'new'}).text(), 'new')
	t.equal(await response(res, {body: 'new'}).text(), 'new')
	t.equal(await res.with({body: 'new'}).text(), 'new')
})

tap.test('retained streams do not acquire replay guarantees', async t => {
	const req = request(url, {
		method: 'PUT', duplex: 'half',
		body: new ReadableStream({start(controller) {controller.close()}})
	})
	const res = response(new ReadableStream({start(controller) {controller.close()}}))
	await req.text()
	await res.text()
	t.throws(() => request(req), TypeError)
	t.throws(() => response(res), TypeError)
	t.throws(() => res.with({headers: {'X-Test': 'copy'}}), TypeError)
})


tap.test('bodyless responses do not acquire an empty data payload', async t => {
	for (const status of [204, 205, 304]) {
		const original = response('', {status})
		t.equal(original.body, null)
		t.equal(original.data, undefined)
		t.equal(response(original).body, null)
	}
})
