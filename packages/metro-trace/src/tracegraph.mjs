const DEFAULT_OPTIONS = {
	name: 'Metro trace',
	view: 'tree',
	persist: true,
	autoPrint: true,
	includeRawTrace: false,
	maxAge: 10 * 60 * 1000,
	maxTraces: 20,
	slowStepMs: 1000,
	store: null,
	expectedStatus: status => status < 400,
	console: typeof console != 'undefined' ? console : null
}

const SEVERITY_WEIGHT = {
	ok: 0,
	info: 1,
	warning: 2,
	error: 3,
	blocked: 4
}

const SEVERITY_SYMBOL = {
	ok: '✓',
	info: 'ℹ',
	warning: '⚠',
	error: '✖',
	blocked: '⛔',
	skipped: '⏭',
	pending: '…'
}

/**
 * Create a Metro tracer that stores spans/events and can render them as a
 * console graph. This module is intentionally separate from the Metro core;
 * install it with metro.trace.add('graph', metro.trace.graph()).
 */
export function graph(options={})
{
	return new GraphTracer(options)
}

/**
 * Alias for graph(), matching the intended use: a local, browser-console trace.
 */
export function localConsole(options={})
{
	return graph(options)
}

export class GraphTracer
{
	constructor(options={})
	{
		this.options = Object.assign({}, DEFAULT_OPTIONS, options)
		if (!this.options.store) {
			this.options.store = this.options.persist ? localStorageStore(this.options) : memoryStore()
		}
		this.store = this.options.store
		this.defaultState = traceState()
		this.runs = new Map()
		this.lastTraceId = null
		this.store.cleanup?.(this.options)
	}

	request(req, middleware, context=null)
	{
		const state = this.state(context)
		if (!state.activeTraceId) {
			this.startTrace(requestName(req), {}, context)
		}
		this.startSpan(middlewareName(middleware), {
			kind: middlewareKind(middleware),
			method: req?.method,
			url: safeURL(req?.url)
		}, context)
	}

	response(res, middleware, context=null)
	{
		const state = this.state(context)
		const span = state.stack.pop()
		if (!span) {
			return
		}
		span.end = now()
		span.duration = span.end - span.start
		span.response = responseSummary(res)
		span.status = 'ok'
		span.severity = 'ok'

		this.addResponseDiagnostics(span, res, context)
		this.store.saveSpan(span)
		this.finishTraceIfComplete(null, context)
	}

	error(error, req, middleware, context=null)
	{
		const state = this.state(context)
		const span = state.stack.pop()
		if (!span) {
			return
		}
		span.end = now()
		span.duration = span.end - span.start
		span.status = 'error'
		span.severity = 'error'
		span.error = errorSummary(error)
		this.store.saveSpan(span)
		const message = error?.message || 'Middleware failed'
		const trace = this.store.read(span.traceId)
		const alreadyReported = trace?.diagnostics?.some(diagnostic => diagnostic.data?.errorMessage == message)
		if (span.kind == 'fetch' || !alreadyReported) {
			this.diagnostic({
				traceId: span.traceId,
				spanId: span.spanId,
				severity: 'error',
				code: span.kind == 'fetch' ? 'network-error' : 'middleware-error',
				message,
				data: {
					middleware: middlewareName(middleware),
					method: req?.method,
					url: safeURL(req?.url),
					name: error?.name,
					errorMessage: message
				}
			}, context)
		}
		this.finishTraceIfComplete('error', context)
	}

	/**
	 * Add a custom event to the current trace. Use from/to metadata to make it
	 * appear in sequence diagrams.
	 */
	event(name, data={}, context=null)
	{
		const state = this.state(context)
		const traceId = data.traceId || state.activeTraceId || state.lastTraceId || this.lastTraceId || this.startTrace(this.options.name, {}, context)
		const parent = data.parentSpanId || state.stack[state.stack.length - 1]?.spanId || state.activeParentSpanId || null
		const event = {
			id: id('event'),
			traceId,
			spanId: parent,
			time: now(),
			name,
			severity: data.severity || 'info',
			data: sanitizeData(data)
		}
		this.store.saveEvent(event)
		return event
	}

