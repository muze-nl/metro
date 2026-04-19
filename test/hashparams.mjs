import tap from 'tap'
import * as hashParams from '../src/hashparams.mjs'
import * as metro from '../src/metro.mjs'

tap.test('parse', t => {
	const paramsStr = '#?foo=bar&bar=foo'
	const params = hashParams.parse(paramsStr)
	t.equal(params.get('foo'), 'bar')
	t.equal(params.get('bar'), 'foo')
	t.end()
})

tap.test('append', t => {
	const params = {
		foo: 'bar',
		bar: 'foo'
	}
	const url = metro.url('https://example.com')
	const hashUrl = hashParams.append(url, params)
	t.equal(hashUrl.hash, '#?foo=bar&bar=foo')
	t.end()
})

tap.test('parse with extra hash', t => {
	const paramsStr = '#foobar?foo=bar&bar=foo#barfoo'
	const params = hashParams.parse(paramsStr)
	t.equal(params.get('foo'), 'bar')
	t.equal(params.get('bar'), 'foo')
	t.end()
})

tap.test('append with extra hash', t => {
	const params = {
		foo: 'bar',
		bar: 'foo'
	}
	const url = metro.url('https://example.com#foobar')
	const hashUrl = hashParams.append(url, params)
	t.equal(hashUrl.hash, '#foobar?foo=bar&bar=foo')
	t.end()
})

tap.test('clear', t => {
	const url = metro.url('https://example.com/#foobar?foo=bar&bar=foo#barfoo')
	const cleared = hashParams.clear(url)+''
	t.equal(cleared, 'https://example.com/#foobar#barfoo')
	t.end()
})

tap.test('encode #', t => {
	const params = {
		foo: '#bar',
		bar: 'foo'
	}
	const url = metro.url('https://example.com')
	const hashUrl = hashParams.append(url, params)
	t.equal(hashUrl.hash, '#?foo=%23bar&bar=foo')
	t.end()	
})

tap.test('parse encoded #', t => {
	const paramsStr = '#?foo=%23bar&bar=foo'
	const params = hashParams.parse(paramsStr)
	t.equal(params.get('foo'), '#bar')
	t.equal(params.get('bar'), 'foo')
	t.end()
})