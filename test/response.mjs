import tap from 'tap'
import * as metro from '../src/metro.mjs'

tap.test('start', t => {
	let res = metro.response('body')
	t.equal(''+res.body, 'body')
	t.end()
})

tap.test('copy', t => {
	let res = metro.response('body', {
		status: 200
	})
	let res2 = metro.response(res, {
		status: 201
	})
	t.equal(res.status, 200)
	t.equal(res2.status, 201)
	t.equal(''+res2.body, 'body')
	t.end()
})

tap.test('headers', t => {
	let res = metro.response('body', {
		headers: {
			'X-Foo': 'bar'
		}
	})
	let res2 = new Response('body', {
		headers: {
			'X-Foo':'bar'
		}
	})
	t.has(res.headers.get('x-foo'), 'bar')
	t.end()
})

tap.test('bodyFormData', t => {
	let fd = new FormData()
	fd.append('foo','bar')
	let res = metro.response(fd)
	t.ok(res.body instanceof ReadableStream)
	t.ok(res.body[Symbol.metroProxy])
	let x = res.body.get('foo')
	t.equal(res.body.get('foo'), 'bar')
	t.end()
})

tap.test('bodyReadableStream', async t => {
	let res = metro.response('This is the body')
	let reader = res.body.getReader()
	let result = await reader.read().then(({done, value}) => value)
	t.ok(result instanceof Uint8Array)
	t.end()
})

tap.test('bodyFunction', t => {
	let res = metro.response('This is the body', {
		body: (b, r) => {
			r.body = b+' altered'
		}
	})
	t.equal(''+res.body, 'This is the body altered')
	t.end()
})

tap.test('text', async t => {
	let res = metro.response('This is the body')
	let s = await res.text()
	t.equal(s, 'This is the body')
	t.end()
})

