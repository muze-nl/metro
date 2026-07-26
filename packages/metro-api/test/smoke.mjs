import tap from 'tap'
import { client, response } from '@muze-nl/metro-core'
import { getdata, thrower } from '@muze-nl/metro-middleware'
import { API, api, jsonApi } from '@muze-nl/metro-api'

tap.test('api package exposes method containers on top of Metro clients', async t => {
	t.equal(typeof API, 'function')
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

tap.test('API constructor binds methods without adding middleware', async t => {
	const res = response('created', { status: 201 })
	const base = client('https://example.test/', async req => {
		t.equal(req.url, 'https://example.test/posts/1')
		return res
	})

	const posts = new API(base, {
		createPost(id) {
			return this.post(`/posts/${id}`)
		}
	})

	t.equal(await posts.createPost(1), res)
})

tap.test('API constructor requires an absolute URL when base is not a Metro client', async t => {
	const options = { url: '/relative/' }
	t.throws(() => new API('/relative/'), {
		name: 'TypeError',
		message: 'metro-api: API base must be an absolute URL or Metro client',
		cause: '/relative/'
	})
	t.throws(() => new API(options), {
		name: 'TypeError',
		message: 'metro-api: API base must be an absolute URL or Metro client',
		cause: options
	})
	t.doesNotThrow(() => new API('https://example.test/'))
	t.doesNotThrow(() => new API({ url: 'https://example.test/' }))
	t.doesNotThrow(() => new API(new URL('https://example.test/')))
})

tap.test('libraries can pass a configured client to API', async t => {
	const responseProperty = Symbol('response')
	const res = response('', { status: 204 })
	const base = client('https://example.test/', async req => {
		t.equal(req.url, 'https://example.test/posts/1')
		return res
	}).with(thrower(), getdata({
		alwaysData: true,
		responseProperty
	}))

	const posts = new API(base, {
		deletePost(id) {
			return this.delete(`/posts/${id}`)
		}
	})

	const data = await posts.deletePost(1)

	t.same(data, {})
	t.equal(data[responseProperty], res)
})
