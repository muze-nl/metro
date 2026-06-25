import { responseBackoffDelay, sleep } from './backoff.mjs'
import { traceEvent, traceDiagnostic } from './_trace.mjs'

const DEFAULT_RETRY_STATUS = [408, 425, 429, 500, 502, 503, 504]
const DEFAULT_RETRY_METHODS = ['GET', 'HEAD', 'OPTIONS']

export default function retrymw(options={})
{
	if (typeof options == 'number') {
		options = { attempts: options }
	}
	options = Object.assign({
		name: 'retry',
		attempts: 3,
		delay: 250,
		factor: 2,
		maxDelay: 30000,
		jitter: true,
		methods: DEFAULT_RETRY_METHODS,
		status: DEFAULT_RETRY_STATUS,
		respectRetryAfter: true,
		respectRateLimit: true,
		sleep,
		random: Math.random
	}, options)

	async function retry(req, next, context) {
		const attempts = attemptsFor(options.attempts, req)
		if (attempts <= 1 || !methodCanRetry(req, options)) {
			return next(req)
		}
		let lastError = null
		for (let attempt=1; attempt<=attempts; attempt++) {
			try {
				if (attempt > 1) {
					traceEvent('retry attempt', {
						severity: 'info',
						label: `${attempt}/${attempts}`,
						attempt,
						attempts,
						method: req.method,
						url: req.url
					}, context)
				}
				const res = await next(req.with ? req.with() : req)
				if (!responseCanRetry(res, options) || attempt >= attempts) {
					return res
				}
				const delay = retryDelay(options, attempt, res)
				traceEvent('retry scheduled', {
					severity: 'warning',
					label: `${res.status}, ${formatDelay(delay)}`,
					attempt,
					attempts,
					status: res.status,
					method: req.method,
					url: req.url,
					delay
				}, context)
				traceDiagnostic({
					severity: 'warning',
					code: 'retry',
					message: `Retrying ${req.method} ${displayURL(req.url)} after HTTP ${res.status}`,
					data: { attempt, attempts, status: res.status, delay, method: req.method, url: req.url }
				}, context)
				await options.sleep(delay, req.signal)
			} catch(error) {
				lastError = error
				if (!errorCanRetry(error, options) || attempt >= attempts || req.signal?.aborted) {
					throw error
				}
				const delay = retryDelay(options, attempt)
				traceEvent('retry scheduled', {
					severity: 'warning',
					label: `${error.name || 'Error'}, ${formatDelay(delay)}`,
					attempt,
					attempts,
					method: req.method,
					url: req.url,
					delay
				}, context)
				traceDiagnostic({
					severity: 'warning',
					code: 'retry',
					message: `Retrying ${req.method} ${displayURL(req.url)} after ${error.message || error}`,
					data: { attempt, attempts, delay, method: req.method, url: req.url, error: error.message }
				}, context)
				await options.sleep(delay, req.signal)
			}
		}
		throw lastError
	}
	retry.traceName = options.name
	return retry
}

export function retryDelay(options, attempt, res=null)
{
	let serverDelay = 0
	if (res && (options.respectRetryAfter || options.respectRateLimit)) {
		serverDelay = responseBackoffDelay(res, {
			statuses: options.status,
			maxDelay: options.maxDelay
		})
	}
	let delay = delayFor(options.delay, attempt, res)
	if (delay > 0 && options.factor && attempt > 1) {
		delay = delay * Math.pow(options.factor, attempt - 1)
	}
	if (options.jitter && delay > 0) {
		delay = delay * (0.5 + options.random())
	}
	if (options.maxDelay && options.maxDelay > 0) {
		delay = Math.min(delay, options.maxDelay)
	}
	return Math.max(serverDelay, Math.round(delay))
}

function methodCanRetry(req, options)
{
	if (options.methods == '*') {
		return true
	}
	return options.methods.map(method => method.toUpperCase()).includes(req.method.toUpperCase())
}

function responseCanRetry(res, options)
{
	if (typeof options.when == 'function') {
		return options.when(res)
	}
	return options.status == '*' || options.status.includes(res.status)
}

function errorCanRetry(error, options)
{
	if (typeof options.onError == 'function') {
		return options.onError(error)
	}
	return error?.name != 'AbortError' && error?.name != 'TimeoutError'
}

function attemptsFor(attempts, req)
{
	return typeof attempts == 'function' ? attempts(req) : attempts
}

function delayFor(delay, attempt, res)
{
	return typeof delay == 'function' ? delay(attempt, res) : delay
}

function formatDelay(delay)
{
	return delay < 1000 ? `${Math.round(delay)}ms` : `${(delay / 1000).toFixed(delay < 10000 ? 1 : 0)}s`
}

function displayURL(value)
{
	try {
		const url = new URL(value, 'https://localhost/')
		return url.origin == 'https://localhost' ? url.pathname + url.search : url.href
	} catch(e) {
		return String(value)
	}
}
