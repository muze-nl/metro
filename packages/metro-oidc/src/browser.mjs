import oidcDiscover from './oidc.discovery.mjs'
import oidcRegister from './oidc.register.mjs'
import oidcmw, {isRedirected} from './oidcmw.mjs'

export const oidc = Object.assign(oidcmw, {
	discover: oidcDiscover,
	register: oidcRegister,
	isRedirected
}

globalThis.oidc = oidc