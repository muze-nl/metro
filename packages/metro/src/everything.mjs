import metro from './index.mjs'

if (!globalThis.metro) {
	globalThis.metro = metro
}

export * from './index.mjs'
export default metro
