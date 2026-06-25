export default function throwermw(options) {

	return async function thrower(req, next) {
		let res = await next(req)
		if (!res.ok) {
			if (options && typeof options[res.status] == 'function') {
				res = options[res.status].apply(res, req)
			} else {
				throw new Error(res.status+': '+res.statusText, {
					cause: res
				})
			}
		}
		return res
	}

}