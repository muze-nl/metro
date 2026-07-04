import * as core from '@muze-nl/metro-core'
import { API, JsonAPI, api, jsonApi } from '@muze-nl/metro-api'
import mw from '@muze-nl/metro-middleware'
import * as trace from '@muze-nl/metro-trace'
import * as hashParams from '@muze-nl/metro-hashparams'
import { formdata } from '@muze-nl/metro-formdata'

const metro = Object.assign({}, core, {
	API,
	JsonAPI,
	api,
	jsonApi,
	mw,
	trace,
	hashParams,
	formdata
})

export * from '@muze-nl/metro-core'
export { API, JsonAPI, api, jsonApi } from '@muze-nl/metro-api'
export { default as mw } from '@muze-nl/metro-middleware'
export * as trace from '@muze-nl/metro-trace'
export * as hashParams from '@muze-nl/metro-hashparams'
export { formdata } from '@muze-nl/metro-formdata'
export default metro
