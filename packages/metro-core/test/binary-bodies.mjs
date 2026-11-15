import tap from 'tap'
import {runInNewContext} from 'node:vm'
import {client, request, response} from '@muze-nl/metro-core'

const url = 'https://example.test/upload'
const bytes = async value => [...new Uint8Array(await value.arrayBuffer())]
const constructors = [
	Uint8Array, Int8Array, Uint8ClampedArray, Uint16Array, Int16Array,
	Uint32Array, Int32Array, Float32Array, Float64Array,
	BigInt64Array, BigUint64Array
]

function views() {
	const buffer = Uint8Array.from([
		31, 32, 0, 255, 128, 7, 10, 13,
		33, 34, 35, 36, 37, 38, 39, 40,
		41, 42, 43, 44, 45, 46, 47, 48
	]).buffer
	return [
		...constructors.map(Type => new Type(buffer, Type.BYTES_PER_ELEMENT, 2)),
		new DataView(buffer, 3, 7)
	]
}

tap.test('request options preserve each native typed-array body and byte range', async t => {
	for (const body of views()) {
		const expected = await bytes(new Request(url, {method: 'PUT', body}))
		const req = request(url, {method: 'PUT', body})
		t.same(await bytes(req), expected, body.constructor.name)
		t.equal(req.data, body, 'data retains the original view')
	}
})

tap.test('direct request body arguments preserve each native view', async t => {
	for (const body of views()) {
		const expected = await bytes(new Request(url, {method: 'PUT', body}))
		const req = request(url, {method: 'PUT'}, body)
		t.same(await bytes(req), expected, body.constructor.name)
		t.equal(req.data, body)
	}
})

tap.test('response bodies preserve views in both supported argument forms', async t => {
	for (const body of views()) {
		const expected = await bytes(new Response(body))
		for (const res of [response(body), response({body})]) {
			t.same(await bytes(res), expected, body.constructor.name)
			t.equal(res.data, body)
		}
	}
})

tap.test('subarrays and zero-length views never expose adjacent buffer bytes', async t => {
	const buffer = new Uint8Array([91, 0, 255, 128, 92])
	for (const [body, expected] of [
		[buffer.subarray(1, 4), [0, 255, 128]],
		[new DataView(buffer.buffer, 1, 3), [0, 255, 128]],
		[buffer.subarray(2, 2), []],
		[new DataView(buffer.buffer, 2, 0), []]
	]) {
		t.same(await bytes(request(url, {method: 'PUT', body})), expected)
		t.same(await bytes(request(url, {method: 'PUT'}, body)), expected)
		t.same(await bytes(response(body)), expected)
		t.same(await bytes(response({body})), expected)
	}
	t.same([...buffer], [91, 0, 255, 128, 92], 'the source remains intact')
})

tap.test('binary request bodies survive cloning, derivation and replacement', async t => {
	const body = new Uint8Array([91, 0, 255, 128, 92]).subarray(1, 4)
	const req = request(url, {method: 'PUT', body})
	const cloned = req.clone()
	const derived = req.with({headers: {'X-Test': 'derived'}})
	const replacement = new Uint8Array([7, 8])
	const replaced = req.with({body: replacement})
	for (const current of [req, cloned, derived]) {
		t.equal(current.data, body)
		t.same(await bytes(current), [0, 255, 128])
	}
	t.equal(derived.headers.get('X-Test'), 'derived')
	t.same(await bytes(replaced), [7, 8])
	t.equal(replaced.data, replacement)
})

tap.test('binary response bodies survive derivation without changing status', async t => {
	const body = new Uint8Array([91, 0, 255, 128, 92]).subarray(1, 4)
	const res = response(body, {status: 201})
	const derived = res.with({headers: {'X-Test': 'derived'}})
	t.same(await bytes(derived), [0, 255, 128])
	t.equal(derived.status, 201)
	t.equal(response(body, {status: 204}).body, null)
})

tap.test('typed arrays use native byte extraction rather than custom serialization', async t => {
	const body = new Uint8Array([0, 255, 128])
	body.toString = () => { throw new Error('A binary body must not be stringified') }
	t.same(await bytes(request(url, {method: 'PUT', body})), [0, 255, 128])
})

tap.test('custom object bodies receive the request headers when serialized', async t => {
	const body = {
		toString(options) {
			return options?.headers?.get('Accept') === 'text/turtle'
				? 'Selected Turtle representation'
				: 'Default representation'
		}
	}
	const req = request(url, {
		method: 'PUT', body, headers: {Accept: 'text/turtle'}
	})
	t.equal(req.data, body)
	t.equal(await req.text(), 'Selected Turtle representation')
})

tap.test('client PUT preserves binary bodies through middleware', async t => {
	const calls = []
	const api = client(url).with(async (req, next) => {
		calls.push(req.method)
		return response(await req.arrayBuffer())
	})
	const body = new Uint8Array([91, 0, 255, 128, 92]).subarray(1, 4)
	t.same(await bytes(await api.put({body})), [0, 255, 128])
	t.same(await bytes(await api.put(body)), [0, 255, 128])
	t.same(calls, ['PUT', 'PUT'])
})


tap.test('views from another realm remain binary body values', async t => {
	const body = runInNewContext('new Uint8Array([91, 0, 255, 128, 92]).subarray(1, 4)')
	t.notOk(body instanceof Uint8Array, 'the view has a different constructor realm')
	for (const value of [
		request(url, {method: 'PUT', body}), request(url, {method: 'PUT'}, body),
		response(body), response({body})
	]) {
		t.same(await bytes(value), [0, 255, 128])
	}
})

tap.test('Node Buffer slices preserve the selected bytes', async t => {
	const body = Buffer.from([91, 0, 255, 128, 92]).subarray(1, 4)
	for (const value of [
		request(url, {method: 'PUT', body}), request(url, {method: 'PUT'}, body),
		response(body), response({body})
	]) {
		t.same(await bytes(value), [0, 255, 128])
	}
})