	/**
	 * Record a manual span. This is useful for middleware internals that are not
	 * represented by a Metro fetch call, for example token validation or PKCE.
	 */
	async span(name, fn, data={}, context=null)
	{
		this.startSpan(name, data, context)
		try {
			const result = await fn()
			this.response(data.response || {status: 200}, {name}, context)
			return result
		} catch(error) {
			this.error(error, null, {name}, context)
			throw error
		}
	}

	startTrace(name, data={}, context=null)
	{
		const state = this.state(context)
		const trace = {
			id: data.traceId || id('trace'),
			name,
			start: now(),
			status: 'running',
			severity: 'ok',
			data: sanitizeData(data)
		}
		state.activeTraceId = trace.id
		state.lastTraceId = trace.id
		this.lastTraceId = trace.id
		this.store.saveTrace(trace)
		return trace.id
	}

	startSpan(name, data={}, context=null)
	{
		const state = this.state(context)
		const traceId = data.traceId || state.activeTraceId || this.startTrace(this.options.name, {}, context)
		const parentSpanId = data.parentSpanId || state.stack[state.stack.length - 1]?.spanId || state.activeParentSpanId || null
		const span = {
			traceId,
			spanId: id('span'),
			parentSpanId,
			name,
			kind: data.kind || 'manual',
			start: now(),
			status: 'running',
			severity: 'ok',
			data: sanitizeData(data)
		}
		state.stack.push(span)
		this.store.saveSpan(span)
		return span
	}

	diagnostic(diagnostic, context=null)
	{
		const state = this.state(context)
		const currentSpan = state.stack[state.stack.length - 1]
		const traceId = diagnostic.traceId || currentSpan?.traceId || state.activeTraceId || state.lastTraceId || this.lastTraceId
		if (!traceId) {
			return null
		}
		const result = Object.assign({
			id: id('diagnostic'),
			traceId,
			spanId: diagnostic.spanId || currentSpan?.spanId || null,
			time: now(),
			severity: 'warning'
		}, diagnostic)
		result.data = sanitizeData(result.data || {})
		this.store.saveDiagnostic(result)
		return result
	}

	current(context=null)
	{
		const state = this.state(context)
		return {
			traceId: state.activeTraceId,
			spanId: state.stack[state.stack.length - 1]?.spanId || state.activeParentSpanId || null
		}
	}

	/**
	 * Remember a trace id under a stable key, for example an OAuth state value.
	 * The key is local to this trace store.
	 */
	link(key, traceId=undefined, context=null)
	{
		const state = this.state(context)
		traceId = traceId || state.activeTraceId || state.lastTraceId || this.lastTraceId
		if (key && traceId) {
			this.store.link(key, traceId)
		}
		return traceId
	}

	/**
	 * Resume adding manual events/spans to a trace after a redirect or popup.
	 */
	resume(traceId, parentSpanId=null, context=null)
	{
		if (!traceId) {
			return null
		}
		const state = this.state(context)
		state.activeTraceId = traceId
		state.activeParentSpanId = parentSpanId
		state.lastTraceId = traceId
		this.lastTraceId = traceId
		return this.current(context)
	}

	resumeLink(key, parentSpanId=null, context=null)
	{
		return this.resume(this.store.lookup(key), parentSpanId, context)
	}

	pause(context=null)
	{
		if (context?.__metroTraceContext) {
			this.runs.delete(context.id)
			return
		}
		this.defaultState = traceState()
	}

	get(traceId=this.lastTraceId)
	{
		return this.store.read(traceId)
	}

