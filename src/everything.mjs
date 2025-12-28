import * as m from './metro.mjs'
import { api, jsonApi } from './api.mjs'
import jsonmw from './mw/json.mjs'
import thrower from './mw/thrower.mjs'
import getdatamw from './mw/getdata.mjs'

const metro = Object.assign({}, m, {
	mw: {
		jsonmw,
		thrower,
		gedatamw
	},
	api,
	jsonApi
})

if (!globalThis.metro) {
	globalThis.metro = metro
}

export default metro