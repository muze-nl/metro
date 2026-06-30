import tap from 'tap'
import { Client, client, request, response, url, deepClone } from '@muze-nl/metro-core'

tap.test('core package exports the Fetch-shaped helpers', async t => {
	t.equal(typeof Client, 'function')
	t.equal(typeof client, 'function')
	t.equal(typeof request, 'function')
	t.equal(typeof response, 'function')
	t.equal(typeof url, 'function')
	t.equal(typeof deepClone, 'function')

	const req = request('https://example.test/items', {
		method: 'POST',
		body: 'hello'
	})
	t.equal(req.method, 'POST')
	t.equal(req.url, 'https://example.test/items')
	t.equal(await req.clone().text(), 'hello')

	const res = response('created', { status: 201 })
	t.equal(res.status, 201)
	t.equal(res.ok, true)
	t.equal(await res.text(), 'created')

	const endpoint = url('https://example.test/path/file.txt').with({ searchParams: { page: 2 } })
	t.equal(endpoint.searchParams.get('page'), '2')

	const api = client(async req => response(`mocked ${req.method}`, { status: 202 }))
	const mocked = await api.get('https://example.test/mock')
	t.equal(mocked.status, 202)
	t.equal(await mocked.text(), 'mocked GET')
})
