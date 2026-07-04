import tap from 'tap'
import { parse, append, clear } from '@muze-nl/metro-hashparams'

tap.test('hashparams package reads, appends, and clears hash query values', t => {
	const start = 'https://example.test/app#section?access_token=abc&state=123'
	const parsed = parse(start)
	t.equal(parsed.get('access_token'), 'abc')
	t.equal(parsed.get('state'), '123')

	const appended = append('https://example.test/app#section', { state: '456' })
	t.equal(appended.href, 'https://example.test/app#section?state=456')

	const cleared = clear(start)
	t.equal(cleared.href, 'https://example.test/app#section')
	t.end()
})
