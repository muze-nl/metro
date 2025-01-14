import metro from '@muze-nl/metro'
import oauth2mw, * as oauth2module from './oauth2.mjs'
import * as oauth2mockserver from './oauth2.mockserver.mjs'
import * as oauth2discover from './oauth2.discovery.mjs'
import { authorizePopup, handleRedirect } from './oauth2.popup.mjs'
import { tokenStore } from './tokenstore.mjs'
import keysStore from './keysstore.mjs'
import dpopmw from './oauth2.dpop.mjs'

const oauth2 = Object.assign(oauth2module, {
	oauth2mw,
	mockserver: oauth2mockserver,
	discover: oauth2discover,
	tokenstore: tokenStore,
	dpopmw,
	keysstore: keysStore,
	authorizePopup,
	popupHandleRedirect: handleRedirect
})

if (!globalThis.metro.oauth2) {
	globalThis.metro.oauth2 = oauth2
}

export default oauth2