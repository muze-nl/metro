import { traceEvent, traceDiagnostic } from './_trace.mjs'

const DEFAULT_BACKOFF_STATUSES = [429, 503]

export default function backoffmw(options={})
{
	options = Object.assign({
		name: 'backoff',
		store: memoryBackoffStore(),
		scope: 'origin',
		statuses: DEFAULT_BACKOFF_STATUSES,
		maxDelay: 60000,
		sleep,
		now: () => Date.now()
	}, options)

	async function backoff(req, next) {
		const key = backoffKey(req, options)
		const until = options.store.get(key) || 0
		const wait = Math.max(0, until - options.now())
		if (wait > 0) {
			traceEvent('server backoff wait', {
				severity: 'warning',
				label: formatDelay(wait),
				method: req.method,
				url: req.url,
				wait,
				key
			})
			await options.sleep(wait, req.signal)
		}
		const res = await next(req)
		const delay = responseBackoffDelay(res, options)
		if (delay > 0) {
			options.store.set(key, options.now() + delay)
			traceEvent('server requested backoff', {
				severity: res.status >= 400 ? 'warning' : 'info',
				label: formatDelay(delay),
				method: req.method,
				url: req.url,
				status: res.status,
				delay,
				key
			})
			traceDiagnostic({
				severity: res.status >= 400 ? 'warning' : 'info',
				code: 'server-backoff',
				message: `Server asked Metro to back off ${formatDelay(delay)}`,
				data: {
					method: req.method,
					url: req.url,
					status: res.status,
					delay,
					key
				}
			})
		}
		return res
	}
	backoff.traceName = options.name
	return backoff
}

export function responseBackoffDelay(res, options={})
{
	options = Object.assign({
		statuses: DEFAULT_BACKOFF_STATUSES,
		maxDelay: 60000
	}, options)
	if (!res?.headers) {
		return 0
	}
	const retryAfter = parseRetryAfter(res.headers.get('Retry-After'))
	if (retryAfter > 0 && statusAllowsBackoff(res.status, options)) {
		return capDelay(retryAfter, options.maxDelay)
	}
	const rateLimitReset = parseRateLimitReset(res.headers.get('RateLimit-Reset'))
	const rateLimitRemaining = parseNumberHeader(res.headers.get('RateLimit-Remaining'))
	if (rateLimitReset > 0 && rateLimitRemaining === 0) {
		return capDelay(rateLimitReset, options.maxDelay)
	}
	const combinedRateLimit = parseCombinedRateLimit(res.headers.get('RateLimit'))
	if (combinedRateLimit.delay > 0 && combinedRateLimit.remaining === 0) {
		return capDelay(combinedRateLimit.delay, options.maxDelay)
	}
	return 0
}

export function parseRetryAfter(value, now=Date.now())
{
	if (!value) {
		return 0
	}
	value = String(value).trim()
	if (/^\d+$/.test(value)) {
		return parseInt(value, 10) * 1000
	}
	const date = Date.parse(value)
	if (!Number.isNaN(date)) {
		return Math.max(0, date - now)
	}
	return 0
}

export function parseRateLimitReset(value)
{
	if (!value) {
		return 0
	}
	const match = String(value).trim().match(/^\d+(?:\.\d+)?/)
	if (!match) {
		return 0
	}
	return Math.ceil(parseFloat(match[0]) * 1000)
}

export function parseCombinedRateLimit(value)
{
	const result = { remaining: null, delay: 0 }
	if (!value) {
		return result
	}
	// Current drafts use a single RateLimit field with structured parameters.
	// We only need the two common client hints here: r=remaining and t=seconds.
	for (const part of String(value).split(/[;,]/)) {
		const [rawName, rawValue] = part.split('=').map(item => item?.trim())
		const name = rawName?.toLowerCase()
		const value = rawValue?.replace(/^"|"$/g, '')
		if (name == 'r') {
			result.remaining = parseNumberHeader(value)
		} else if (name == 't') {
			result.delay = parseRateLimitReset(value)
		}
	}
	return result
}

export function memoryBackoffStore()
{
	const values = new Map()
	return {
		get(key) { return values.get(key) || 0 },
		set(key, until) { values.set(key, until) },
		clear(key=null) {
			if (key == null) {
				values.clear()
			} else {
				values.delete(key)
			}
		}
	}
}

export function localStorageBackoffStore(options={})
{
	const storage = options.storage || safeLocalStorage()
	if (!storage) {
		return memoryBackoffStore()
	}
	const prefix = options.prefix || 'metro:backoff:'
	return {
		get(key) {
			const until = parseInt(storage.getItem(prefix + key), 10)
			return Number.isNaN(until) ? 0 : until
		},
		set(key, until) {
			storage.setItem(prefix + key, String(until))
		},
		clear(key=null) {
			if (key != null) {
				storage.removeItem(prefix + key)
				return
			}
			const keys = []
			for (let index=0; index<storage.length; index++) {
				const name = storage.key(index)
				if (name?.startsWith(prefix)) {
					keys.push(name)
				}
			}
			for (const name of keys) {
				storage.removeItem(name)
			}
		}
	}
}

export function sleep(ms, signal)
{
	if (!ms || ms <= 0) {
		return Promise.resolve()
	}
	if (signal?.aborted) {
		return Promise.reject(signal.reason || new Error('Request was aborted'))
	}
	return new Promise((resolve, reject) => {
		const timer = setTimeout(done, ms)
		function done() {
			cleanup()
			resolve()
		}
		function abort() {
			cleanup()
			reject(signal.reason || new Error('Request was aborted'))
		}
		function cleanup() {
			clearTimeout(timer)
			signal?.removeEventListener?.('abort', abort)
		}
		signal?.addEventListener?.('abort', abort, { once: true })
	})
}

function statusAllowsBackoff(status, options)
{
	return options.statuses == '*' || options.statuses.includes(status)
}

function capDelay(delay, maxDelay)
{
	if (!maxDelay || maxDelay < 0) {
		return delay
	}
	return Math.min(delay, maxDelay)
}

function parseNumberHeader(value)
{
	if (value == null) {
		return null
	}
	const match = String(value).trim().match(/^\d+(?:\.\d+)?/)
	return match ? Number(match[0]) : null
}

function backoffKey(req, options)
{
	if (typeof options.scope == 'function') {
		return options.scope(req)
	}
	const url = new URL(req.url)
	if (options.scope == 'url') {
		return url.href
	}
	if (options.scope == 'path') {
		return `${url.origin}${url.pathname}`
	}
	return url.origin
}

function formatDelay(delay)
{
	return delay < 1000 ? `${Math.round(delay)}ms` : `${(delay / 1000).toFixed(delay < 10000 ? 1 : 0)}s`
}

function safeLocalStorage()
{
	try {
		return typeof localStorage != 'undefined' ? localStorage : null
	} catch(e) {
		return null
	}
}

backoffmw.memoryStore = memoryBackoffStore
backoffmw.localStorageStore = localStorageBackoffStore
backoffmw.parseRetryAfter = parseRetryAfter
backoffmw.responseDelay = responseBackoffDelay
