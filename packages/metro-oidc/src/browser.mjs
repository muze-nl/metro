import metro from '@muze-nl/metro'
import oidcDiscover from './oidc.discovery.mjs'
import oidcRegister from './oidc.register.mjs'
import oidcmw, {isRedirected, idToken, idTokenClaims} from './oidcmw.mjs'

const oidc = {
	oidcmw,
	discover: oidcDiscover,
	register: oidcRegister,
	isRedirected,
	idToken,
	idTokenClaims
}

if (!globalThis.metro.oidc) {
	globalThis.metro.oidc = oidc
}

export default oidc
