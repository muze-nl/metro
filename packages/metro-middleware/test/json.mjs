import tap from 'tap'
import { client, response } from '@muze-nl/metro-core'
import { json } from '@muze-nl/metro-middleware'

function server(status, body)
{
	return async () => response(body, {
		status,
		headers: { 'Content-Type': 'application/json' }
	})
}

tap.test('json rejects a successful response that is not valid JSON', async t => {
	const api = client(server(200, '{ "title": ')).with(json())

	const error = await api.get('https://example.test/posts')
		.then(() => null, error => error)

	t.ok(error, 'the request rejects')
	t.match(error.message, /could not parse application\/json response from https:\/\/example\.test\/posts/)
	t.type(error.cause, SyntaxError)
	t.equal(error.request.url, 'https://example.test/posts')
	t.equal(error.response.status, 200)
	t.equal(await error.response.text(), '{ "title": ')
})

tap.test('json keeps an unparseable error response unchanged', async t => {
	const api = client(server(404, 'Not Found')).with(json())

	const res = await api.get('https://example.test/posts')
	t.equal(res.status, 404)
	t.equal(await res.text(), 'Not Found')
})

tap.test('json leaves an empty response body unparsed', async t => {
	const api = client(server(200, '')).with(json())

	const res = await api.get('https://example.test/posts')
	t.ok(res.ok)
	t.equal(await res.text(), '')
})
