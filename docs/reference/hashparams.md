---
title: 'metro.hashParams'
---
# metro.hashParams

HashParams are an optional part of metro, that is included in `everything.mjs` as `metro.hashParams`.

```javascript
metro.hashParams.parse(url): URLSearchParams
metro.hashParams.append(url, params): URL
metro.hashParams.clean(url): URL
```

HashParams are similar to URLQueryParams, but added to the url.hash instead of the url.queryString. This means that it won't be send to the server. It is only available in the browser. This can be useful for javascript applications that want to create a sharable/bookmarkable URL, without sending information over the internet where it might be logged/captured.

Because url.hash may already have different purposes, hashParams require a start character '?', so `https://example.com/#?foo=bar` is recognized, but `https://example.com/#foo=bar` is not. This allows you to write a url like: `https://example.com/#intro?foo=bar`. Parsing also ends when another '#' character is encountered, e.g: `https://example.com/#?foo=bar#intro`.
