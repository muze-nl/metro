import * as m from './metro.mjs'
import { api, jsonApi } from './api.mjs'
import json from './mw/json.mjs'
import thrower from './mw/thrower.mjs'
import getdata from './mw/getdata.mjs'
import * as hashParams from './hashparams.mjs'
import * as traceGraph from './tracegraph.mjs'

const metro = Object.assign({}, m, {
	mw: {
		json,
		thrower,
		getdata
	},
	api,
	jsonApi,
	hashParams,
	trace: Object.assign({}, m.trace, traceGraph)
})

if (!globalThis.metro) {
	globalThis.metro = metro
}

export default metro