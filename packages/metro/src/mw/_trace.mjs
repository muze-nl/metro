import { Client } from '../metro.mjs'

export function traceEvent(name, data={}, context=null)
{
	for (const tracer of tracersFor(context)) {
		if (tracer && typeof tracer.event == 'function') {
			tracer.event.call(tracer, name, data, context)
		}
	}
}

export function traceDiagnostic(diagnostic={}, context=null)
{
	for (const tracer of tracersFor(context)) {
		if (tracer && typeof tracer.diagnostic == 'function') {
			tracer.diagnostic.call(tracer, diagnostic, context)
		}
	}
}

function tracersFor(context)
{
	return context?.tracers || Object.values(Client.tracers || {})
}
