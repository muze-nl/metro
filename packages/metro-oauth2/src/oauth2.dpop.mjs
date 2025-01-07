import metro from '@muze-nl/metro'
import DPoP, {generateKeyPair} from 'dpop'
import { assert, Required, validURL } from '@muze-nl/assert'
import keysStore from './keysstore.mjs'

export default function dpopmw(options) {

	assert(options, {
		authorization_endpoint: Required(validURL),
		token_endpoint: Required(validURL),
		dpop_signing_alg_values_supported: Required([])
	})


	return async (req, next) => {
		console.log('dpop',req.url)
		const keys = await keysStore()
		const url = metro.url(req.url)
		let keyInfo = await keys.get(url.host)
		if (!keyInfo) {
			let keyPair = await generateKeyPair('ES256') //FIXME fetch from dpop_signing_alg_values_supported
			keyInfo = { domain: url.host, keyPair }
			await keys.set(keyInfo)
		}
		if (url.href.startsWith(options.authorization_endpoint)
			||url.href.startsWith(options.token_endpoint)) {
			//FIXME: allow for dpop bound refresh token here
			const dpopHeader = await DPoP(keyInfo.keyPair, req.url, req.method)
			req = req.with({
				headers: {
					'DPoP': dpopHeader
				}
			})
		} else if (req.headers.has('Authorization')) {
			const nonce      = localStorage.getItem(url.host+':nonce') || undefined
			const accessToken = req.headers.get('Authorization').split(' ')[1]
			const dpopHeader = await DPoP(keyInfo.keyPair, req.url, req.method, nonce, accessToken)
			req = req.with({
				headers: {
					'Authorization': 'DPoP '+accessToken,
					'DPoP': dpopHeader
				}
			})
		}
		let response = await next(req)
		if (response.headers.get('DPoP-Nonce')) {
			localStorage.setItem(url.host+':nonce', response.headers.get('DPoP-Nonce'))
		}
		return response
	}
	
}