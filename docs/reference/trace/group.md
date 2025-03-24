---
title: 'metro.trace.group'
---
# metro.trace.group

```
metro.trace.group() : Object<tracer>
```

Returns a tracer that shows console output for each request and response, for each step in the middleware stack. E.g.:

![](../../img/metro.trace.group.png)

You can add this tracer like this:

```javascript
metro.trace.add('group',metro.trace.group())
```
