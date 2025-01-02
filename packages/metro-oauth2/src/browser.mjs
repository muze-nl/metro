import * as oauth2 from './oauth2.mjs'
import * as oauth2mockserver from './oauth2.mockserver.mjs'
import * as oauth2discovery from './oauth2.discovery.mjs'

globalThis.oauth2 = oauth2
globalThis.oauth2.mockserver = oauth2mockserver
globalThis.oauth2.discovery = oauth2discovery
