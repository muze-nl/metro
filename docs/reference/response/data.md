---
title: 'response.data'
---
# response.data

```
let res = metro.response({
	method: 'POST',
	body: {
		foo: 'bar'
	}
})
console.log(res.data) // prints { foo: "bar" }
```

Whenever you set a body on a Response, you can later access the original body parameter as `response.data`. If you access `response.body`, you will see that it is transformed into a ReadableStream, which can only be read once. The metro.response() function adds the `data` property.
