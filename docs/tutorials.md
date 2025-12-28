---
title: 'Tutorial'
weight: 2
---
# MetroJS Tutorial

## Getting Started

MetroJS is available as a NPM package:

```shell
npm install @muze-nl/metro
```

Then use it like this:
```javascript
import metro from '@muze-nl/metro'
```

This gives access to everything included in metro, like the json and thrower middleware. If you want a lighter version, use the exact src/ files, e.g.:

```javascript
import * as metro from '@muze-nl/metro/src/metro.mjs'
import json from '@muze-nl/metro/mw/json.mjs'
```

Or you can use a CDN (Content Delivery Network), like this:
```javascript
import * as metro from 'https://cdn.jsdelivr.net/npm/@muze-nl/metro/src/metro.mjs'
```

Or as a script tag:
```html
<script src="https://cdn.jsdelivr.net/npm/@muze-nl/metro/dist/browser.js"></script>
```

The rest of this document assumes the functions provided by MetroJS will be available as `metro.*`.

MetroJS is built on top of the [Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API), which is standard in all modern web browsers and in Node from version 18. If you are not familiar with this API, it is recommended to read the mdn documentation linked here first.

## Fetching a public resource

```javascript
const client = metro.client('https://example.com')
async function getData() {
	const response = await client.get('/resource')

	if (response.ok) {
		return response.text()
	} else {
		throw new NetworkError(response.status+': '+response.statusText)
	}
}
```

The main difference with the Fetch API here is that there is a `metro.client` object, which can be re-used for multiple requests. It also allows you to set default options for subsequent requests.

In addition, the single `fetch()` function is replaced with seperate functions for each HTTP method. In this case `get()`.

## POSTing to a public resource

```javascript
const client = metro.client('https://example.com')

async function postData(data) {
	const response = await client.post('/resource', metro.formdata(data))
	if (response.ok) {
		return response.text()
	} else {
		throw new NetworkError(response.status+': '+response.statusText)
	}
}
```

A FormData object is automatically assigned to the Request.body, but you can also do this explicitly:

```javascript
const client = metro.client('https://example.com')

async function postData(data) {
	const response = await client.post('/resource', {
		body: metro.formdata(data)
	})
	if (response.ok) {
		return response.text()
	} else {
		throw new NetworkError(response.status+': '+response.statusText)
	}
}
```

## Adding Accept Header

As default:

```javascript
const client = metro.client('https://example.com', {
	headers: {
		Accept: 'application/json'
	}
})
```

Or for a specific request:

```javascript
async function postData(data) {
	const response = await client.post('/resource', metro.formdata(data), {
		headers: {
			Accept: 'application/json'
		}
	})
	if (response.ok) {
		return response.json()
	} else {
		throw new NetworkError(response.status+': '+response.statusText)
	}
}
```

## POSTing with a JSON body

```javascript
const client = metro.client('https://example.com')

async function postData(data) {
	const response = await client.post('/resource', {
		body: data,
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json'
		}
	})
	if (response.ok) {
		return response.json()
	} else {
		throw new NetworkError(response.status+': '+response.statusText)
	}
}
```

## JSON middleware

The json middleware automatically converts data to json, adds the correct headers, and parses responses.
The response body, if parseable as json, is made available as `response.data`

```javascript
import jsonmw from '@muze-nl/metro/src/mw/json.mjs'

const client = metro.client('https://example.com').with( jsonmw() )

async function postData(data) {
	const response = await client.post('/resource', {
		body: data
	})
	if (response.ok) {
		return response.data
	} else {
		throw new NetworkError(response.status+': '+response.statusText)
	}
}
```

## CORS Requests

Just like Fetch, Metro automatically uses CORS mode if you send a request to a different domain. But if you need more than basic CORS, you can use all the options available in the [Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API):

```javascript
const client = metro.client('https://example.com')

async function corsPostData(data) {
	const response = await client.post('/resource', {
		body: metro.formdata(data),
		mode: 'cors',
		credentials: 'same-origin'
	})
	if (response.ok) {
		return response.text()
	} else {
		throw new NetworkError(response.status+': '+response.statusText)
	}
}
```

## Basic Authorization

If you allow the browser to show a prompt for the user to login with a username and password, then there is no difference in code between a request with or without Basic Authorization:

```javascript
const client = metro.client('https://example.com')

async function getPrivateData(data) {
	const response = await client.get('/private')
	if (response.ok) {
		return response.text()
	} else {
		throw new NetworkError(response.status+': '+response.statusText)
	}
}
```

But if you want to avoid that prompt, and know the username and password, you can add the authentication header yourself, like this:

```javascript
const user = 'Foo'
const pass = 'Bar'
const client = metro.client('https://example.com', {
	headers: {
		Authorization: 'Basic '+btoa(user+':'+pass)
	}
}
````

## Adding Bearer Token

```javascript
const token = 'Foo'
const client = metro.client('https://example.com', {
	headers: {
		Authorization: 'Bearer '+token
	}
}
````
