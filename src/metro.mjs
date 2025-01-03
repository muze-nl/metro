/**
 * base URL used to link to more information about an error message
 */
const metroURL = 'https://metro.muze.nl/details/'

/**
 * Symbols:
 * - isProxy: used to test if an object is a metro Proxy to another object
 * - source: used to return the actual source (target) of a metro Proxy
 */
export const symbols = {
	isProxy: Symbol('isProxy'),
	source: Symbol('source')
}

/**
 * Metro HTTP Client with middleware support
 * @method get
 * @method post
 * @method put
 * @method delete
 * @method patch
 * @method head
 * @method options
 * @method query
 */
class Client
{
	#options = {
		url: typeof window != 'undefined' ? window.location : 'https://localhost'
	}
	#verbs = ['get','post','put','delete','patch','head','options','query']

	static tracers = {}

	/**
	 * @typedef {Object} ClientOptions
	 * @property {Array} middlewares - list of middleware functions
	 * @property {string|URL} url - default url of the client
	 * @property {[string]} verbs - a list of verb methods to expose, e.g. ['get','post']
	 * 
	 * Constructs a new metro client. Can have any number of params.
	 * @params {ClientOptions|URL|Function|Client}
	 * @returns {Client} - A metro client object with given or default verb methods
	 */
	constructor(...options)
	{
		for (let option of options) {
			if (typeof option == 'string' || option instanceof String) {
				this.#options.url = ''+option
			} else if (option instanceof Client) {
				Object.assign(this.#options, option.#options)
			} else if (option instanceof Function) {
				this.#addMiddlewares([option])
			} else if (option && typeof option == 'object') {
				for (let param in option) {
					if (param == 'middlewares') {
						this.#addMiddlewares(option[param])
					} else if (typeof option[param] == 'function') {
						this.#options[param] = option[param](this.#options[param], this.#options)
					} else {
						this.#options[param] = option[param]
					}
				}
			}
		}
		if (this.#options.verbs) {
			this.#verbs = this.#options.verbs
			delete this.#options.verbs
		}

		for (const verb of this.#verbs) {
			this[verb] = async function(...options) {
				return this.fetch(request(
					this.#options,
					...options,
					{method: verb.toUpperCase()}
				))
			}
		}
		Object.freeze(this)
	}

	#addMiddlewares(middlewares)
	{
		if (typeof middlewares == 'function') {
			middlewares = [ middlewares ]
		}
		let index = middlewares.findIndex(m => typeof m != 'function')
		if (index>=0) {
			throw metroError('metro.client: middlewares must be a function or an array of functions '
				+metroURL+'client/invalid-middlewares-value/', middlewares[index])
		}
		if (!Array.isArray(this.#options.middlewares)) {
			this.#options.middlewares = []
		}
		this.#options.middlewares = this.#options.middlewares.concat(middlewares)
	}

	/**
	 * Mimics the standard browser fetch method, but uses any middleware installed through
	 * the constructor.
	 * @param {Request|string|Object} - Required. The URL or Request object, accepts all types that are accepted by metro.request
	 * @param {Object} - Optional. Any object that is accepted by metro.request
	 * @return {Promise<Response|*>} - The metro.response to this request, or any other result as changed by any included middleware.
	 */
	fetch(req, options)
	{
		req = request(req, options)
		if (!req.url) {
			throw metroError('metro.client.'+req.method.toLowerCase()+': Missing url parameter '+metroURL+'client/missing-url-param/', req)
		}
		if (!options) {
			options = {}
		}
		if (!(typeof options === 'object') 
			|| Array.isArray(options)
			|| options instanceof String) 
		{
			throw metroError('metro.client.fetch: Options is not an object')
		}

		const metrofetch = async function browserFetch(req)
		{
			if (req[symbols.isProxy]) {
				// even though a Proxy is supposed to be 'invisible'
				// fetch() doesn't work with the proxy (in Firefox), 
				// you need the actual Request object here
				req = req[symbols.source]
			}
			const res = await fetch(req)
			return response(res)
		}
		
		let middlewares = [metrofetch].concat(this.#options?.middlewares?.slice() || [])
		options = Object.assign({}, this.#options, options)
		//@TODO: do this once in constructor?
		let next
		for (let middleware of middlewares) {
			next = (function(next, middleware) {
				return async function(req) {
					let res
					let tracers = Object.values(Client.tracers)
					for(let tracer of tracers) {
						if (tracer.request) {
							tracer.request.call(tracer, req, middleware)
						}
					}
					res = await middleware(req, next)
					for(let tracer of tracers) {
						if (tracer.response) {
							tracer.response.call(tracer, res, middleware)
						}
					}
					return res
				}								
			})(next, middleware)
		}
		return next(req)
	}

	with(...options) {
		return new Client(this, ...options)
	}
}

/**
 * Returns a new metro Client object.
 * @param {...ClientOptions|string|URL}
 * @return Client
 */
export function client(...options)
{
	return new Client(...options)
}

function appendHeaders(r, headers)
{
	if (!Array.isArray(headers)) {
		headers = [headers]
	}
	headers.forEach((header) => {
		if (typeof header == 'function') {
			let result = header(r.headers, r)
			if (result) {
				if (!Array.isArray(result)) {
					result = [result]
				}
				headers = headers.concat(result)
			}
		}
	})
	headers.forEach((header) => {
		Object.entries(header).forEach(([name,value]) => {			
			r.headers.append(name, value)
		})
	})
}

function bodyProxy(body, r)
{
	let source = r.body
	if (!source) {
		//Firefox does not allow access to Request.body (undefined)
		//Chrome and Nodejs do, so mimic the correct (documented)
		//result here
		if (body === null) {
			source = new ReadableStream()
		} else if (body instanceof ReadableStream) {
			source = body
		} else if (body instanceof Blob) {
			source = body.stream()
		} else {
			source = new ReadableStream({
				start(controller) {
					let chunk
					switch(typeof body) {
						case 'object':
							if (typeof body.toString == 'function') {
								// also catches URLSearchParams
								chunk = body.toString()
							} else if (body instanceof FormData) {
								chunk = new URLSearchParams(body).toString()
							} else if (body instanceof ArrayBuffer
								|| ArrayBuffer.isView(body)
							) {
								// catchs TypedArrays - e.g. Uint16Array
								chunk = body
							} else {
								throw metroError('Cannot convert body to ReadableStream', body)
							}
						break
						case 'string':
						case 'number':
						case 'boolean':
							chunk = body
						break
						default:
							throw metroError('Cannot convert body to ReadableStream', body)
						break
					}
					controller.enqueue(chunk)
					controller.close()
				}
			})
		}
	}
	return new Proxy(source, {
		get(target, prop, receiver) {
			switch (prop) {
				case symbols.isProxy:
					return true
				break
				case symbols.source:
					return body
				break
				case 'toString':
					return function() {
						return ''+body
					}
				break
			}
			if (typeof body == 'object') {
				if (prop in body) {
					if (typeof body[prop] == 'function') {
						return function(...args) {
							return body[prop].apply(body, args)
						}
					}
					return body[prop]
				}
			}
			if (prop in target && prop != 'toString') {
				// skipped toString, since it has no usable output
				// and body may have its own toString
				if (typeof target[prop] == 'function') {
					return function(...args) {
						return target[prop].apply(target, args)
					}
				}
				return target[prop]
			}
		},
		has(target, prop) {
			return prop in body
		},
		ownKeys(target) {
			return Reflect.ownKeys(body)
		},
		getOwnPropertyDescriptor(target, prop) {
			return Object.getOwnPropertyDescriptor(body,prop)
		}
	})
}

function getRequestParams(req, current)
{
	let params = current || {}
	if (!params.url && current.url) {
		params.url = current.url
	}
	// function to fetch all relevant properties of a Request
	for(let prop of ['method','headers','body','mode','credentials','cache','redirect',
		'referrer','referrerPolicy','integrity','keepalive','signal',
		'priority','url']) {
		if (typeof req[prop] == 'function') {
			req[prop](params[prop], params)
		} else if (typeof req[prop] != 'undefined') {
			if (prop == 'url') {
				params.url = url(params.url, req.url)
			} else if (prop == 'headers') {
				params.headers = new Headers(current.headers)
				if (!(req.headers instanceof Headers)) {
					req.headers = new Headers(req.headers)
				}
				for (let [key, value] of req.headers.entries()) {
					params.headers.set(key, value)
				}
			} else {
				params[prop] = req[prop]
			}
		}
	}
	return params
}

/**
 * @typedef {Request} MetroRequest
 * @property {Symbol(source)} - returns the target Request of this Proxy
 * @property {Symbol(isProxy)} - returns true
 * @method with - returns a new MetroRequest, with the given options added
 * @param {<RequestOptions|Request|string|URL|URLSearchParams|FormData|ReadableStream|
 *   Blob|ArrayBuffer|DataView|TypedArray>} ...options - request options, handled in order
 * 
 * Returns a new metro Request object
 * @param {<RequestOptions|Request|string|URL|URLSearchParams|FormData|ReadableStream|
 *   Blob|ArrayBuffer|DataView|TypedArray>} ...options - request options, handled in order
 * @return {MetroRequest} - a new metro Request object
 */
export function request(...options)
{
	// the standard Request constructor is a minefield
	// so first gather all the options together into a single
	// javascript object, then set it in one go
	let requestParams = {
		url: typeof window != 'undefined' ? window.location : 'https://localhost/',
		duplex: 'half' // required when setting body to ReadableStream, just set it here by default already
	}
	for (let option of options) {
		if (typeof option == 'string'
			|| option instanceof URL
			|| option instanceof URLSearchParams
		) {
			requestParams.url = url(requestParams.url, option)
		} else if (option && (
			option instanceof FormData
			|| option instanceof ReadableStream
			|| option instanceof Blob
			|| option instanceof ArrayBuffer
			|| option instanceof DataView
		)) {
			requestParams.body = option
		} else if (option && typeof option == 'object') {
			Object.assign(requestParams, getRequestParams(option, requestParams))
		}
	}
	let body = requestParams.body
	if (body) {
		if (typeof body == 'object'
			&& !(body instanceof String)
			&& !(body instanceof ReadableStream)
			&& !(body instanceof Blob)
			&& !(body instanceof ArrayBuffer)
			&& !(body instanceof DataView)
			&& !(body instanceof FormData)
			&& !(body instanceof URLSearchParams)
			&& (typeof TypedArray=='undefined' || !(body instanceof TypedArray))
		) {
			requestParams.body = JSON.stringify(body)
		}
	}
	let r = new Request(requestParams.url, requestParams)
	Object.freeze(r)
	return new Proxy(r, {
		get(target, prop, receiver) {
			switch(prop) {
				case symbols.source:
					return target
				break
				case symbols.isProxy:
					return true
				break
				case 'with':
					return function(...options) {
						if (body) { // body is kept in a seperate value, if it set earlier
							options.unshift({ body }) // unshifted so it can be overridden by options
						}
						return request(target, ...options)
					}
				break
				case 'toString':
				case 'toJSON':
					return function() {
						return target[prop].apply(target)
					}
				break
				case 'blob':
				case 'text':
				case 'json':
					return function() {
						return target[prop].apply(target)
					}
				break
				case 'body':
					// Request.body is always a ReadableStream
					// which is a horrible API, if you want to
					// allow middleware to alter the body
					// so we keep the original body, wrap a Proxy
					// around it to keep the ReadableStream api
					// accessible, but allow access to the original
					// body value as well
					if (!body) {
						body = target.body
					}
					if (body) {
						if (body[symbols.isProxy]) {
							return body
						}
						return bodyProxy(body, target)
					}
				break
			}
			return target[prop]
		}
	})
}

function getResponseParams(res, current)
{
	// function to fetch all relevant properties of a Response
	let params = current || {}
	if (!params.url && current.url) {
		params.url = current.url
	}
	for(let prop of ['status','statusText','headers','body','url','type','redirected']) {
		if (typeof res[prop] == 'function') {
			res[prop](params[prop], params)
		} else if (typeof res[prop] != 'undefined') {
			if (prop == 'url') {
				params.url = new URL(res.url, params.url || 'https://localhost/')
			} else {
				params[prop] = res[prop]
			}
		}
	}
	return params
}

/**
 * @typedef {Response} MetroResponse
 * @property {Symbol(source)} - returns the target Response of this Proxy
 * @property {Symbol(isProxy)} - returns true
 * @method with - returns a new MetroResponse, with the given options added
 * @param {<ResponseOptions|Response|string|URLSearchParams|FormData|ReadableStream|
 *   Blob|ArrayBuffer|DataView|TypedArray>} ...options - respomse options, handled in order
 * 
 * Returns a new metro Response object
 * @param {<ResponseOptions|Response|string|URLSearchParams|FormData|ReadableStream|
 *   Blob|ArrayBuffer|DataView|TypedArray>} ...options - request options, handled in order
 * @return {MetroResponse} - a new metro Response object
 */
export function response(...options)
{
	let responseParams = {}
	for (let option of options) {
		if (typeof option == 'string') {
			responseParams.body = option
		} else if (option instanceof Response) {
			Object.assign(responseParams, getResponseParams(option, responseParams))
		} else if (option && typeof option == 'object') {
			if (option instanceof FormData
				|| option instanceof Blob
				|| option instanceof ArrayBuffer
				|| option instanceof DataView
				|| option instanceof ReadableStream
				|| option instanceof URLSearchParams
				|| option instanceof String
				|| (typeof TypedArray != 'undefined' && option instanceof TypedArray)
			) {
				responseParams.body = option
			} else {
				Object.assign(responseParams, getResponseParams(option, responseParams))
			}
		}
	}
	let r = new Response(responseParams.body, responseParams)	
	Object.freeze(r)
	return new Proxy(r, {
		get(target, prop, receiver) {
			switch(prop) {
				case symbols.isProxy:
					return true
				break
				case symbols.source:
					return target
				break
				case 'with':
					return function(...options) {
						return response(target, ...options)
					}
				break
				case 'body':
					if (responseParams.body) {
						if (responseParams.body[symbols.isProxy]) {
							return responseParams.body
						}
						return bodyProxy(responseParams.body, target)
					} else {
						return bodyProxy('',target)
					}
				break
				case 'ok':
					return (target.status>=200) && (target.status<400)
				break
				case 'headers':
					return target.headers
				break
				default:
					if (prop in responseParams && prop != 'toString') {
						return responseParams[prop]
					}
					if (prop in target && prop != 'toString') {
						// skipped toString, since it has no usable output
						// and body may have its own toString
						if (typeof target[prop] == 'function') {
							return function(...args) {
								return target[prop].apply(target, args)
							}
						}
						return target[prop]
					}
				break
			}
			return undefined
		}
	})
}

function appendSearchParams(url, params) {
	if (typeof params == 'function') {
		 params(url.searchParams, url)
	} else {
		params = new URLSearchParams(params)
		params.forEach((value,key) => {
			url.searchParams.append(key, value)
		})
	}
}

/**
 * @typedef {URL} MetroURL
 * @property {Symbol(source)} - returns the target Request of this Proxy
 * @property {Symbol(isProxy)} - returns true
 * @method with - returns a new MetroRequest, with the given options added
 * @param {<URL|URLSearchParams|string|Object|Function>} ...options - url options, handled in order
 * 
 * Returns a new metro URL object
 * @param {<URL|URLSearchParams|string|Object|Function>} ...options - url options, handled in order
 * @return {MetroURL} - a new metro URL object
 */
export function url(...options)
{
	let validParams = ['hash','host','hostname','href',
			'password','pathname','port','protocol','username','search','searchParams']
	let u = new URL('https://localhost/')
	for (let option of options) {
		if (typeof option == 'string' || option instanceof String) {
			// option is a relative or absolute url
			u = new URL(option, u)
		} else if (option instanceof URL 
			|| (typeof Location != 'undefined' 
				&& option instanceof Location)
		) {
			u = new URL(option)
		} else if (option instanceof URLSearchParams) {
			appendSearchParams(u, option)
		} else if (option && typeof option == 'object') {
			for (let param in option) {
				if (param=='search') {
					if (typeof option.search == 'function') {
						option.search(u.search, u)
					} else {
						u.search = new URLSearchParams(option.search)
					}
				} else if (param=='searchParams') {
					appendSearchParams(u, option.searchParams)
				} else {
					if (!validParams.includes(param)) {
						throw metroError('metro.url: unknown url parameter '+metroURL+'url/unknown-param-name/', param)
					}
					if (typeof option[param] == 'function') {
						option[param](u[param], u)
					} else if (
						typeof option[param] == 'string' || option[param] instanceof String 
						|| typeof option[param] == 'number' || option[param] instanceof Number
						|| typeof option[param] == 'boolean' || option[param] instanceof Boolean
					) {
						u[param] = ''+option[param]
					} else if (typeof option[param] == 'object' && option[param].toString) {
						u[param] = option[param].toString()
					} else {
						throw metroError('metro.url: unsupported value for '+param+' '+metroURL+'url/unsupported-param-value/', options[param])
					}
				}
			}
		} else {
			throw metroError('metro.url: unsupported option value '+metroURL+'url/unsupported-option-value/', option)
		}
	}
	Object.freeze(u)
	return new Proxy(u, {
		get(target, prop, receiver) {
			switch(prop) {
				case symbols.isProxy:
					return true
				break
				case symbols.source:
					return target
				break
				case 'with':
					return function(...options) {
						return url(target, ...options)
					}
				break
				case 'toString':
				case 'toJSON':
					return function() {
						return target[prop]()
					}
				break
			}
			return target[prop]
		}
	})
}

/**
 * @typedef {FormData} MetroFormData
 * @property {Symbol(source)} - returns the target Request of this Proxy
 * @property {Symbol(isProxy)} - returns true
 * @method with - returns a new MetroRequest, with the given options added
 * @param {<FormData|Object>} ...options - url options, handled in order
 * 
 * Returns a new metro FormData object
 * @param {<FormData|Object>} ...options - formdata options, handled in order
 * @return {MetroURL} - a new metro FormData object
 */
export function formdata(...options)
{
	var params = new FormData()
	for (let option of options) {
		if (option instanceof FormData) {
			for (let entry of option.entries()) {
				params.append(entry[0],entry[1])
			}
		} else if (option && typeof option == 'object') {
			for (let entry of Object.entries(option)) {
				if (Array.isArray(entry[1])) {
					for (let value of entry[1]) {
						params.append(entry[0], value)
					}
				} else {
					params.append(entry[0],entry[1])
				}
			}
		} else {
			throw new metroError('metro.formdata: unknown option type, only FormData or Object supported',option)
		}
	}
	Object.freeze(params)
	return new Proxy(params, {
		get: (target,prop,receiver) => {
			switch(prop) {
				case symbols.isProxy:
					return true
				break
				case symbols.source:
					return target
				break
				case 'with':
					return function(...options) {
						return formdata(target, ...options)
					}
				break
				// case 'toString':
				// case 'toJSON':
				// 	return function() {
				// 		return target[prop]()
				// 	}
				// break
			}
			return target[prop]
		}
	})
}

const metroConsole = {
	error: (message, ...details) => {
		console.error('Ⓜ️  ',message, ...details)
	},
	info: (message, ...details) => {
		console.info('Ⓜ️  ',message, ...details)
	},
	group: (name) => {
		console.group('Ⓜ️  '+name)
	},
	groupEnd: (name) => {
		console.groupEnd('Ⓜ️  '+name)
	}
}


/**
 * Custom Metro Error function that outputs to the console then throws an error
 */
export function metroError(message, ...details) {
	metroConsole.error(message, ...details)
	return new Error(message, ...details)
}

/**
 * Set of debugging tools to trace the request - response flow
 * Tracer are run on all metro fetch calls
 */
export const trace = {
	/**
	 * Adds a named tracer function
	 * @param {string} name - the name of the tracer
	 * @param {Function} tracer - the tracer function to call
	 */
	add(name, tracer) {
		Client.tracers[name] = tracer
	},
	/**
	 * Removes a named tracer function
	 * @param {string} name
	 */
	delete(name) {
		delete Client.tracers[name]
	},
	/**
	 * Removes all tracer functions
	 */
	clear() {
		Client.tracers = {}
	},
	/**
	 * Returns a set of request and response tracer functions that use the
	 * console.group feature to shows nested request/response pairs, with
	 * most commonly needed information for debugging
	 */
	group() {
		let group = 0;
		return {
			request: (req, middleware) => {
				group++
				metroConsole.group(group)
				metroConsole.info(req?.url, req, middleware)
			},
			response: (res, middleware) => {
				metroConsole.info(res?.body ? res.body[symbols.source]: null, res, middleware)
				metroConsole.groupEnd(group)
				group--
			}
		}
	}
}
