import oldmmw from './index.mjs'

if (!globalThis.oldmmw) {
	globalThis.oldmmw = oldmmw
}

export * from './index.mjs'
export default oldmmw
