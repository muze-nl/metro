import * as metro from './metro.mjs'
import jsonmw from './mw/json.mjs'
import throwermw from './mw/thrower.mjs'

/**
 * Metro API Client, extends Client
 * @param base ClientOptions|URL|String
 * @param methods {name:function,...} list of API methods to expose
 * This class extends the metro client to allow you to add your own
 * api client methods. Methods are bound to this API object.
 * All default client methods (get/post/put/etc.) still work, unless
 * overridden. If a response object has a data part, that will be 
 * returned by the api client methods, instead of the normal response
 */
export class API extends metro.Client
{
	constructor(base, methods)
	{
		const getdatamw = async (req,next) => {
			let res = await next(req)
			if (res.ok && res.data) {
				return res.data
			} else {
				return res
			}
		}
		if (typeof base == 'string') {
			super(base, jsonmw(), throwermw(), getdatamw)
		} else if (base instanceof metro.Client) {
			super(base.clientOptions, getdatamw)
		} else {
			super(base, getdatamw)
		}
		for (const methodName in methods) {
			if (typeof methods[methodName] == 'function') {
				this[methodName] = methods[methodName].bind(this)
			}
		}		
	}
}

/**
 * Returns a new Metro API object
 * @param {...ClientOptions|string|URL}
 * @return API
 */
export function api(...options)
{
	return new API(...metro.deepClone(options))
}
