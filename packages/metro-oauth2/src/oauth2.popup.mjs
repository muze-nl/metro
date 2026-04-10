/**
 * Searched window.location.search for code parameter, if not set
 * and window.loction.hash is not empty, it will try to interpret
 * the hash as if it was a query string.
 * if code param is found, will message the opener with the code
 * if not, it will message the opener with an error
 * opener window must have a strict match with the origin of the
 * popup page.
 */
export function handleRedirect(origin = null) {
	let success = false

	origin = origin || window.location.origin

	let params = new URLSearchParams(window.location.search)
	if (!params.has('code') && window.location.hash) {
		let query = window.location.hash.substr(1)
		params = new URLSearchParams('?'+query)
	}

	let parent = (window.parent !== window) ? window.parent : window.opener
	if (! parent) {
		// There is no parent, either the page was opened directly or the user closed the calling window.
		console.error('No parent window found, cannot post authorization code (or error)')
	} else {
		if (params.has('code')) {
			parent.postMessage({
				authorization_code: params.get('code')
			}, origin)
			success = true
		} else if (params.has('error')) {
			parent.postMessage({
				error: params.get('error')
			}, origin)
		} else {
			parent.postMessage({
				error: 'Could not find an authorization_code',
			}, origin)
		}
	}

	return success
}

/**
 * Opens a new window to the oauth2 authorization endpoint, which allows the user to login
 * Returns a Promise, which resolves with the authorization_code if login was succesful
 * Or rejects with an error if not.
 */
export function authorizePopup(authorizationCodeURL) {
	return new Promise((resolve, reject) => {
		addEventListener('message', (event) => {
			if (event.data.authorization_code) {
				resolve(event.data.authorization_code)
			} else if (event.data.error) {
				reject(event.data.error)
			} else {
				reject('Unknown authorization error')
			}
		}, {once:true})
		window.open(authorizationCodeURL)
	})
}