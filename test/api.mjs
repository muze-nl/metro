import tap from 'tap'
import { api } from '../src/api.mjs'
import * as metro from '../src/metro.mjs'
import jsonmw from '../src/mw/json.mjs'
import echomw from '../src/mw/echo.mock.mjs'

tap.test('api', async t => {
	let baseURL = 'http://localhost:3000/'
	let myApi = api(
		metro.client(baseURL).with(echomw()).with(jsonmw()),
		{
			query: async function() {
				return this.post('query/', {body:{foo:"bar"}})
			}
		}
	)
	let body = await myApi.query()
	t.same(body, {foo:"bar"})
	t.end()
})