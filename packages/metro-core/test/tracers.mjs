import tap from 'tap'
import { client, response } from '@muze-nl/metro-core'

function failingTracer(method, isAsync = false)
{
	return {
		[method]: isAsync
			? async () => { throw new Error('tracer bug') }
			: () => { throw new Error('tracer bug') }
	}
}

function recordingTracer()
{
	const calls = []
	return {
		calls,
		request: () => calls.push('request'),
		response: () => calls.push('response'),
		error: () => calls.push('error')
	}
}

/**
 * Collects console.error output during a test, so reported tracer failures
 * can be checked and do not clutter the test output.
 */
function captureConsoleErrors(t)
{
	const errors = []
	const original = console.error
	console.error = (...args) => errors.push(args)
	t.teardown(() => {
		console.error = original
	})
	return errors
}

function server()
{
	const state = { calls: 0 }
	state.handle = async () => {
		state.calls++
		return response('created', { status: 201 })
	}
	return state
}

tap.test('a throwing request tracer does not prevent the request', async t => {
	const errors = captureConsoleErrors(t)
	const backend = server()
	const res = await client(backend.handle).post('https://example.test/', {
		body: 'data',
		tracer: failingTracer('request')
	})

	t.equal(res.status, 201)
	t.equal(backend.calls, 1)
	t.match(errors[0].join(' '), /tracer\.request\(\) failed/)
})

tap.test('a throwing response tracer does not turn success into failure', async t => {
	captureConsoleErrors(t)
	const backend = server()
	const res = await client(backend.handle).post('https://example.test/', {
		body: 'data',
		tracer: failingTracer('response')
	})

	t.equal(res.status, 201)
	t.equal(backend.calls, 1)
})

tap.test('a throwing error tracer does not replace the original error', async t => {
	captureConsoleErrors(t)
	const failure = new Error('real failure')
	const api = client(async () => {
		throw failure
	})

	const error = await api.get('https://example.test/', {
		tracer: failingTracer('error')
	}).then(() => null, error => error)

	t.equal(error, failure)
})

tap.test('a rejecting async tracer is reported, not left unhandled', async t => {
	const errors = captureConsoleErrors(t)
	let unhandled = null
	const onUnhandled = error => {
		unhandled = error
	}
	process.on('unhandledRejection', onUnhandled)
	t.teardown(() => process.off('unhandledRejection', onUnhandled))

	const backend = server()
	const res = await client(backend.handle).get('https://example.test/', {
		tracer: failingTracer('response', true)
	})
	await new Promise(resolve => setTimeout(resolve, 10))

	t.equal(res.status, 201)
	t.equal(unhandled, null)
	t.match(errors[0].join(' '), /tracer\.response\(\) failed/)
})

tap.test('a failing tracer does not stop the tracers after it', async t => {
	captureConsoleErrors(t)
	const backend = server()
	const recorder = recordingTracer()
	await client(backend.handle).get('https://example.test/', {
		tracers: [failingTracer('request'), recorder]
	})

	t.same(recorder.calls, ['request', 'response'])
})

tap.test('trace.event from middleware survives a failing tracer', async t => {
	captureConsoleErrors(t)
	const backend = server()
	const api = client(backend.handle).with(async (req, next, context) => {
		context.trace.event('checkpoint')
		return next(req)
	})

	const res = await api.get('https://example.test/', {
		tracer: failingTracer('event')
	})

	t.equal(res.status, 201)
})
