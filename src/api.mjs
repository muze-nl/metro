import * as metro from './metro.mjs'
import jsonmw from './mw/json.mjs'
import throwermw from './mw/thrower.mjs'
import getdatamw from './mw/getdata.mjs'

/**
 * Metro API Client, extends Client
 * @param base ClientOptions|URL|String
 * @param methods {name:function,...} list of API methods to expose
 * This class extends the metro client to allow you to add your own
 * api client methods. Methods are bound to this API object.
 * All default client methods (get/post/put/etc.) still work, unless
 * overridden. If a response object has a data part, that will be 
 * returned by the api client methods, instead of the normal response
 * The base API class will throw errors for network responses that
 * are not ok (e.g. status >= 400)
 * It will also return response.data, if that is set, instead of response
 */
export class API extends metro.Client
{
	constructor(base, methods, bind=null)
	{
		if (base instanceof metro.Client) {
			super(base.clientOptions, throwermw(), getdatamw())
		} else {
			super(base, throwermw(), getdatamw())
		}
		if (!bind) {
			bind = this
		}
		for (const methodName in methods) {
			if (typeof methods[methodName] == 'function') {
				// all methods have a this pointing to the (root) API class
				// so that you can do this.get()/this.post() or this.section.method()
				// inside an API method
				this[methodName] = methods[methodName].bind(bind)
			} else if (methods[methodName] && typeof methods[methodName] == 'object') {
				// allows for api.section.method()
				this[methodName] = new this.constructor(base, methods[methodName], bind)
			} else { 
				// allows you to set string/number values in the client api
				this[methodName] = methods[methodName]
			}
		}		
	}
}

/**
 * This extends the API class to automatically add
 * the jsonmw middleware. So any request.body that is
 * a normal object is automatically translated to JSON
 * Any response that returns JSON is automatically parsed
 * into response.data.
 * If no Accept header is set, it is added.
 */
export class JsonAPI extends API
{
	constructor(base, methods, bind=null) 
	{
		if (base instanceof metro.Client) {
			super(base.with(jsonmw()), methods, bind)
		} else {
			super(metro.client(base, jsonmw()), methods, bind)
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

export function jsonApi(...options)
{
	return new JsonAPI(...metro.deepClone(options))
}