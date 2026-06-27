import tap from 'tap'
import { client, response } from '@muze-nl/metro-core'
import trace, { add, remove, clear, group, graph, GraphTracer } from '@muze-nl/metro-trace'

tap.test('trace package manages global and local tracers', async t => {
	t.equal(typeof add, 'function')
	t.equal(typeof remove, 'function')
	t.equal(typeof clear, 'function')
	t.equal(typeof group, 'function')
	t.equal(typeof graph, 'function')
	t.equal(typeof GraphTracer, 'function')
	t.equal(typeof trace.add, 'function')

	clear()
	const seen = []
	add('smoke', {
		request(req) {
			seen.push(['request', req.url])
		},
		response(res) {
			seen.push(['response', res.status])
		}
	})

	const api = client(async () => response('ok'))
	const res = await api.get('https://example.test/trace')
	t.equal(await res.text(), 'ok')
	t.same(seen, [
		['request', 'https://example.test/trace'],
		['response', 200]
	])

	remove('smoke')
	clear()
})
