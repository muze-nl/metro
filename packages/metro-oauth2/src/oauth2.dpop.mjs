import metro from '@muze-nl/metro'
import * as DPoP from 'dpop'
import { assert, Required, Optional, validURL } from '@muze-nl/assert'
import keysStore from './keysstore.mjs'

export default function dpopmw(options) {

	assert(options, {
		site: Required(validURL),
		authorization_endpoint: Required(validURL),
		token_endpoint: Required(validURL),
		dpop_signing_alg_values_supported: Optional([]) // this property is unfortunately rarely supported
	})

	return async (req, next) => {
		const keys = await keysStore()
		let keyInfo = await keys.get(options.site)
		if (!keyInfo) {
 			// FIXME fetch from dpop_signing_alg_values_supported
 			// which is unfortunately not available usually
 			let keyPair = await DPoP.generateKeyPair('ES256') // note: don't make them extractable! That potentially allows hackers to steal the privateKey
			keyInfo = { domain: options.site, keyPair }
			await keys.set(keyInfo)
		}
		const url = metro.url(req.url)

		if (req.url.startsWith(options.authorization_endpoint)) {
			let params = req.body
			if (params instanceof URLSearchParams || params instanceof FormData) {
				params.set('dpop_jkt', keyInfo.keyPair.publicKey)
			} else {
				params.dpop_jkt = keyInfo.keyPair.publicKey
			}

		} else if (req.url.startsWith(options.token_endpoint)) {
			const dpopHeader = await DPoP.generateProof(keyInfo.keyPair, req.url, req.method)
			req = req.with({
				headers: {
					'DPoP': dpopHeader
				}
			})

		} else if (req.headers.has('Authorization')) { //FIXME: not all requests use the dpop bound access token, so check which key to use, or if to add dpop at all
			// note: don't use options.site here, nonce can differ
			const nonce       = localStorage.getItem(url.host+':nonce') || undefined // null is not acceptible for DpOp()
			const accessToken = req.headers.get('Authorization').split(' ')[1]
			const dpopHeader  = await DPoP.generateProof(keyInfo.keyPair, req.url, req.method, nonce, accessToken)
			req = req.with({
				headers: {
					'Authorization': 'DPoP '+accessToken,
					'DPoP': dpopHeader
				}
			})
		}

		let response = await next(req)
		if (response.headers.get('DPoP-Nonce')) {
			// note: don't use options.site here, nonce can differ
			localStorage.setItem(url.host+':nonce', response.headers.get('DPoP-Nonce'))
		}
		return response
	}
	
}