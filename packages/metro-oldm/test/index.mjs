import tap from 'tap'

tap.test('normal metro-oldm import does not install a global', async t => {
	const previous = globalThis.oldmmw
	delete globalThis.oldmmw
	const module = await import('../src/index.mjs')
	t.equal(typeof module.default, 'function')
	t.equal(globalThis.oldmmw, undefined)
	if (typeof previous != 'undefined') {
		globalThis.oldmmw = previous
	}
})
