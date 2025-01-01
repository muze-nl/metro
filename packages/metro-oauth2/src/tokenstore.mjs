export function tokenStore(site) {
	let localState, localTokens
	if (typeof localStorage !== 'undefined') {
		localState = {
			get: ()      => localStorage.getItem('metro/state:'+site),
			set: (value) => localStorage.setItem('metro/state:'+site, value),
			has: ()      => localStorage.getItem('metro/state:'+site)!==null
		}
		localTokens = {
			get: (name)        => localStorage.getItem(site+':'+name),
			set: (name, value) => localStorage.setItem(site+':'+name, value),
			has: (name)        => localStorage.getItem(site+':'+name)!==null
		}
	} else {
		let stateMap = new Map()
		localState = {
			get: ()      => stateMap.get('metro/state:'+site),
			set: (value) => stateMap.set('metro/state:'+site, value),
			has: ()      => stateMap.has('metro/state:'+site)
		}
		localTokens = new Map()
	}
	return {
		state: localState,
		tokens: localTokens
	}
}