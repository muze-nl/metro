import tap from 'tap'
import { handleRedirect, authorizePopup } from '../src/oauth2.popup.mjs'

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

tap.test('authorizePopup SHOULD reject with error message WHEN message posted without error or code', async t => {
    globalThis.window = { open: (authorizationCodeURL) => t.equal(authorizationCodeURL, 'mockUrl') }
    globalThis.addEventListener = createEventListener(t, { })

    const actual = await t.rejects(authorizePopup('mockUrl'))

    t.equal(actual, 'Unknown authorization error')
    t.end()
})

tap.test('authorizePopup SHOULD reject with received error message WHEN message posted with error', async t => {
    globalThis.window = { open: (authorizationCodeURL) => t.equal(authorizationCodeURL, 'mockUrl') }
    globalThis.addEventListener = createEventListener(t, { error: 'mockError' })

    const actual = await t.rejects(authorizePopup('mockUrl'))

    t.equal(actual, 'mockError')
    t.end()
})

tap.test('authorizePopup SHOULD resolve with received code WHEN message posted with code', async t => {
    globalThis.window = { open: (authorizationCodeURL) => t.equal(authorizationCodeURL, 'mockUrl') }
    globalThis.addEventListener = createEventListener(t, { authorization_code: 'mockCode' })

    const actual = await authorizePopup('mockUrl')

    t.equal(actual, 'mockCode')
    t.end()
})

function createEventListener(t, data) {
    return function eventListener(event, callback, options) {
        t.equal(event, 'message')
        t.ok(options.once)
        callback({ data: data })
    }
}

function createPostMessage(t, expectedOrigin, expectedMessage) {
    return function postMessage(message, origin) {
        t.equal(origin, expectedOrigin)
        t.match(message, expectedMessage)
    }
}
