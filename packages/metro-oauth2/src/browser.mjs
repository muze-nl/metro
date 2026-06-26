import * as core from '@muze-nl/metro-core'
import oauth2 from './index.mjs'

const metro = Object.assign({}, core, globalThis.metro || {})

if (!metro.oauth2) {
	metro.oauth2 = oauth2
}

globalThis.metro = metro

export * from './index.mjs'
export default oauth2
