import { traceEvent, traceDiagnostic } from './_trace.mjs'

export default function abortmw(options={})
{
	if (isAbortSignal(options)) {
		options = { signal: options }
	}
	if (typeof options == 'function') {
		options = { signal: options }
	}
	options = Object.assign({
		name: 'abort'
	}, options)

	async function abort(req, next) {
		const signal = signalFor(options.signal, req)
		if (!signal) {
			return next(req)
		}
		if (signal.aborted) {
			const error = signal.reason || abortError()
			traceDiagnostic({
				severity: 'error',
				code: 'aborted',
				message: error.message || 'Request was aborted',
				data: { method: req.method, url: req.url }
			})
			throw error
		}
		traceEvent('abort signal attached', {
			severity: 'info',
			method: req.method,
			url: req.url
		})
		return next(req.with({ signal: combineSignals(req.signal, signal) }))
	}
	abort.traceName = options.name
	return abort
}

export function combineSignals(...signals)
{
	signals = signals.filter(Boolean)
	if (!signals.length) {
		return null
	}
	if (signals.length == 1) {
		return signals[0]
	}
	const controller = new AbortController()
	const cleanup = []
	const abort = event => {
		for (const remove of cleanup) {
			remove()
		}
		const source = event?.target || signals.find(signal => signal.aborted)
		if (!controller.signal.aborted) {
			controller.abort(source?.reason || abortError())
		}
	}
	for (const signal of signals) {
		if (signal.aborted) {
			abort({ target: signal })
			break
		}
		signal.addEventListener('abort', abort, { once: true })
		cleanup.push(() => signal.removeEventListener('abort', abort))
	}
	return controller.signal
}

export function abortError(message='Request was aborted')
{
	if (typeof DOMException != 'undefined') {
		return new DOMException(message, 'AbortError')
	}
	const error = new Error(message)
	error.name = 'AbortError'
	return error
}

function signalFor(signal, req)
{
	return typeof signal == 'function' ? signal(req) : signal
}

function isAbortSignal(value)
{
	return value && typeof value == 'object'
		&& typeof value.aborted == 'boolean'
		&& typeof value.addEventListener == 'function'
}

abortmw.combineSignals = combineSignals
abortmw.abortError = abortError
