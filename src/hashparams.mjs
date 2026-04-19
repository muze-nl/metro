import {url as metroUrl} from './metro.mjs'

export function parse(url) {
	const hash = metroUrl(url).hash.substr(1)
	const query = /\?[^#]*/.exec(hash)?.[0]
	return new URLSearchParams(query)
}

export function append(url, params) {
	url = metroUrl(url)
	if (!(params instanceof URLSearchParams)) {
		params = new URLSearchParams(params)
	}
	let hash = url.hash || '#'
	hash+='?'+params
	return url.with({hash})
}

export function clear(url) {
	url = metroUrl(url)
	let hash = url.hash.replace(/\?[^#]*/, '')
	return url.with({hash})
}