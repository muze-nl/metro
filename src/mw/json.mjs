import * as metro from '../metro.mjs'

export default function jsonmw(options) {
	options = Object.assign({
		mimetype: 'application/json',
		reviver: null,
		replacer: null,
		space: ''
	}, options)

	return async function json(req, next) {
		if (!isJSON(req.headers.get('Accept'))) {
			req = req.with({
				headers: {
	                'Accept': options.mimetype
	            }
	        })
		}
		if (['POST','PUT','PATCH','QUERY'].includes(req.method)) {
			if (req.data && typeof req.data=='object' && !(req.data instanceof ReadableStream)) {
				if (!isJSON(req.headers.get('content-type'))) {
					req = req.with({
						headers: {
							'Content-Type':options.mimetype,
						}
					})
				}
				req = req.with({
					body: JSON.stringify(req.data, options.replacer, options.space)
				})
			}
		}
		let res = await next(req)
		if (isJSON(res.headers.get('content-type'))) {
			let tempRes = res.clone()
			let body = await tempRes.text()
			try {
				let json = JSON.parse(body, options.reviver)
				return res.with({
					body: json
				})
			} catch(e) {
				// ignore parse errors
			}
		} 
		return res
	}
}

const jsonRE = /^application\/([a-zA-Z0-9\-_]+\+)?json\b/
function isJSON(contentType) {
	return jsonRE.exec(contentType)
}