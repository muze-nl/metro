import tap from 'tap'
import * as metro from '../src/metro.mjs'

tap.test('start', t => {
	let req = metro.request('https://example.com')
	t.equal(req.url, 'https://example.com/')
	t.end()
})

tap.test('copy', t => {
	let req = new Request('https://example.com')
	let req2 = metro.request(req, {url:'?foo=bar'})
	t.equal(req.url, 'https://example.com/')
	t.equal(req2.url, 'https://example.com/?foo=bar')
	t.end()
})

tap.test('url', t => {
	let req = metro.request('/protected/')
	t.equal(req.url, 'https://localhost/protected/')
	t.end()
})

tap.test('url2', t => {
	let req = metro.request('https://example.com','/protected/')
	t.equal(req.url, 'https://example.com/protected/')
	t.end()
})

tap.test('url3', t => {
	let req = metro.request('https://example.com',{method:'POST'},'/protected/')
	t.equal(req.url, 'https://example.com/protected/')
	t.equal(req.method, 'POST')
	t.end()
})

tap.test('url4', t => {
	let url = metro.url('/protected/')
	let req = metro.request('https://example.com',{method:'POST'},url)
	t.equal(req.url, 'https://localhost/protected/')
	t.equal(req.method, 'POST')
	t.end()
})

tap.test('headers', t => {
	let req = metro.request('https://example.com', {
		headers: {
			'X-Foo': 'bar'
		}
	})
	t.has(req.headers.get('x-foo'), 'bar')
	t.end()
})

tap.test('extend headers', t => {
	let req = metro.request('https://example.com', {
		headers: {
			'X-Foo': 'bar'
		}
	}).with({
		headers: {
			'X-Bar': 'foo'
		}
	})
	t.has(req.headers.get('x-foo'), 'bar')
	t.has(req.headers.get('x-bar'), 'foo')
	t.end()
})


tap.test('body', t => {
	let req = metro.request('https://example.com', {
		method: 'POST',
		body: 'This is the body'
	})
	t.equal(''+req.data, 'This is the body')
	t.end()
})

tap.test('bodyFormData', t => {
	let fd = new FormData()
	fd.append('foo','bar')
	let req = metro.request('https://example.com', {
		method: 'POST',
		body: fd
	})
	t.ok(req.body instanceof ReadableStream)
	t.ok(req.data instanceof FormData)
	t.equal(req.data.get('foo'), 'bar')
	t.end()
})

tap.test('inferBodyFromType', t => {
	let fd = new FormData()
	fd.append('foo','bar')
	let req = metro.request('https://example.com', {
		method: 'POST'
	}, fd)
	t.ok(req.body instanceof ReadableStream)
	t.ok(req.data instanceof FormData)
	t.equal(req.data.get('foo'), 'bar')
	t.end()
})

tap.test('bodyObject', t => {
	let body = {
		foo: "bar"
	}
	let req = metro.request('https://example.com', {
		method: 'POST',
		body: body
	})
	t.ok(req.body instanceof ReadableStream)
	t.equal(req.data.foo, 'bar')
	t.ok('foo' in req.data)
	t.ok(Object.prototype.hasOwnProperty.call(req.data,'foo'))
	t.ok(req.data.hasOwnProperty('foo'))
	t.end()
})

tap.test('bodyString', t => {
	let body = "bar"
	let req = metro.request('https://example.com', {
		method: 'POST',
		body: body
	})
	t.ok(req.body instanceof ReadableStream)
	t.equal(req.data+'', 'bar')
	t.end()
})

tap.test('bodyReadableStream', async t => {
	let req = metro.request('https://example.com', {
		method: 'POST',
		body: 'This is the body'
	})
	let reader = req.body.getReader()
	let result = await reader.read().then(({done, value}) => value)
	t.ok(result instanceof Uint8Array)
	t.end()
})

tap.test('bodyFunction', t => {
	let req = metro.request('https://example.com', {
		method: 'POST',
		body: 'This is the body'
	}, {
		body: (b, r) => {
			return b+' altered'
		}
	})
	t.equal(''+req.data, 'This is the body altered')
	t.end()
})

tap.test('clone', t => {
	let req = metro.request('https://example.com', {
		method: 'POST',
		body: 'This is the body'
	})
	let req2 = req.clone()
	t.not(req, req2)
	t.equal(req.url, req2.url)
	t.end()
})

tap.test('text', async t => {
	let req = metro.request('https://example.com', {
		method: 'POST',
		body: 'This is the body'
	})
	let s = await req.text()
	t.equal(s, 'This is the body')
	t.end()
})

tap.test('urlSearchParams', t => {
	let req = metro.request('https://example.com', {
		url: {
			searchParams: {
				foo: 'bar',
				bar: 'baz'
			}
		}
	})
	t.equal(req.url, 'https://example.com/?foo=bar&bar=baz')
	t.end()
})