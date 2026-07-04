import { metroError } from '@muze-nl/metro-core'

const metroURL = 'https://metro.muze.nl/details/'

if (!Symbol.metroProxy) {
	Symbol.metroProxy = Symbol('isProxy')
}
if (!Symbol.metroSource) {
	Symbol.metroSource = Symbol('source')
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
		if (typeof HTMLFormElement != 'undefined' && option instanceof HTMLFormElement) {
			option = new FormData(option)
		}
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
			throw metroError('metro.formdata: unknown option type '+metroURL+'formdata/unknown-option-value/', option)
		}
	}
	Object.freeze(params)
	return new Proxy(params, {
		get(target, prop) {
			let result
			switch(prop) {
				case Symbol.metroProxy:
					result = true
				break
				case Symbol.metroSource:
					result = target
				break
				//TODO: add toString() that can check
				//headers param: toString({headers:request.headers})
				//for the content-type
				case 'with':
					result = function(...options) {
						return formdata(target, ...options)
					}
				break
				default:
					if (target[prop] instanceof Function) {
						result = target[prop].bind(target)
					} else {
						result = target[prop]
					}
				break
			}
			return result
		}
	})
}

