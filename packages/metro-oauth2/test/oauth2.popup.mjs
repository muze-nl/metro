import tap from 'tap'
import { handleRedirect } from '../src/oauth2.popup.mjs'

tap.test('handleRedirect SHOULD complain WHEN called without Window existing', async t => {
    globalThis.window = undefined

    const actual = t.throws(handleRedirect)

    t.equal(actual.message, "Cannot read properties of undefined (reading 'location')")
    t.end()
})

tap.test('handleRedirect SHOULD complain WHEN called without parent existing', async t => {
    globalThis.window = { location: { origin: 'mock origin' } }

    const logs = t.capture(console, 'error')
    const actual = handleRedirect()

    t.match(logs(), [
        { args: [ 'No parent window found, cannot post authorization code (or error)' ], returned: undefined },
    ])
    t.notOk(actual)
    t.end()
})

tap.test('handleRedirect SHOULD post Error message WHEN called with parent without query params', async t => {
    globalThis.window = { location: { origin: 'mock origin' } }
    globalThis.window.parent = {
        postMessage: createPostMessage(t, 'mock origin', { error: 'Could not find an authorization_code' })
    }

    const actual = handleRedirect()

    t.notOk(actual)
    t.end()
})

tap.test('handleRedirect SHOULD post Error message WHEN called with window opener', async t => {
    globalThis.window = { location: { origin: 'mock origin' } }
    globalThis.window.parent = globalThis.window
    globalThis.window.opener = {
        postMessage: createPostMessage(t, 'mock origin', { error: 'Could not find an authorization_code' })
    }

    const actual = handleRedirect()

    t.notOk(actual)
    t.end()
})

tap.test('handleRedirect SHOULD post received error WHEN called with parent with error query param', async t => {
    globalThis.window = { location: { origin: 'mock origin', search: '?error=mockError' } }
    globalThis.window.parent = {
        postMessage: createPostMessage(t, 'mock origin', { error: 'mockError' })
    }

    const actual = handleRedirect()

    t.notOk(actual)
    t.end()
})

tap.test('handleRedirect SHOULD post received error WHEN called with parent with error hash param', async t => {
    globalThis.window = { location: { origin: 'mock origin', search: '', hash: '#error=mockError' } }
    globalThis.window.parent = {
        postMessage: createPostMessage(t, 'mock origin', { error: 'mockError' })
    }

    const actual = handleRedirect()

    t.notOk(actual)
    t.end()
})

tap.test('handleRedirect SHOULD post received code WHEN called with parent with code query param', async t => {
    globalThis.window = { location: { origin: 'mock origin', search: '?code=mockCode' } }
    globalThis.window.parent = {
        postMessage: createPostMessage(t, 'mock origin', { authorization_code: 'mockCode' })
    }

    const actual = handleRedirect()

    t.ok(actual)
    t.end()
})

tap.test('handleRedirect SHOULD post received code WHEN called with opener with code query param', async t => {
    globalThis.window = { location: { origin: 'mock origin', search: '?code=mockCode' } }
    globalThis.window.parent = globalThis.window
    globalThis.window.opener = {
        postMessage: createPostMessage(t, 'mock origin', { authorization_code: 'mockCode' })
    }

    const actual = handleRedirect()

    t.ok(actual)
    t.end()
})

tap.test('handleRedirect SHOULD post received code WHEN called with parent with code hash param', async t => {
    globalThis.window = { location: { origin: 'mock origin', search: '', hash: '#code=mockCode' } }
    globalThis.window.parent = {
        postMessage: createPostMessage(t, 'mock origin', { authorization_code: 'mockCode' })
    }

    const actual = handleRedirect()

    t.ok(actual)
    t.end()
})

function createPostMessage(t, expectedOrigin, expectedMessage) {
    return function postMessage(message, origin) {
        t.equal(origin, expectedOrigin)
        t.match(message, expectedMessage)
    }
}