	print(traceId=this.lastTraceId, options={})
	{
		const trace = typeof traceId == 'object' ? traceId : this.get(traceId)
		if (!trace) {
			return null
		}
		return printTrace(trace, Object.assign({}, this.options, options))
	}

	printLast(options={})
	{
		return this.print(this.lastTraceId || this.store.lastTraceId?.(), options)
	}

	render(traceId=this.lastTraceId, options={})
	{
		const trace = typeof traceId == 'object' ? traceId : this.get(traceId)
		if (!trace) {
			return ''
		}
		return renderTrace(trace, Object.assign({}, this.options, options))
	}

	clear()
	{
		this.store.clear()
		this.defaultState = traceState()
		this.runs.clear()
		this.lastTraceId = null
	}

	addResponseDiagnostics(span, res, context=null)
	{
		if (span.duration >= this.options.slowStepMs) {
			span.severity = maxSeverity(span.severity, 'warning')
			this.diagnostic({
				traceId: span.traceId,
				spanId: span.spanId,
				severity: 'warning',
				code: 'slow-step',
				message: `${span.name} took ${formatDuration(span.duration)}`,
				data: { threshold: this.options.slowStepMs, actual: span.duration }
			}, context)
		}
		if (!res || typeof res.status == 'undefined' || span.kind != 'fetch') {
			return
		}
		if (this.statusExpected(res.status, span) === false) {
			const severity = res.status >= 500 ? 'error' : 'warning'
			span.status = severity == 'error' ? 'error' : 'warning'
			span.severity = maxSeverity(span.severity, severity)
			this.diagnostic({
				traceId: span.traceId,
				spanId: span.spanId,
				severity,
				code: 'unexpected-status',
				message: `${span.name} returned unexpected HTTP ${res.status}`,
				data: { status: res.status, url: span.data?.url }
			}, context)
		}
	}

	statusExpected(status, span)
	{
		const expected = this.options.expectedStatus
		if (typeof expected == 'function') {
			return expected(status, span)
		}
		if (Array.isArray(expected)) {
			return expected.includes(status)
		}
		return status < 400
	}

	finishTraceIfComplete(status=null, context=null)
	{
		const state = this.state(context)
		if (state.stack.length || !state.activeTraceId) {
			return
		}
		if (context?.parent) {
			this.runs.delete(context.id)
			return
		}
		const trace = this.store.read(state.activeTraceId)
		if (!trace) {
			this.pause(context)
			return
		}
		trace.end = now()
		trace.duration = trace.end - trace.start
		trace.status = status || traceStatus(trace)
		trace.severity = traceSeverity(trace)
		this.store.saveTrace(trace)
		state.lastTraceId = trace.id
		this.lastTraceId = trace.id
		if (this.options.autoPrint) {
			this.print(trace.id)
		}
		this.pause(context)
	}

	state(context=null)
	{
		if (!context?.__metroTraceContext) {
			return this.defaultState
		}
		let state = this.runs.get(context.id)
		if (state) {
			return state
		}
		state = traceState()
		const parentState = context.parent ? this.runs.get(context.parent.id) : null
		if (parentState) {
			state.activeTraceId = parentState.activeTraceId
			state.activeParentSpanId = parentState.stack[parentState.stack.length - 1]?.spanId || parentState.activeParentSpanId || null
			state.lastTraceId = parentState.lastTraceId
		}
		this.runs.set(context.id, state)
		return state
	}
}

function traceState()
{
	return {
		stack: [],
		activeTraceId: null,
		activeParentSpanId: null,
		lastTraceId: null
	}
}

