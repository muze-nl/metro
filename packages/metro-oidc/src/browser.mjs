import metro from '@muze-nl/metro'
import oauth2 from '@muze-nl/metro-oauth2'
import oidcDiscover from './oidc.discovery.mjs'
import oidcRegister from './oidc.register.mjs'
import oidcmw, {isRedirected, idToken} from './oidcmw.mjs'

const oidc = {
	oidcmw,
	discover: oidcDiscover,
	register: oidcRegister,
	isRedirected,
	idToken
}

if (!globalThis.metro.oidc) {
	globalThis.metro.oidc = oidc
}

export default oidc