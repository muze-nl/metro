import tap from 'tap'
import { handleRedirect, authorizePopup } from '../src/oauth2.popup.mjs'

tap.test('handleRedirect SHOULD complain WHEN called without Window existing', async t => {
    globalThis.window = undefined

    const actual = t.throws(handleRedirect)

    t.equal(actual.message, "Cannot read properties of undefined (reading 'location')")
    t.end()
})

tap.test('handleRedirect SHOULD complain WHEN called without parent existing', async t => {
    globalThis.window = { location: { origin: 'https://client.example', search: '', hash: '' } }

    const logs = t.capture(console, 'error')
    const actual = handleRedirect()

    t.match(logs(), [
        { args: [ 'No parent window found, cannot post authorization code (or error)' ], returned: undefined },
    ])
    t.notOk(actual)
    t.end()
})

tap.test('handleRedirect SHOULD post Error message WHEN called with parent without query params', async t => {
    globalThis.window = { location: { origin: 'https://client.example', search: '', hash: '' } }
    globalThis.window.parent = {
        postMessage: createPostMessage(t, 'https://client.example', { error: 'Could not find an authorization_code' })
    }

    const actual = handleRedirect()

    t.notOk(actual)
    t.end()
})

tap.test('handleRedirect SHOULD post Error message WHEN called with window opener', async t => {
    globalThis.window = { location: { origin: 'https://client.example', search: '', hash: '' } }
    globalThis.window.parent = globalThis.window
    globalThis.window.opener = {
        postMessage: createPostMessage(t, 'https://client.example', { error: 'Could not find an authorization_code' })
    }

    const actual = handleRedirect()

    t.notOk(actual)
    t.end()
})

tap.test('handleRedirect SHOULD post received error WHEN called with parent with error query param', async t => {
    globalThis.window = { location: { origin: 'https://client.example', search: '?error=mockError&state=mockState', hash: '' } }
    globalThis.window.parent = {
        postMessage: createPostMessage(t, 'https://client.example', { error: 'mockError', state: 'mockState' })
    }

    const actual = handleRedirect()

    t.notOk(actual)
    t.end()
})

tap.test('handleRedirect SHOULD post received error WHEN called with parent with error hash param', async t => {
    globalThis.window = { location: { origin: 'https://client.example', search: '', hash: '#error=mockError&state=mockState' } }
    globalThis.window.parent = {
        postMessage: createPostMessage(t, 'https://client.example', { error: 'mockError', state: 'mockState' })
    }

    const actual = handleRedirect()

    t.notOk(actual)
    t.end()
})

tap.test('handleRedirect SHOULD post received code and state WHEN called with parent with code query param', async t => {
    globalThis.window = { location: { origin: 'https://client.example', search: '?code=mockCode&state=mockState', hash: '' } }
    globalThis.window.parent = {
        postMessage: createPostMessage(t, 'https://client.example', { authorization_code: 'mockCode', state: 'mockState' })
    }

    const actual = handleRedirect()

    t.ok(actual)
    t.end()
})

tap.test('handleRedirect SHOULD post received code WHEN called with opener with code query param', async t => {
    globalThis.window = { location: { origin: 'https://client.example', search: '?code=mockCode&state=mockState', hash: '' } }
    globalThis.window.parent = globalThis.window
    globalThis.window.opener = {
        postMessage: createPostMessage(t, 'https://client.example', { authorization_code: 'mockCode', state: 'mockState' })
    }

    const actual = handleRedirect()

    t.ok(actual)
    t.end()
})

tap.test('handleRedirect SHOULD post received code WHEN called with parent with code hash param', async t => {
    globalThis.window = { location: { origin: 'https://client.example', search: '', hash: '#code=mockCode&state=mockState' } }
    globalThis.window.parent = {
        postMessage: createPostMessage(t, 'https://client.example', { authorization_code: 'mockCode', state: 'mockState' })
    }

    const actual = handleRedirect()

    t.ok(actual)
    t.end()
})

tap.test('authorizePopup SHOULD reject with error message WHEN message posted without error or code', async t => {
    setupWindow(t)
    globalThis.addEventListener = createEventListener(t, { data: {}, origin: 'https://client.example' })
    globalThis.removeEventListener = () => {}

    const actual = await t.rejects(authorizePopup(mockAuthorizationUrl()))

    t.equal(actual, 'Unknown authorization error')
    t.end()
})

tap.test('authorizePopup SHOULD reject with received error message WHEN message posted with error', async t => {
    setupWindow(t)
    globalThis.addEventListener = createEventListener(t, { data: { error: 'mockError' }, origin: 'https://client.example' })
    globalThis.removeEventListener = () => {}

    const actual = await t.rejects(authorizePopup(mockAuthorizationUrl()))

    t.equal(actual, 'mockError')
    t.end()
})

tap.test('authorizePopup SHOULD reject when state does not match', async t => {
    setupWindow(t)
    globalThis.addEventListener = createEventListener(t, {
        data: { authorization_code: 'mockCode', state: 'wrongState' },
        origin: 'https://client.example'
    })
    globalThis.removeEventListener = () => {}

    const actual = await t.rejects(authorizePopup(mockAuthorizationUrl()))

    t.equal(actual, 'OAuth2 authorization state mismatch')
    t.end()
})

tap.test('authorizePopup SHOULD ignore wrong-origin messages and resolve with received code', async t => {
    setupWindow(t)
    globalThis.addEventListener = function eventListener(event, callback) {
        t.equal(event, 'message')
        callback({ data: { authorization_code: 'evilCode', state: 'mockState' }, origin: 'https://evil.example' })
        callback({ data: { authorization_code: 'mockCode', state: 'mockState' }, origin: 'https://client.example' })
    }
    globalThis.removeEventListener = () => {}

    const actual = await authorizePopup(mockAuthorizationUrl())

    t.equal(actual, 'mockCode')
    t.end()
})

tap.test('authorizePopup SHOULD resolve with received code WHEN message posted with code', async t => {
    setupWindow(t)
    globalThis.addEventListener = createEventListener(t, {
        data: { authorization_code: 'mockCode', state: 'mockState' },
        origin: 'https://client.example'
    })
    globalThis.removeEventListener = () => {}

    const actual = await authorizePopup(mockAuthorizationUrl())

    t.equal(actual, 'mockCode')
    t.end()
})

function setupWindow(t) {
    globalThis.window = {
        location: { href: 'https://client.example/app', origin: 'https://client.example' },
        open: (authorizationCodeURL) => t.equal(authorizationCodeURL, mockAuthorizationUrl())
    }
}

function mockAuthorizationUrl() {
    return 'https://server.example/authorize?client_id=mockClientId&redirect_uri=https%3A%2F%2Fclient.example%2Fcallback&state=mockState'
}

function createEventListener(t, eventObject) {
    return function eventListener(event, callback) {
        t.equal(event, 'message')
        callback(eventObject)
    }
}

function createPostMessage(t, expectedOrigin, expectedMessage) {
    return function postMessage(message, origin) {
        t.equal(origin, expectedOrigin)
        t.match(message, expectedMessage)
    }
}
