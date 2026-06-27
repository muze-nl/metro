import tap from 'tap'
import { formdata } from '@muze-nl/metro-formdata'

tap.test('formdata package creates reusable FormData values', t => {
	const data = formdata({
		name: 'Metro',
		tag: ['fetch', 'middleware']
	})
	t.equal(data.get('name'), 'Metro')
	t.same(data.getAll('tag'), ['fetch', 'middleware'])

	const extended = data.with({ extra: 'yes' })
	t.equal(extended.get('name'), 'Metro')
	t.equal(extended.get('extra'), 'yes')
	t.end()
})
