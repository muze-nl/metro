export default function oidcStore(site) {
	let store
	if (typeof localStorage !== 'undefined') {
		store = {
			get: (name)        => JSON.parse(localStorage.getItem('metro/oidc:'+site+':'+name)),
			set: (name, value) => localStorage.setItem('metro/oidc:'+site+':'+name, JSON.stringify(value)),
			has: (name)        => localStorage.getItem('metro/oidc:'+site+':'+name)!==null
		}
	} else {
		let storeMap = new Map()
		store = {
			get: (name)        => JSON.parse(storeMap.get('metro/oidc:'+site+':'+name)||null),
			set: (name, value) => storeMap.set('metro/oidc:'+site+':'+name, JSON.stringify(value)),
			has: (name)        => storeMap.has('metro/oidc:'+site+':'+name)
		}
	}
	return store
}