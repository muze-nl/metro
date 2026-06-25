import { Client } from '../metro.mjs'

export function traceEvent(name, data={})
{
	for (const tracer of Object.values(Client.tracers || {})) {
		if (tracer && typeof tracer.event == 'function') {
			tracer.event(name, data)
		}
	}
}

export function traceDiagnostic(diagnostic={})
{
	for (const tracer of Object.values(Client.tracers || {})) {
		if (tracer && typeof tracer.diagnostic == 'function') {
			tracer.diagnostic(diagnostic)
		}
	}
}
