import { error } from '@muze-nl/assert'

export const MustHave = (...options) => 
	(value, root) => {
		if (options.filter(o => root.hasOwnKey(o)).length > 0) {
			return false
		}
		return error('root data must have all of', root, options)
	}

export const MustInclude = (...options) =>
	(value) => {
		if (Array.isArray(value) && options.filter(o => !value.includes(o)).length == 0) {
			return false
		} else {
			return error('data must be an array which includes',value,options)
		}
	}

//TODO: add link to spec
export const validJWK = [
	'HS256','HS384','HS512','RS256','RS384','RS512','ES256','ES384','ES512'
]

//TODO: add link to spec
// FIXME: enter correct values
export const validJWA = [
	'HS256','HS384','HS512','RS256','RS384','RS512','ES256','ES384','ES512'
]

//TODO: add link to spec
export const validAuthMethods = [
	'client_secret_post', 'client_secret_basic','client_secret_jwt','private_key_jwt'
]
