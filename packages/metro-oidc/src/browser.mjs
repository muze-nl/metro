import oidcDiscover from './oidc.discovery.mjs'
import oidcRegister from './oidc.register.mjs'

window.oidc = {
	discover: oidcDiscover,
	register: oidcRegister
}
