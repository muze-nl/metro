import * as metro from '@muze-nl/metro-core'
import { getdata, json, thrower } from '@muze-nl/metro-middleware'

/**
 * Metro API Client, extends Client
 * @param base ClientOptions|URL|String
 * @param methods {name:function,...} list of API methods to expose
 * This class extends the metro client to allow you to add your own
 * api client methods. Methods are bound to this API object.
 * All default client methods (get/post/put/etc.) still work, unless overridden.
 * The constructor does not add middleware. Use api() for the default
 * thrower/getdata middleware stack, or pass a configured client.
 */
export class API extends metro.Client
{
	#methods = null
	#base    = ''

	constructor(base, methods={}, bind=null)
	{
		if (base instanceof metro.Client) {
			super(base.clientOptions)
		} else {
			let baseURL = base
			if (base && typeof base == 'object' && !(base instanceof URL)) {
				baseURL = base.url
			}
			try {
				new URL(baseURL)
			} catch {
				throw new TypeError(
					'metro-api: API base must be an absolute URL or Metro client',
					{ cause: base }
				)
			}
			super(base)
		}
		if (!bind) {
			bind = this
		}
		this.#methods = methods
		this.#base = base
		for (const methodName in methods) {
			if (typeof methods[methodName] == 'function') {
				// all methods have a this pointing to the (root) API class
				// so that you can do this.get()/this.post() or this.section.method()
				// inside an API method
				this[methodName] = methods[methodName].bind(bind)
			} else if (methods[methodName] && typeof methods[methodName] == 'object' 
				&& (Object.getPrototypeOf(methods[methodName])===null 
					|| Object.getPrototypeOf(methods[methodName]).constructor===Object) 
				) {
				// allows for api.section.method()
				this[methodName] = new this.constructor(base, methods[methodName], bind)
			} else { 
				// allows you to set any other values in the client api
				this[methodName] = methods[methodName]
			}
		}		
	}

	extend(methods) {
		return new this.constructor(this.#base, Object.assign({}, this.#methods, methods))
	}
}

/**
 * Returns a new Metro API object, with thrower/getdata middleware stack and the given methods.
 * @param metroClient|URL|String url or metro client
 * @param {name:function,...} list of API methods to expose
 * @return API
 */
export function api(base, methods)
{
	return new API(metro.client(base, thrower(), getdata()), methods)
}

/**
 * Returns a new Metro API object, with json/thrower/getdata middleware stack and the given methods.
 * @param metroClient|URL|String url or metro client
 * @param {name:function,...} list of API methods to expose
 * @return API
 */
export function jsonApi(base, methods)
{
	return new API(metro.client(base, json(), thrower(), getdata()), methods)
}
