import tap from 'tap'
import * as metro from '../src/metro.mjs'
import echomw from '../src/mw/echo.mock.mjs'
import jsonmw from '../src/mw/json.mjs'

tap.test('deepClone', t => {
	let options = {
		foo: 'bar',
		client: metro.client(),
		middlewares: (req,next) => new Response('This is the body'),
		sub: {
			foo: 'baz',
		},
		arr: [
			'foo',
			{
				foo: 'barr'
			}
		]
	}
	let clone = metro.deepClone(options)
	t.same(clone, options)
	t.equal(clone.client, options.client)
	t.not(clone.sub, options.sub)
	t.same(clone.sub, options.sub)
	t.not(clone.arr, options.arr)
	t.same(clone.arr, options.arr)
	t.equal(clone.middlewares, options.middlewares)
	t.end()
})

tap.test('start', async t => {
	const options = {
		baseURL: 'https://muze.nl',
		middlewares: (req,next) => new Response('This is the body')
	}
	let c = metro.client(options)
	let res = await c.get('foo/')
	let content = await res.text()
	t.equal(content, 'This is the body')
	t.end()
})

tap.test('start', async t => {
	let c = metro.client(
		{
			middlewares: (req,next) => {
				if (req.url=='https://example.com/') {
					return new Response('This is the body')
				} else {
					return new Response(req)
				}
			}
		}
	)
	let res = await c.get('https://example.com/')
	let content = await res.text()
	t.equal(content, 'This is the body')
	t.end()
})

tap.test('withFunction', async t => {
	let c = metro.client()
	c = c.with((req,next) => metro.response('This is the body'))
	let res = await c.get('foo/')
	t.equal(''+res.data, 'This is the body')
	t.end()
})

tap.test('tracers', async t => {
	let c = metro.client()
	let trace = []
	metro.trace.add('test', {
		request: r => trace.push({request: r}),
		response: r => trace[trace.length-1].response = r
	})
	c = c.with((req,next) => metro.response('This is the body'))
	let res = await c.get('foo/')
	t.equal(trace.length, 1)
	t.equal(trace[0].request.url, 'https://localhost/foo/')
	t.equal(''+trace[0].response.data, 'This is the body')
	t.equal(''+res.data, 'This is the body')
	t.end()
})

tap.test('post body', async t => {
	let url = 'http://localhost:3000/query/'
	let client = metro.client(url).with(echomw())
	let response = await client.post({body:'foo'})
	let body = await response.text()
	t.equal(body, 'foo')
	t.end()
})

tap.test('fetch', async t => {
	let url = 'http://localhost:3000/query/'
	let client = metro.client(url).with(echomw())
	let response = await client.fetch({method: 'POST', body:'foo'})
	let body = await response.text()
	t.equal(body, 'foo')
	t.end()	
})

tap.test('get location', t => {
	let url = 'http://localhost:3000/query/'
	let client = metro.client(url)
	t.equal(client.location.href, url)
	t.end()
})
