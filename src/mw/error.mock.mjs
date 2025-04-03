import * as metro from '../metro.mjs'

const baseResponse = {
	status: 200,
	statusText: 'OK',
	headers: {
		'Content-Type':'application/json'
	}
}

const badRequest = (error) => {
	return {
		status: error.code,
		statusText: error.message,
		headers: {
			'Content-Type':'application/json'
		},
		body: JSON.stringify(error)
	}
}

let error, expect, token

const status = {
	'/400/': 'Bad Request',
	'/401/': 'Unauthorized',
	'/402/': 'Payment Required',
	'/403/': 'Forbidden',
	'/404/': 'Not Found',
	'/405/': 'Method Not Allowed',
	'/406/': 'Not Acceptable',
	'/407/': 'Proxy Authentication Required',
	'/408/': 'Request Timeout',
	'/409/': 'Conflict',
	'/410/': 'Gone',
	'/411/': 'Length Required',
	'/412/': 'Precondition Failed',
	'/413/': 'Payload Too Large',
	'/414/': 'URI Too Long',
	'/415/': 'Unsupported Media Type',
	'/416/': 'Range Not Satisfiable',
	'/417/': 'Expectation Failed',
	'/418/': "I'm a teapot",
	'/421/': 'Misdireceted Request',
	'/422/': 'Unprocessable Content',
	'/423/': 'Locked',
	'/424/': 'Failed Dependency',
	'/425/': 'Too Early',
	'/426/': 'Upgrade Required',
	'/428/': 'Precondition Required',
	'/429/': 'Too Many Requests',
	'/431/': 'Request Header Fields Too Large',
	'/451/': 'Unavailable For Legal Reasons',

	'/500/': 'Internal Server Error',
	'/501/': 'Not Implemented',
	'/502/': 'Bad Gateway',
	'/503/': 'Service Unavailable',
	'/504/': 'Gateway Timeout',
	'/505/': 'HTTP Version Not Supported',
	'/506/': 'Variant Also Negotiated',
	'/507/': 'Insufficient Storage',
	'/508/': 'Loop Detected',
	'/510/': 'Not Extended',
	'/511/': 'Network Authentication Required'
}

export default function errormw(options) {
	return async function error(req, next) {
		let url = metro.url(req.url)
		if (status[url.pathname]) {
			let error = {
				code: parseInt(url.pathname.substring(1)),
				message: status[url.pathname]
			}
			return metro.response(badRequest(error))
		} else {
			return metro.response(baseResponse)
		}
	}
}