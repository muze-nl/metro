import oidcmw, { isRedirected, idToken, idTokenClaims } from './oidcmw.mjs'
import discover from './oidc.discovery.mjs'
import register from './oidc.register.mjs'

const oidc = {
	oidcmw,
	discover,
	register,
	isRedirected,
	idToken,
	idTokenClaims
}

export default oidc
export { default as oidcmw } from './oidcmw.mjs'
export { isRedirected, idToken, idTokenClaims } from './oidcmw.mjs'
export { default as discover } from './oidc.discovery.mjs'
export { default as register } from './oidc.register.mjs'
export { default as oidcStore } from './oidc.store.mjs'
export { validateIdToken } from './oidc.jwt.mjs'
