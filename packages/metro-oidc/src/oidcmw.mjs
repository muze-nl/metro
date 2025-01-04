import metro from '@muze-nl/metro'
import oauth2mw from '@muze-nl/metro-oauth2'
import { assert, Required, Optional, validURL, instanceOf } from '@muze-nl/assert'
import discover from './oidc.discovery.mjs'
import register from './oidc.register.mjs'

export default function oidcmw(options={}) {

	const defaultOptions = {
		client: metro.client(),
		force_authorization: false
	}

	options = Object.assign({}, defaultOptions, options)

	// assert(options, {
	// 	client: Required(instanceOf(metro.client().constructor)), // required because it is set in defaultOptions
	// 	client_info: Required(),
	// 	issuer: Required(validURL),
	// 	oauth2: Optional({}),
	// 	openid_configuration: Optional()
	// })

	return async (req, next) => {
		let res
		if (!options.force_authorization) {
			try {
				res = await next(req)
			} catch(err) {
				if (res.status!=401 && res.status!=403) {
					throw err
				}
			}
			if (res.ok || (res.status!=401 && res.status!=403)) {
				return res
			}
		}
		if (!options.openid_configuration) {
			options.openid_configuration = await discover({
				issuer: options.issuer
			})
		}

		if (!options.client_info?.client_id) {
			assert(options.client_info?.client_name, Required())
			if (!options.openid_configuration.registration_endpoint) {
				throw metro.metroError('metro.oidcmw: Error: issuer '+options.issuer+' does not support dynamic client registration, but you haven\'t specified a client_id')
			}
			options.client_info = await register({
				registration_endpoint: options.openid_configuration.registration_endpoint,
				client_info: options.client_info
			})
		}

		// now initialize an oauth2 client stack, using options.client as default
		// with forceAuthentication: true
		const oauth2Options = Object.assign(
			{
				site: options.issuer,
				client: options.client,
				force_authorization: true,
				oauth2_configuration: {
					client_id: options.client_info.client_id,
					client_secret: options.client_info.client_secret,
					grant_type: 'authorization_code',
					authorization_endpoint: options.openid_configuration.authorization_endpoint,
					token_endpoint: options.openid_configuration.token_endpoint,
					scope: options.openid_configuration.scope || 'openid'
				}
			}
			//...
		)
		const oauth2client = options.client.with(options.issuer)
		// optional: add oauth2dpop mw
		.with(oauth2mw(oauth2Options))

		res = await oauth2client.fetch(req)
		// ...

		return res
	}

}
