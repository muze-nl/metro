import tap from 'tap'
import { getEventListeners } from 'node:events'
import { client, response } from '@muze-nl/metro-core'
import { abort, timeout } from '@muze-nl/metro-middleware'

const { combineSignals } = abort

function server()
{
	return async () => response('ok')
}

tap.test('requests do not accumulate listeners on a long-lived signal', async t => {
	const app = new AbortController()
	const api = client(server())
		.with(abort(app.signal))
		.with(timeout({ ms: 1000, signal: app.signal }))

	for (let i = 0; i < 50; i++) {
		await api.get('https://example.test/')
	}

	t.equal(getEventListeners(app.signal, 'abort').length, 0)
})

tap.test('aborting the long-lived signal still aborts a request in progress', async t => {
	const app = new AbortController()
	let seenSignal = null
	const api = client(async req => {
		seenSignal = req.signal
		await new Promise(resolve => setTimeout(resolve, 20))
		return response('ok')
	}).with(abort(app.signal))

	const pending = api.get('https://example.test/')
	await new Promise(resolve => setTimeout(resolve, 5))
	app.abort(new Error('user left'))
	await pending

	t.ok(seenSignal.aborted)
	t.equal(seenSignal.reason.message, 'user left')
})

tap.test('combineSignals keeps the reason of an already aborted signal', async t => {
	const aborted = new AbortController()
	aborted.abort(new Error('already'))
	const signal = combineSignals(new AbortController().signal, aborted.signal)

	t.ok(signal.aborted)
	t.equal(signal.reason.message, 'already')
})

tap.test('combineSignals returns a single signal unchanged', async t => {
	const controller = new AbortController()

	t.equal(combineSignals(null, controller.signal), controller.signal)
	t.equal(combineSignals(), null)
})
