import tap from 'tap'
import * as metro from '../src/metro.mjs'
import jsonmw from '../src/mw/json.mjs'
import echomw from '../src/mw/echo.mock.mjs'

tap.test('start', async t => {
	let c = metro.client().with(echomw()).with(jsonmw())
	let req = metro.request('foo/', {
		method: 'POST',
		body: {
			foo: 'bar'
		}
	})
	let res = await c.post(req)
	t.equal(res.data.foo, 'bar')
	t.end()
})

tap.test('start', async t => {
	let c = metro.client().with(echomw()).with(jsonmw())
	let res = await c.post('foo/', {
		body: {
			foo: 'bar'
		}
	})
	t.equal(res.data.foo, 'bar')
	t.end()
})
