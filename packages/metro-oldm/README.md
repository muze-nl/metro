[![GitHub License](https://img.shields.io/github/license/muze-nl/metro-oldm)](https://github.com/muze-nl/metro-oldm/blob/main/LICENSE)
[![GitHub package.json version](https://img.shields.io/github/package-json/v/muze-nl/metro-oldm)]()
[![NPM Version](https://img.shields.io/npm/v/@muze-nl/metro-oldm)](https://www.npmjs.com/package/@muze-nl/metro-oldm)
[![npm bundle size](https://img.shields.io/bundlephobia/min/@muze-nl/metro-oldm)](https://www.npmjs.com/package/@muze-nl/metro-oldm)
[![Project stage: Experimental][project-stage-badge: Experimental]][project-stage-page]

# Metro OLDM (Linked Data) middleware

The OLDM middleware allows you to configure a [metro client](https://github.com/muze-nl/metro) to handle automatic parsing and writing of Linked Data formats:

```javascript
import oldmmw from '@muze-nl/metro-oldm'

const client = metro.client('https://oauth2api.example.com')
	.with( oldmmw({
		prefixes: {
			'ldp': 'http://www.w3.org/ns/ldp#'
			'schema': 'https://schema.org/'
		}
	}) )

async function fetchMovies() {
	return await client.get('https://example.solidcommunity.net/movies/')
}
````

See the [OLDM](https://github.com/muze-nl/oldm) documentation for information on how to use OLDM data.

[project-stage-badge: Experimental]: https://img.shields.io/badge/Project%20Stage-Experimental-yellow.svg
[project-stage-page]: https://blog.pother.ca/project-stages/
