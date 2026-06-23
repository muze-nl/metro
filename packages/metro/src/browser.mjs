import * as metro from './metro.mjs'

if (!globalThis.metro) {
	globalThis.metro = metro
}

export default metro