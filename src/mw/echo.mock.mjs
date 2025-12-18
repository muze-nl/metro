import * as metro from '../metro.mjs'

export default function echomw() {
	return async function echo(req) {
		let options = {
			status: 200,
			statusText: 'OK',
			url: req.url,
			headers: req.headers,
			body: req.body
		}
		return metro.response(options)
	}
}