export function renderTrace(trace, options={})
{
	options = Object.assign({}, DEFAULT_OPTIONS, options)
	const diagnostics = trace.diagnostics || []
	const lines = []
	lines.push(`${traceTitle(trace)} ${trace.status || ''} ${formatDuration(trace.duration || elapsed(trace))}`.trim())
	const primary = primaryDiagnostic(diagnostics)
	if (primary) {
		lines.push('')
		lines.push('Primary diagnostic:')
		lines.push(`${symbol(primary.severity)} ${primary.code}: ${primary.message}`)
	}
	if (diagnostics.length) {
		lines.push('')
		lines.push('Diagnostics:')
		for (const diagnostic of diagnostics) {
			lines.push(`${symbol(diagnostic.severity)} ${diagnostic.code}: ${diagnostic.message}`)
		}
	}
	lines.push('')
	lines.push(options.view == 'sequence' ? renderSequence(trace, options) : renderTree(trace, options))
	return lines.join('\n')
}

export function renderTree(trace, options={})
{
	const spans = trace.spans || []
	const events = trace.events || []
	const children = new Map()
	for (const span of spans) {
		const parent = span.parentSpanId || ''
		if (!children.has(parent)) {
			children.set(parent, [])
		}
		children.get(parent).push(span)
	}
	for (const group of children.values()) {
		group.sort((a, b) => a.start - b.start)
	}
	const eventsBySpan = new Map()
	for (const event of events) {
		const spanId = event.spanId || ''
		if (!eventsBySpan.has(spanId)) {
			eventsBySpan.set(spanId, [])
		}
		eventsBySpan.get(spanId).push(event)
	}
	for (const group of eventsBySpan.values()) {
		group.sort((a, b) => a.time - b.time)
	}
	const roots = children.get('') || []
	const lines = []
	if (!roots.length && !events.length) {
		return '(empty trace)'
	}
	for (let index=0; index<roots.length; index++) {
		appendSpan(lines, roots[index], children, eventsBySpan, '', index == roots.length - 1)
	}
	for (const event of eventsBySpan.get('') || []) {
		lines.push(`${symbol(event.severity)} ${event.name}${eventLabel(event)}`)
	}
	return lines.join('\n')
}

export function renderSequence(trace, options={})
{
	const arrows = sequenceArrows(trace)
	if (!arrows.length) {
		return renderTree(trace, options)
	}
	const actors = collectActors(arrows)
	const width = Math.max(14, ...actors.map(actor => actor.length))
	const gap = '    '
	const lines = []
	lines.push(actors.map(actor => pad(actor, width)).join(gap))
	lines.push(actors.map(() => pad('│', width)).join(gap))
	for (const arrow of arrows) {
		lines.push(sequenceLine(actors, arrow, width, gap))
	}
	return lines.join('\n')
}

export function printTrace(trace, options={})
{
	const output = renderTrace(trace, options)
	const out = options.console || console
	if (!out) {
		return output
	}
	const title = `${symbol(trace.severity)} ${traceTitle(trace)} ${trace.status || ''} ${formatDuration(trace.duration || elapsed(trace))}`.trim()
	if (out.groupCollapsed) {
		out.groupCollapsed('Ⓜ️  '+title)
	} else if (out.group) {
		out.group('Ⓜ️  '+title)
	}
	printDiagnostics(trace.diagnostics || [], out)
	for (const line of output.split('\n')) {
		printLine(line, out)
	}
	if (options.includeRawTrace && out.dir) {
		out.dir(trace)
	}
	if (out.groupEnd) {
		out.groupEnd()
	}
	return output
}

export function memoryStore()
{
	let traces = new Map()
	let spans = new Map()
	let events = new Map()
	let diagnostics = new Map()
	let links = new Map()
	let last = null
	return {
		saveTrace(trace) { traces.set(trace.id, Object.assign({}, trace)); last = trace.id },
		saveSpan(span) { spans.set(span.spanId, Object.assign({}, span)) },
		saveEvent(event) { events.set(event.id, Object.assign({}, event)) },
		saveDiagnostic(diagnostic) { diagnostics.set(diagnostic.id, Object.assign({}, diagnostic)) },
		read(traceId) { return assemble(traceId, traces, spans, events, diagnostics) },
		lastTraceId() { return last },
		link(key, traceId) { links.set(key, traceId) },
		lookup(key) { return links.get(key) },
		cleanup() {},
		clear() { traces.clear(); spans.clear(); events.clear(); diagnostics.clear(); links.clear(); last = null }
	}
}

