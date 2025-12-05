import tap from 'tap'
import { api, jsonApi} from '../src/api.mjs'
import * as metro from '../src/metro.mjs'
import jsonmw from '../src/mw/json.mjs'
import echomw from '../src/mw/echo.mock.mjs'

tap.test('api', async t => {
	let baseURL = 'http://localhost:3000/'
	let myApi = jsonApi(
		metro.client(baseURL).with(echomw()),
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

tap.test('nested api', async t => {
	let baseURL = 'http://localhost:3000/'
	let myApi = jsonApi(
		metro.client(baseURL).with(echomw()),
		{
			section: {
				query: async function() {
					return this.post('section/query/', {body:{foo:"bar"}})
				}
			}
		}
	)
	let body = await myApi.section.query()
	t.same(body, {foo:"bar"})
	t.end()	
})