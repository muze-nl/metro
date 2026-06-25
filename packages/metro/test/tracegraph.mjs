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

tap.test('trace graph can be scoped to one client without global tracers', async t => {
	const tracer = graph({ persist: false, autoPrint: false })
	metro.trace.clear()

	const traced = metro.client({ trace: tracer })
		.with(async function server() { return new Response('traced', { status: 200 }) })
	const untraced = metro.client()
		.with(async function server() { return new Response('plain', { status: 200 }) })

	await traced.get('/traced')
	await untraced.get('/plain')

	const trace = tracer.get()
	t.match(trace.name, /GET \/traced/)
	t.match(tracer.render(), /\/traced/)
	t.notMatch(tracer.render(), /\/plain/)
})


function waitFor(check)
{
	return new Promise(resolve => {
		function poll() {
			if (check()) {
				resolve()
			} else {
				setTimeout(poll, 0)
			}
		}
		poll()
	})
}

tap.test('trace graph keeps overlapping requests in separate traces', async t => {
	const tracer = graph({ persist: false, autoPrint: false })
	metro.trace.clear()
	metro.trace.add('graph', tracer)
	t.teardown(() => metro.trace.clear())

	const release = {}
	const client = metro.client().with(async function server(req) {
		const path = new URL(req.url).pathname
		await new Promise(resolve => { release[path] = resolve })
		return new Response(path, { status: 200 })
	})

	const first = client.get('/first')
	const second = client.get('/second')
	await waitFor(() => release['/first'] && release['/second'])
	release['/second']()
	await second
	release['/first']()
	await first

	const last = tracer.get()
	t.match(last.name, /GET \/first|GET \/second/)
	const firstTraceId = tracer.store.lastTraceId()
	const renderedLast = tracer.render(firstTraceId)
	t.ok(renderedLast.includes('/first') || renderedLast.includes('/second'))
	t.notOk(renderedLast.includes('/first') && renderedLast.includes('/second'), 'one rendered trace does not contain both overlapping requests')
})

tap.test('middleware can pass scoped trace context to nested Metro calls', async t => {
	const tracer = graph({ persist: false, autoPrint: false })
	metro.trace.clear()

	const internal = metro.client()
		.with(async function tokenServer() { return new Response('token', { status: 200 }) })
	const client = metro.client({ trace: tracer })
		.with(async function resource() { return new Response('ok', { status: 200 }) })
		.with(async function oidc(req, next, context) {
			await internal.get('/token', context.trace.options())
			return next(req)
		})

	await client.get('/profile')
	const rendered = tracer.render()
	t.match(rendered, /oidc/)
	t.match(rendered, /\/token/)
	t.match(rendered, /\/profile/)
})