export function localStorageStore(options={})
{
	const storage = options.storage || safeLocalStorage()
	if (!storage) {
		return memoryStore()
	}
	const prefix = options.prefix || 'metro:trace:'
	const key = suffix => prefix + suffix
	return {
		saveTrace(trace) { safeStore(() => {
			storage.setItem(key(`trace:${trace.id}`), JSON.stringify(trace))
			storage.setItem(key('last'), trace.id)
			updateIndex(storage, prefix, trace.id)
		}) },
		saveSpan(span) { safeStore(() => storage.setItem(key(`span:${span.traceId}:${span.spanId}`), JSON.stringify(span))) },
		saveEvent(event) { safeStore(() => storage.setItem(key(`event:${event.traceId}:${event.id}`), JSON.stringify(event))) },
		saveDiagnostic(diagnostic) { safeStore(() => storage.setItem(key(`diagnostic:${diagnostic.traceId}:${diagnostic.id}`), JSON.stringify(diagnostic))) },
		read(traceId) { return safeStore(() => readLocalTrace(storage, prefix, traceId), null) },
		lastTraceId() { return safeStore(() => storage.getItem(key('last')), null) },
		link(linkKey, traceId) { safeStore(() => storage.setItem(key(`link:${linkKey}`), traceId)) },
		lookup(linkKey) { return safeStore(() => storage.getItem(key(`link:${linkKey}`)), null) },
		cleanup(cleanupOptions=options) { safeStore(() => cleanupLocalStorage(storage, prefix, cleanupOptions)) },
		clear() { safeStore(() => clearLocalStorage(storage, prefix)) }
	}
}


function safeStore(fn, fallback=undefined)
{
	try {
		return fn()
	} catch(e) {
		return fallback
	}
}

function appendSpan(lines, span, children, eventsBySpan, prefix, isLast)
{
	const branch = isLast ? '└─ ' : '├─ '
	lines.push(`${prefix}${branch}${spanLine(span)}`)
	const childPrefix = prefix + (isLast ? '   ' : '│  ')
	const childSpans = children.get(span.spanId) || []
	const childEvents = eventsBySpan.get(span.spanId) || []
	const items = [
		...childSpans.map(item => ({type: 'span', item, time: item.start})),
		...childEvents.map(item => ({type: 'event', item, time: item.time}))
	].sort((a, b) => a.time - b.time)
	for (let index=0; index<items.length; index++) {
		const item = items[index]
		const last = index == items.length - 1
		if (item.type == 'span') {
			appendSpan(lines, item.item, children, eventsBySpan, childPrefix, last)
		} else {
			lines.push(`${childPrefix}${last ? '└─ ' : '├─ '}${symbol(item.item.severity)} ${item.item.name}${eventLabel(item.item)}`)
		}
	}
}

function spanLine(span)
{
	const status = span.status == 'running' ? 'pending' : span.severity || span.status || 'ok'
	const response = span.response?.status ? ` HTTP ${span.response.status}` : ''
	const url = span.data?.url ? ` ${displayURL(span.data.url)}` : ''
	return `${symbol(status)} ${span.name}${response}${url} ${formatDuration(span.duration || elapsed(span))}`.trim()
}

function eventLabel(event)
{
	if (event.data?.label) {
		return ` — ${event.data.label}`
	}
	if (event.data?.url) {
		return ` ${displayURL(event.data.url)}`
	}
	return ''
}

