import * as oauth2module from './oauth2.mjs'
import * as oauth2mockserver from './oauth2.mockserver.mjs'
import * as oauth2discovery from './oauth2.discovery.mjs'
import { tokenStore } from './tokenstore.mjs'
import dpopmw from './oauth2.dpop.mjs'

const oauth2 = Object.assign(oauth2module.default, oauth2module, {
	mockserver: oauth2mockserver,
	discovery: oauth2discovery,
	tokenstore: tokenStore,
	dpopmw
})

export default oauth2