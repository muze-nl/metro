import oauth2mw, * as oauth2module from './oauth2.mjs'
import * as oauth2discover from './oauth2.discovery.mjs'
import { authorizePopup, handleRedirect } from './oauth2.popup.mjs'
import { tokenStore } from './tokenstore.mjs'
import keysStore from './keysstore.mjs'
import dpopmw from './oauth2.dpop.mjs'

const oauth2 = Object.assign({}, oauth2module, {
	oauth2mw,
	discover: oauth2discover,
	tokenstore: tokenStore,
	dpopmw,
	keysstore: keysStore,
	authorizePopup,
	popupHandleRedirect: handleRedirect
})

export default oauth2
export { default as oauth2mw } from './oauth2.mjs'
export * from './oauth2.mjs'
export { default as discover } from './oauth2.discovery.mjs'
export { authorizePopup, handleRedirect, handleRedirect as popupHandleRedirect } from './oauth2.popup.mjs'
export { tokenStore, tokenStore as tokenstore } from './tokenstore.mjs'
export { default as keysStore, default as keysstore } from './keysstore.mjs'
export { default as dpopmw } from './oauth2.dpop.mjs'
