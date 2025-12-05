export default function getdatamw(options) {

	return async function getdata(req, next) {
		let res = await next(req)
		if (res.ok && res.data) {
			return res.data
		}
		return res
	}

}