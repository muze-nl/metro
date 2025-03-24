---
title: 'Quickstart'
weight: 1
---
# Quickstart

## Installation

```shell
npm install @muze-nl/metro
```

Or in the browser, using a cdn:

```html
<script src="https://cdn.jsdelivr.net/npm/@muze-nl/metro/dist/browser.js"></script>
<script>
  async function main() {
    const client = metro.client('https://example.com/')
    const result = await client.get('folder/page.html')
  }
  main()
</script>
```

If you are using a cdn, and need the assert library or one of the default middleware plugins, use the `dist/everything.js` script instead:

```html
<script src="https://cdn.jsdelivr.net/npm/@muze-nl/metro/dist/everything.js"></script>
<script>
  const client = metro.client(metro.mw.jsonmw())
</script>
```

MetroJS is also available on Github as https://github.com/muze-nl/metro/.

## Posting form data

The metro client supports the post method using `client.post()`:

```javascript
const client = metro.client()
let response = await client.post(url, {
  body: metro.formdata({
    name: value
  })
})
```

The `metro.formdata()` method is a wrapper for the [default FormData class](https://developer.mozilla.org/en-US/docs/Web/API/FormData), and accepts all of the parameters that the [FormData constructor method](https://developer.mozilla.org/en-US/docs/Web/API/FormData/FormData) accepts. In addition, you can also pass an object, as used in the example above.