function sequenceArrows(trace)
{
	const arrows = []
	const spans = [...(trace.spans || [])].sort((a, b) => a.start - b.start)
	const roots = spans.filter(span => !span.parentSpanId)
	for (const span of roots) {
		arrows.push({
			from: 'App',
			to: 'Metro',
			label: `${span.data?.method || ''} ${displayURL(span.data?.url)}`.trim() || span.name,
			severity: span.severity,
			time: span.start
		})
	}
	for (const span of spans) {
		if (span.kind == 'fetch' || span.name == 'browserFetch') {
			const host = hostActor(span.data?.url)
			arrows.push({
				from: 'Metro',
				to: host,
				label: `${span.data?.method || 'GET'} ${pathLabel(span.data?.url)}`,
				severity: span.severity,
				time: span.start
			})
			if (span.response || span.error || span.status == 'running') {
				arrows.push({
					from: host,
					to: 'Metro',
					label: span.error ? `error: ${span.error.message}` : (span.response?.status ? `${span.response.status}` : 'pending'),
					severity: span.severity,
					time: span.end || now()
				})
			}
		}
	}
	for (const event of trace.events || []) {
		if (event.data?.from && event.data?.to) {
			arrows.push({
				from: event.data.from,
				to: event.data.to,
				label: event.data.label || event.name,
				severity: event.severity,
				time: event.time
			})
		}
	}
	return arrows.sort((a, b) => a.time - b.time)
}

function collectActors(arrows)
{
	const actors = []
	for (const arrow of arrows) {
		if (!actors.includes(arrow.from)) {
			actors.push(arrow.from)
		}
		if (!actors.includes(arrow.to)) {
			actors.push(arrow.to)
		}
	}
	return actors
}

function sequenceLine(actors, arrow, width, gap)
{
	const from = actors.indexOf(arrow.from)
	const to = actors.indexOf(arrow.to)
	const left = Math.min(from, to)
	const right = Math.max(from, to)
	const cells = actors.map(() => pad('│', width))
	const label = `${symbol(arrow.severity)} ${arrow.label}`.trim()
	for (let index=left; index<=right; index++) {
		if (index == from) {
			cells[index] = pad(from < to ? '├' : '◀', width)
		} else if (index == to) {
			cells[index] = pad(from < to ? '▶' : '┤', width)
		} else {
			cells[index] = pad('─', width)
		}
	}
	return cells.join(gap) + '  ' + label
}

function printDiagnostics(diagnostics, out)
{
	const primary = primaryDiagnostic(diagnostics)
	if (primary && out.error) {
		out.error(`${symbol(primary.severity)} ${primary.code}: ${primary.message}`)
	}
	for (const diagnostic of diagnostics) {
		if (diagnostic == primary) {
			continue
		}
		printLine(`${symbol(diagnostic.severity)} ${diagnostic.code}: ${diagnostic.message}`, out)
	}
}

function printLine(line, out)
{
	if (/✖|⛔/.test(line) && out.error) {
		out.error(line)
	} else if (/⚠/.test(line) && out.warn) {
		out.warn(line)
	} else if (out.log) {
		out.log(line)
	}
}

function assemble(traceId, traces, spans, events, diagnostics)
{
	const trace = traces.get(traceId)
	if (!trace) {
		return null
	}
	const result = Object.assign({}, trace)
	result.spans = [...spans.values()].filter(span => span.traceId == traceId)
	result.events = [...events.values()].filter(event => event.traceId == traceId)
	result.diagnostics = [...diagnostics.values()].filter(diagnostic => diagnostic.traceId == traceId)
	result.status = result.status == 'running' ? traceStatus(result) : result.status
	result.severity = traceSeverity(result)
	return result
}

