import tap from 'tap'
import metro from '../src/everything.mjs'
import retry from '../src/mw/retry.mjs'
import timeout from '../src/mw/timeout.mjs'
import abort from '../src/mw/abort.mjs'
import backoff, { parseRetryAfter, parseRateLimitReset, parseCombinedRateLimit } from '../src/mw/backoff.mjs'

function textResponse(text, options={})
{
	return metro.response(text, options)
}

tap.test('retry retries safe requests on retryable responses', async t => {
	let calls = 0
	const flaky = async () => {
		calls++
		return calls == 1
			? textResponse('try again', { status: 503, statusText: 'Service Unavailable' })
			: textResponse('ok', { status: 200 })
	}
	const client = metro.client().with(flaky, retry({ attempts: 2, delay: 0, jitter: false }))
	const response = await client.get('/flaky')
	t.equal(response.status, 200)
	t.equal(calls, 2)
})

tap.test('retry respects Retry-After delays when retrying', async t => {
	let calls = 0
	const waits = []
	const flaky = async () => {
		calls++
		return calls == 1
			? textResponse('slow down', {
				status: 429,
				statusText: 'Too Many Requests',
				headers: { 'Retry-After': '2' }
			})
			: textResponse('ok', { status: 200 })
	}
	const client = metro.client().with(flaky, retry({
		attempts: 2,
		delay: 0,
		jitter: false,
		maxDelay: 25,
		sleep: async ms => waits.push(ms)
	}))
	const response = await client.get('/limited')

	t.equal(response.status, 200)
	t.same(waits, [25])
})

tap.test('timeout aborts a slow request', async t => {
	const slow = async req => new Promise((resolve, reject) => {
		req.signal.addEventListener('abort', () => reject(req.signal.reason), { once: true })
	})
	const client = metro.client().with(slow, timeout(5))
	await t.rejects(client.get('/slow'), /timed out/)
})

tap.test('abort middleware can cancel a client group', async t => {
	const controller = new AbortController()
	controller.abort(new Error('group cancelled'))
	const never = async () => textResponse('should not run')
	const client = metro.client().with(never, abort(controller.signal))
	await t.rejects(client.get('/cancelled'), /group cancelled/)
})

tap.test('backoff stores server requested backoff for later requests', async t => {
	let now = 1000
	const waits = []
	let calls = 0
	const server = async () => {
		calls++
		return calls == 1
			? textResponse('limited', {
				status: 429,
				headers: {
					'RateLimit-Remaining': '0',
					'RateLimit-Reset': '2'
				}
			})
			: textResponse('ok', { status: 200 })
	}
	const client = metro.client().with(server, backoff({
		now: () => now,
		sleep: async ms => { waits.push(ms); now += ms },
		maxDelay: 10000
	}))

	let first = await client.get('/quota')
	let second = await client.get('/quota')

	t.equal(first.status, 429)
	t.equal(second.status, 200)
	t.same(waits, [2000])
})

tap.test('backoff header parsers handle standard forms', t => {
	t.equal(parseRetryAfter('3'), 3000)
	t.equal(parseRateLimitReset('1.5'), 1500)
	t.same(parseCombinedRateLimit('"default";r=0;t=4'), { remaining: 0, delay: 4000 })
	t.end()
})

tap.test('beginner combined export includes resilience middleware', t => {
	t.type(metro.mw.retry, 'function')
	t.type(metro.mw.timeout, 'function')
	t.type(metro.mw.abort, 'function')
	t.type(metro.mw.backoff, 'function')
	t.type(metro.mw.backoff.localStorageStore, 'function')
	t.end()
})
