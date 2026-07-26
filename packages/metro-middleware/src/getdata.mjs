export default function getdatamw(options = {})
{

	return async function getdata(req, next) {
		let res = await next(req)
		if (res.ok) {
			if (options.alwaysData) {
				let data = res.data
				if (data == null) {
					data = {}
				}
				if (options.responseProperty && (typeof data!='object' && typeof data!='function')) {
					throw new TypeError('getdata: responseProperty requires response.data to be an object')
				}
				if (options.responseProperty) {
					Object.defineProperty(data, options.responseProperty, {
						value: res,
						enumerable: false,
						configurable: true
					})
				}
				return data
			}
			if (res.data) {
				return res.data
			}
		}
		return res
	}

}
