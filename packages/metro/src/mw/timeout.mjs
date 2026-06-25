import { combineSignals } from './abort.mjs'
import { traceEvent, traceDiagnostic } from './_trace.mjs'

export default function timeoutmw(options=30000)
{
	if (typeof options == 'number') {
		options = { ms: options }
	}
	options = Object.assign({
		ms: 30000,
		name: 'timeout'
	}, options)

	async function timeout(req, next) {
		const ms = delayFor(options.ms, req)
		if (!ms || ms <= 0) {
			return next(req)
		}
		const controller = new AbortController()
		const timer = setTimeout(() => {
			controller.abort(timeoutError(ms))
		}, ms)
		const signal = combineSignals(req.signal, options.signal, controller.signal)
		traceEvent('timeout armed', {
			severity: 'info',
			label: `${ms}ms`,
			method: req.method,
			url: req.url,
			ms
		})
		try {
			return await next(req.with({ signal }))
		} catch(error) {
			if (controller.signal.aborted) {
				traceDiagnostic({
					severity: 'error',
					code: 'timeout',
					message: `Request timed out after ${ms}ms`,
					data: { method: req.method, url: req.url, ms }
				})
			}
			throw error
		} finally {
			clearTimeout(timer)
		}
	}
	timeout.traceName = options.name
	return timeout
}

export function timeoutError(ms)
{
	const error = new Error(`Request timed out after ${ms}ms`)
	error.name = 'TimeoutError'
	error.code = 'ETIMEDOUT'
	return error
}

function delayFor(ms, req)
{
	return typeof ms == 'function' ? ms(req) : ms
}

timeoutmw.timeoutError = timeoutError
