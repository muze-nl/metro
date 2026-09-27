/**
 * Searches window.location.search for a code parameter. If not set and
 * window.location.hash is not empty, it will try to interpret the hash as a
 * query string. If a code param is found, it messages the opener with the code
 * and state. If not, it messages the opener with an error.
 *
 * The opener window must have a strict match with the origin of the popup page.
 */
export function handleRedirect(origin = null) {
	let success = false

	origin = origin || window.location.origin

	let params = new URLSearchParams(window.location.search)
	if (!params.has('code') && !params.has('error') && window.location.hash) {
		let query = window.location.hash.substring(1)
		params = new URLSearchParams('?'+query)
	}

	let parent = (window.parent !== window) ? window.parent : window.opener
	if (! parent) {
		console.error('No parent window found, cannot post authorization code (or error)')
	} else {
		let message

		if (params.has('code')) {
			success = true
			message = {
				authorization_code: params.get('code'),
				state: params.get('state'),
				iss: params.get('iss')
			}
		} else if (params.has('error')) {
			message = {
				error: params.get('error'),
				error_description: params.get('error_description'),
				state: params.get('state'),
				iss: params.get('iss')
			}
		} else {
			message = { error: 'Could not find an authorization_code' }
		}

		parent.postMessage(message, origin)
	}

	return success
}

/**
 * Opens a new window to the oauth2 authorization endpoint.
 * Returns a Promise, which resolves with the authorization response
 * { authorization_code, state, iss } when login was successful, or rejects
 * with an error if not, including when the user closes the popup. oauth2mw
 * checks the state and iss of that response.
 */
export function authorizePopup(authorizationCodeURL, options = {}) {
	const url = new URL(authorizationCodeURL, window.location.href)
	const expectedState = url.searchParams.get('state')
	const redirectUri = url.searchParams.get('redirect_uri')
	const expectedOrigin = redirectUri ? new URL(redirectUri, window.location.href).origin : window.location.origin

	return new Promise((resolve, reject) => {
		let settled = false
		let closedWatcher = null
		const cleanup = () => {
			settled = true
			clearInterval(closedWatcher)
			if (typeof removeEventListener === 'function') {
				removeEventListener('message', handler)
			}
		}
		const handler = (event) => {
			if (event.origin && event.origin !== expectedOrigin) {
				return
			}
			if (event.data.authorization_code) {
				if (expectedState && event.data.state !== expectedState) {
					cleanup()
					reject('OAuth2 authorization state mismatch')
					return
				}
				cleanup()
				resolve({
					authorization_code: event.data.authorization_code,
					state: event.data.state,
					iss: event.data.iss
				})
			} else if (event.data.error) {
				if (expectedState && event.data.state && event.data.state !== expectedState) {
					cleanup()
					reject('OAuth2 authorization state mismatch')
					return
				}
				cleanup()
				reject(event.data.error_description || event.data.error)
			} else {
				cleanup()
				reject('Unknown authorization error')
			}
		}
		addEventListener('message', handler)
		const popup = options.popup || window.open(authorizationCodeURL)
		if (!popup || popup.closed) {
			cleanup()
			reject('OAuth2 popup was blocked')
			return
		}
		if (options.popup) {
			popup.location.href = authorizationCodeURL
		}
		// Browsers do not report a closed window, so check for it. Without this
		// the promise never settles when the user closes the popup.
		if (!settled) {
			closedWatcher = setInterval(() => {
				if (popup.closed) {
					cleanup()
					reject('OAuth2 popup was closed')
				}
			}, POPUP_CLOSED_CHECK_MS)
		}
	})
}

const POPUP_CLOSED_CHECK_MS = 500
