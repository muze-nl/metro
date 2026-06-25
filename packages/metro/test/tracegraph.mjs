import tap from 'tap'
import * as metro from '../src/metro.mjs'
import { graph, memoryStore, renderSequence } from '../src/tracegraph.mjs'

tap.test('trace graph records nested middleware and fetch spans', async t => {
	const originalFetch = globalThis.fetch
	globalThis.fetch = async () => new Response('nope', { status: 500 })
	t.teardown(() => {
		globalThis.fetch = originalFetch
		metro.trace.clear()
	})

	const tracer = graph({ persist: false, autoPrint: false })
	metro.trace.clear()
	metro.trace.add('graph', tracer)

	const client = metro.client()
		.with(async function first(req, next) { return next(req) })
		.with(async function second(req, next) { return next(req) })

	const response = await client.get('/broken')
	t.equal(response.status, 500)

	const trace = tracer.get()
	t.equal(trace.status, 'error')
	t.equal(trace.diagnostics[0].code, 'unexpected-status')
	t.match(tracer.render(), /browserFetch returned unexpected HTTP 500/)
	t.match(tracer.render(), /└─/)
})

tap.test('trace graph records network errors', async t => {
	const originalFetch = globalThis.fetch
	globalThis.fetch = async () => { throw new TypeError('Failed to fetch') }

	t.teardown(() => {
		globalThis.fetch = originalFetch
		metro.trace.clear()
	})

	const tracer = graph({ persist: false, autoPrint: false })
	metro.trace.clear()
	metro.trace.add('graph', tracer)

	const client = metro.client().with(async function pass(req, next) { return next(req) })
	await t.rejects(client.get('/offline'), /Failed to fetch/)

	const trace = tracer.get()
	t.equal(trace.status, 'error')
	t.equal(trace.diagnostics[0].code, 'network-error')
	t.match(tracer.render(), /✖ network-error: Failed to fetch/)
})

tap.test('trace graph supports persistent-flow links and manual events', t => {
	const store = memoryStore()
	const tracer = graph({ persist: false, autoPrint: false, store })
	const traceId = tracer.startTrace('oauth flow')
	tracer.event('window.open', {
		from: 'App',
		to: 'Identity Provider',
		label: 'authorize'
	})
	tracer.link('state-123', traceId)
	tracer.pause()
	tracer.resumeLink('state-123')
	tracer.event('callback received', {
		from: 'Identity Provider',
		to: 'App',
		label: 'callback'
	})

	const trace = tracer.get(traceId)
	t.equal(trace.events.length, 2)
	t.match(renderSequence(trace), /Identity Provider/)
	t.match(renderSequence(trace), /callback/)
	t.end()
})
