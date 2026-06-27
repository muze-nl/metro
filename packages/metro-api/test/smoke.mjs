import tap from 'tap'
import { client, response } from '@muze-nl/metro-core'
import { API, JsonAPI, api, jsonApi } from '@muze-nl/metro-api'

tap.test('api package exposes method containers on top of Metro clients', async t => {
	t.equal(typeof API, 'function')
	t.equal(typeof JsonAPI, 'function')
	t.equal(typeof api, 'function')
	t.equal(typeof jsonApi, 'function')

	const base = client('https://example.test/', async req => {
		t.equal(req.url, 'https://example.test/posts/1')
		return response(JSON.stringify({ id: 1, title: 'Metro' }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		})
	})

	const posts = jsonApi(base, {
		getPost(id) {
			return this.get(`/posts/${id}`)
		}
	})

	const post = await posts.getPost(1)
	t.same(post, { id: 1, title: 'Metro' })
})
