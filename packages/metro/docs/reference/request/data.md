---
title: 'request.data'
---
# request.data

```
let res = metro.request({
	method: 'POST',
	body: {
		foo: 'bar'
	}
})
console.log(res.data) // prints { foo: "bar" }
```

Whenever you set a body on a request, you can later access the original body parameter as `request.data`. If you access `request.body`, you will see that it is transformed into a ReadableStream, which can only be read once. The metro.request() function adds the `data` property.
