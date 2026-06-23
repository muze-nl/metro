import tap from 'tap'
import * as metro from '../src/metro.mjs'
import throwermw from '../src/mw/thrower.mjs'
import errormw from '../src/mw/error.mock.mjs'

tap.test('start', async t => {
	let c = metro.client().with(errormw()).with(throwermw())
	try {
		let res = await c.get('/404/')
		t.ok(false)
	} catch(e) {
		t.ok(true)
	} 
	t.end()
})
