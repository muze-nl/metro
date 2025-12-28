import * as m from './metro.mjs'
import { api, jsonApi } from './api.mjs'
import json from './mw/json.mjs'
import thrower from './mw/thrower.mjs'
import getdata from './mw/getdata.mjs'

const metro = Object.assign({}, m, {
	mw: {
		json,
		thrower,
		gedata
	},
	api,
	jsonApi
})

if (!globalThis.metro) {
	globalThis.metro = metro
}

export default metro