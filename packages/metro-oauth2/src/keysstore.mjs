export default function keysStore() {
	return new Promise((resolve, reject) => {
		const request = globalThis.indexedDB.open('metro', 1)

		request.onupgradeneeded = () => request.result.createObjectStore('keyPairs', { keyPath: 'domain'})

		request.onerror = (event) => {
			reject(event)
		}

		request.onsuccess = (event) => {
			const db = event.target.result
			resolve({
				set: function(value, key) {
					return new Promise((resolve, reject) => {
						const tx = db.transaction('keyPairs', 'readwriteflush', {durability: 'strict'})
						const objectStore = tx.objectStore('keyPairs')
						tx.oncomplete = () => {
							resolve()
						}
						tx.onerror = reject
						objectStore.put(value, key)
					})
				},
				get: function(key) {
					return new Promise((resolve, reject) => {
						const tx = db.transaction('keyPairs', 'readonly')
						const objectStore = tx.objectStore('keyPairs')
						const request = objectStore.get(key)
						request.onsuccess = () => {
							resolve(request.result)
						}
						request.onerror = reject
						tx.onerror = reject
					})
				}
			})
		}
	})
}