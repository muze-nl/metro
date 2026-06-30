import { Client } from '@muze-nl/metro-core'
import { graph, localConsole } from './tracegraph.mjs'
export { graph, localConsole, GraphTracer } from './tracegraph.mjs'

const metroConsole = {
	info: (message, ...details) => console.info('Ⓜ️  ', message, ...details),
	group: name => console.group('Ⓜ️  ' + name),
	groupEnd: name => console.groupEnd('Ⓜ️  ' + name)
}

/**
 * Adds a named global tracer. Global tracers see all Metro clients.
 * Prefer client-scoped tracers for complex applications.
 */
export function add(name, tracer) {
	Client.tracers[name] = tracer
}

/** Remove a named global tracer. */
export function remove(name) {
	delete Client.tracers[name]
}

/** Alias for remove(), matching the previous Metro API. */
export { remove as delete }

/** Remove all global tracers. */
export function clear() {
	Client.tracers = {}
}

/**
 * Returns a small console.group tracer for quick request/response debugging.
 */
export function group() {
	let group = 0
	return {
		request: (req, middleware) => {
			group++
			metroConsole.group(group)
			metroConsole.info(req?.url, req, middleware)
		},
		response: (res, middleware) => {
			metroConsole.info(res?.body ? res.body[Symbol.metroSource] : null, res, middleware)
			metroConsole.groupEnd(group)
			group--
		},
		error: (error) => {
			metroConsole.info(error)
			metroConsole.groupEnd(group)
			group--
		}
	}
}

export default {
	add,
	delete: remove,
	remove,
	clear,
	group,
	graph: (...args) => graph(...args),
	localConsole: (...args) => localConsole(...args)
}