function readLocalTrace(storage, prefix, traceId)
{
	if (!traceId) {
		return null
	}
	const trace = parseJSON(storage.getItem(prefix + `trace:${traceId}`))
	if (!trace) {
		return null
	}
	trace.spans = []
	trace.events = []
	trace.diagnostics = []
	for (let index=0; index<storage.length; index++) {
		const key = storage.key(index)
		if (key?.startsWith(prefix + `span:${traceId}:`)) {
			trace.spans.push(parseJSON(storage.getItem(key)))
		} else if (key?.startsWith(prefix + `event:${traceId}:`)) {
			trace.events.push(parseJSON(storage.getItem(key)))
		} else if (key?.startsWith(prefix + `diagnostic:${traceId}:`)) {
			trace.diagnostics.push(parseJSON(storage.getItem(key)))
		}
	}
	trace.spans = trace.spans.filter(Boolean)
	trace.events = trace.events.filter(Boolean)
	trace.diagnostics = trace.diagnostics.filter(Boolean)
	trace.status = trace.status == 'running' ? traceStatus(trace) : trace.status
	trace.severity = traceSeverity(trace)
	return trace
}

function updateIndex(storage, prefix, traceId)
{
	const indexKey = prefix + 'index'
	const index = parseJSON(storage.getItem(indexKey)) || []
	const next = [traceId, ...index.filter(id => id != traceId)]
	storage.setItem(indexKey, JSON.stringify(next))
}

function cleanupLocalStorage(storage, prefix, options={})
{
	const indexKey = prefix + 'index'
	const index = parseJSON(storage.getItem(indexKey)) || []
	const maxAge = options.maxAge ?? DEFAULT_OPTIONS.maxAge
	const maxTraces = options.maxTraces ?? DEFAULT_OPTIONS.maxTraces
	const keep = []
	const remove = []
	const cutoff = now() - maxAge
	for (const traceId of index) {
		const trace = parseJSON(storage.getItem(prefix + `trace:${traceId}`))
		if (!trace || trace.start < cutoff || keep.length >= maxTraces) {
			remove.push(traceId)
		} else {
			keep.push(traceId)
		}
	}
	for (const traceId of remove) {
		removeTrace(storage, prefix, traceId)
	}
	storage.setItem(indexKey, JSON.stringify(keep))
}

function clearLocalStorage(storage, prefix)
{
	const keys = []
	for (let index=0; index<storage.length; index++) {
		const key = storage.key(index)
		if (key?.startsWith(prefix)) {
			keys.push(key)
		}
	}
	for (const key of keys) {
		storage.removeItem(key)
	}
}

function removeTrace(storage, prefix, traceId)
{
	const keys = []
	for (let index=0; index<storage.length; index++) {
		const key = storage.key(index)
		if (key == prefix + `trace:${traceId}`
			|| key?.startsWith(prefix + `span:${traceId}:`)
			|| key?.startsWith(prefix + `event:${traceId}:`)
			|| key?.startsWith(prefix + `diagnostic:${traceId}:`)) {
			keys.push(key)
		}
	}
	for (const key of keys) {
		storage.removeItem(key)
	}
}

function traceStatus(trace)
{
	const spans = trace.spans || []
	if (spans.some(span => span.status == 'running')) {
		return 'incomplete'
	}
	if ((trace.diagnostics || []).some(diagnostic => diagnostic.severity == 'error' || diagnostic.severity == 'blocked')) {
		return 'error'
	}
	if ((trace.diagnostics || []).some(diagnostic => diagnostic.severity == 'warning')) {
		return 'warning'
	}
	return 'ok'
}

function traceSeverity(trace)
{
	let severity = trace.status == 'running' ? 'pending' : 'ok'
	for (const span of trace.spans || []) {
		severity = maxSeverity(severity, span.severity || span.status || 'ok')
	}
	for (const diagnostic of trace.diagnostics || []) {
		severity = maxSeverity(severity, diagnostic.severity || 'warning')
	}
	return severity
}

function primaryDiagnostic(diagnostics)
{
	return [...diagnostics].sort((a, b) => (SEVERITY_WEIGHT[b.severity] || 0) - (SEVERITY_WEIGHT[a.severity] || 0))[0]
}

