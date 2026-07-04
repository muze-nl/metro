import tap from 'tap'
import metro from '@muze-nl/metro'
import oldmmw from '../src/oldmmw.mjs'

const turtle = `@prefix schema: <https://schema.org/> .
<#me> schema:name "Ada" .
`

function mockLinkedDataServer(t, options = {}) {
	return async (req) => {
		if (req.url.endsWith('/people.ttl')) {
			t.equal(req.headers.get('Accept'), options.accept || 'text/turtle')
			return metro.response({
				status: 200,
				statusText: 'OK',
				headers: {
					'Content-Type': options.contentType || 'text/turtle'
				},
				body: options.body || turtle
			})
		}
		if (req.url.endsWith('/save.ttl')) {
			t.equal(req.method, 'POST')
			t.equal(req.headers.get('Content-Type'), options.contentType || 'text/turtle')
			t.equal(await req.clone().text(), options.expectedBody || turtle)
			return metro.response({
				status: 201,
				statusText: 'Created',
				body: 'created'
			})
		}
		return metro.response({
			status: 404,
			statusText: 'Not Found',
			body: 'not found'
		})
	}
}

tap.test('GET adds an Accept header and parses Turtle responses into OLDM data', async t => {
	const client = metro.client().with(mockLinkedDataServer(t)).with(oldmmw())

	const res = await client.get('https://example.test/people.ttl')
	t.ok(res.ok)
	t.equal(res.data.constructor.name, 'Graph')
	t.ok(res.data.subjects['https://example.test/people.ttl#me'])
	t.equal(res.data.subjects['https://example.test/people.ttl#me']['schem$name'].toString(), 'Ada')
})

tap.test('GET leaves non-linked-data responses unchanged', async t => {
	const client = metro.client().with(mockLinkedDataServer(t, {
		contentType: 'text/plain',
		body: turtle
	})).with(oldmmw())

	const res = await client.get('https://example.test/people.ttl')
	t.ok(res.ok)
	t.equal(await res.text(), turtle)
	t.equal(res.data, turtle)
})

tap.test('POST serializes object data with the configured writer', async t => {
	const body = '@prefix schema: <https://schema.org/> .\n<#me> schema:name "Grace" .\n'
	const data = { example: true }
	const client = metro.client()
		.with(mockLinkedDataServer(t, { expectedBody: body }))
		.with(oldmmw({
			writer: async value => {
				t.equal(value, data)
				return body
			}
		}))

	const res = await client.post('https://example.test/save.ttl', { body: data })
	t.equal(res.status, 201)
	t.equal(await res.text(), 'created')
})

tap.test('POST leaves explicit non-linked-data content alone', async t => {
	const data = { hello: 'world' }
	const client = metro.client()
		.with(async req => {
			t.equal(req.headers.get('Content-Type'), 'application/json')
			t.equal(await req.clone().text(), '[object Object]')
			return metro.response({ status: 200, body: 'ok' })
		})
		.with(oldmmw())

	const res = await client.post('https://example.test/save.ttl', {
		body: data,
		headers: {
			'Content-Type': 'application/json'
		}
	})
	t.ok(res.ok)
})
