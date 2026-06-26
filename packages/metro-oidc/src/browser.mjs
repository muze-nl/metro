import * as core from '@muze-nl/metro-core'
import oidc from './index.mjs'

const metro = Object.assign({}, core, globalThis.metro || {})

if (!metro.oidc) {
	metro.oidc = oidc
}

globalThis.metro = metro

export * from './index.mjs'
export default oidc