function maxSeverity(a, b)
{
	return (SEVERITY_WEIGHT[b] || 0) > (SEVERITY_WEIGHT[a] || 0) ? b : a
}

function symbol(status)
{
	return SEVERITY_SYMBOL[status] || SEVERITY_SYMBOL.info
}

function requestName(req)
{
	return `${req?.method || 'GET'} ${displayURL(req?.url)}`
}

function middlewareName(middleware)
{
	return middleware?.displayName || middleware?.traceName || middleware?.name || 'anonymous middleware'
}

function middlewareKind(middleware)
{
	return middlewareName(middleware) == 'browserFetch' ? 'fetch' : 'middleware'
}

function responseSummary(res)
{
	if (!res) {
		return null
	}
	return {
		status: res.status,
		statusText: res.statusText,
		ok: res.ok,
		url: safeURL(res.url),
		redirected: res.redirected,
		type: res.type
	}
}

function errorSummary(error)
{
	return {
		name: error?.name,
		message: error?.message || String(error),
		stack: error?.stack
	}
}

function traceTitle(trace)
{
	return trace?.name || trace?.id || 'Metro trace'
}

function safeURL(value)
{
	if (!value) {
		return value
	}
	try {
		const url = new URL(value, typeof window != 'undefined' ? window.location.href : 'https://localhost/')
		url.username = ''
		url.password = ''
		for (const param of [...url.searchParams.keys()]) {
			if (isSecretName(param)) {
				url.searchParams.set(param, '…')
			}
		}
		return url.href
	} catch(e) {
		return String(value)
	}
}

function displayURL(value)
{
	if (!value) {
		return ''
	}
	try {
		const url = new URL(value, 'https://localhost/')
		return url.origin == 'https://localhost' ? url.pathname + url.search : url.href
	} catch(e) {
		return String(value)
	}
}

function hostActor(value)
{
	try {
		return new URL(value, 'https://localhost/').host || 'Network'
	} catch(e) {
		return 'Network'
	}
}

function pathLabel(value)
{
	try {
		const url = new URL(value, 'https://localhost/')
		return url.pathname + url.search
	} catch(e) {
		return displayURL(value)
	}
}

function sanitizeData(data)
{
	const result = {}
	for (const [key, value] of Object.entries(data || {})) {
		if (['traceId', 'parentSpanId', 'severity'].includes(key)) {
			continue
		}
		if (isSecretName(key)) {
			result[key] = '…'
		} else if (value instanceof URL) {
			result[key] = safeURL(value.href)
		} else if (typeof value == 'string' && looksLikeURL(value)) {
			result[key] = safeURL(value)
		} else if (value == null || ['string','number','boolean'].includes(typeof value)) {
			result[key] = value
		} else {
			result[key] = String(value)
		}
	}
	return result
}

function isSecretName(name)
{
	return /token|secret|password|credential|cookie|authorization|verifier|assertion|code/i.test(name)
}

function looksLikeURL(value)
{
	return /^https?:\/\//.test(value) || /^\//.test(value)
}

function formatDuration(duration)
{
	if (typeof duration != 'number' || Number.isNaN(duration)) {
		return ''
	}
	if (duration < 1000) {
		return `${Math.round(duration)}ms`
	}
	return `${(duration / 1000).toFixed(2)}s`
}

function elapsed(item)
{
	return item?.start ? now() - item.start : 0
}

function now()
{
	return Date.now()
}

function id(prefix)
{
	return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`
}

function pad(value, width)
{
	value = String(value)
	return value + ' '.repeat(Math.max(0, width - value.length))
}

function parseJSON(value)
{
	try {
		return value ? JSON.parse(value) : null
	} catch(e) {
		return null
	}
}

function safeLocalStorage()
{
	try {
		return typeof localStorage != 'undefined' ? localStorage : null
	} catch(e) {
		return null
	}
}
