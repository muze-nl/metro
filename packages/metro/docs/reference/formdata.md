---
title: 'Formdata'
---
# metro.formdata

```
metro.formdata(...options) : FormData
```

Returns a new FormData object built out of the options passed. Options can be of any type that the [default FormData constructor](https://developer.mozilla.org/en-US/docs/Web/API/FormData/FormData) supports. In addition you can also pass an object, e.g:

```javascript
let body = metro.formdata({
  name: 'Luke',
  movies: [
    'A New Hope', 'The Empire Strikes Back', 'Return of the Jedi'
  ]
})
```
