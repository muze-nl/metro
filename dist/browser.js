(()=>{var O=Object.defineProperty;var A=(o,s)=>{for(var t in s)O(o,t,{get:s[t],enumerable:!0})};var P={};A(P,{client:()=>L,formdata:()=>v,metroError:()=>c,request:()=>w,response:()=>S,symbols:()=>i,trace:()=>D,url:()=>p});var d="https://metro.muze.nl/details/",i={isProxy:Symbol("isProxy"),source:Symbol("source")},l=class o{#e={url:typeof window<"u"?window.location:"https://localhost"};#r=["get","post","put","delete","patch","head","options","query"];static tracers={};constructor(...s){for(let t of s)if(typeof t=="string"||t instanceof String)this.#e.url=""+t;else if(t instanceof o)Object.assign(this.#e,t.#e);else if(t instanceof Function)this.#t([t]);else if(t&&typeof t=="object")for(let e in t)e=="middlewares"?this.#t(t[e]):typeof t[e]=="function"?this.#e[e]=t[e](this.#e[e],this.#e):this.#e[e]=t[e];this.#e.verbs&&(this.#r=this.#e.verbs,delete this.#e.verbs);for(let t of this.#r)this[t]=async function(...e){return this.#n(w(this.#e,...e,{method:t.toUpperCase()}))};Object.freeze(this)}#t(s){typeof s=="function"&&(s=[s]);let t=s.findIndex(e=>typeof e!="function");if(t>=0)throw c("metro.client: middlewares must be a function or an array of functions "+d+"client/invalid-middlewares-value/",s[t]);Array.isArray(this.#e.middlewares)||(this.#e.middlewares=[]),this.#e.middlewares=this.#e.middlewares.concat(s)}#n(s){if(!s.url)throw c("metro.client."+r.method.toLowerCase()+": Missing url parameter "+d+"client/missing-url-param/",s);let e=[async a=>(a[i.isProxy]&&(a=a[i.source]),S(await fetch(a)))].concat(this.#e?.middlewares?.slice()||[]),n=this.#e,f;for(let a of e)f=function(y,g){return async function(k){let m,x=Object.values(o.tracers);for(let u of x)u.request&&u.request.call(u,k);m=await g(k,y);for(let u of x)u.response&&u.response.call(u,m);return m}}(f,a);return f(s)}with(...s){return new o(this,...s)}};function L(...o){return new l(...o)}function b(o,s){let t=s.body;return t||(o===null?t=new ReadableStream:o instanceof ReadableStream?t=o:o instanceof Blob?t=o.stream():t=new ReadableStream({start(e){let n;switch(typeof o){case"object":if(typeof o.toString=="function")n=o.toString();else if(o instanceof FormData)n=new URLSearchParams(o).toString();else if(o instanceof ArrayBuffer||ArrayBuffer.isView(o))n=o;else throw c("Cannot convert body to ReadableStream",o);break;case"string":case"number":case"boolean":n=o;break;default:throw c("Cannot convert body to ReadableStream",o)}e.enqueue(n),e.close()}})),new Proxy(t,{get(e,n,f){switch(n){case i.isProxy:return!0;case i.source:return o;case"toString":return function(){return""+o}}if(typeof o=="object"&&n in o)return typeof o[n]=="function"?function(...a){return o[n].apply(o,a)}:o[n];if(n in e&&n!="toString")return typeof e[n]=="function"?function(...a){return e[n].apply(e,a)}:e[n]},has(e,n){return n in o},ownKeys(e){return Reflect.ownKeys(o)},getOwnPropertyDescriptor(e,n){return Object.getOwnPropertyDescriptor(o,n)}})}function U(o,s){let t=s||{};!t.url&&s.url&&(t.url=s.url);for(let e of["method","headers","body","mode","credentials","cache","redirect","referrer","referrerPolicy","integrity","keepalive","signal","priority","url"])if(typeof o[e]=="function")o[e](t[e],t);else if(typeof o[e]<"u")if(e=="url")t.url=p(t.url,o.url);else if(e=="headers"){t.headers=new Headers(s.headers),o.headers instanceof Headers||(o.headers=new Headers(o.headers));for(let[n,f]of o.headers.entries())t.headers.set(n,f)}else t[e]=o[e];return t}function w(...o){let s={url:typeof window<"u"?window.location:"https://localhost/",duplex:"half"};for(let n of o)typeof n=="string"||n instanceof URL||n instanceof URLSearchParams?s.url=p(s.url,n):n&&(n instanceof FormData||n instanceof ReadableStream||n instanceof Blob||n instanceof ArrayBuffer||n instanceof DataView)?s.body=n:n&&typeof n=="object"&&Object.assign(s,U(n,s));let t=s.body;t&&typeof t=="object"&&!(t instanceof String)&&!(t instanceof ReadableStream)&&!(t instanceof Blob)&&!(t instanceof ArrayBuffer)&&!(t instanceof DataView)&&!(t instanceof FormData)&&!(t instanceof URLSearchParams)&&(typeof TypedArray>"u"||!(t instanceof TypedArray))&&(s.body=JSON.stringify(t));let e=new Request(s.url,s);return Object.freeze(e),new Proxy(e,{get(n,f,a){switch(f){case i.source:return n;case i.isProxy:return!0;case"with":return function(...y){return t&&y.unshift({body:t}),w(n,...y)};case"toString":case"toJSON":return function(){return n[f].apply(n)};case"blob":case"text":case"json":return function(){return n[f].apply(n)};case"body":if(t||(t=n.body),t)return t[i.isProxy]?t:b(t,n);break}return n[f]}})}function R(o,s){let t=s||{};!t.url&&s.url&&(t.url=s.url);for(let e of["status","statusText","headers","body","url","type","redirected"])typeof o[e]=="function"?o[e](t[e],t):typeof o[e]<"u"&&(e=="url"?t.url=new URL(o.url,t.url||"https://localhost/"):t[e]=o[e]);return t}function S(...o){let s={};for(let e of o)typeof e=="string"?s.body=e:e instanceof Response?Object.assign(s,R(e,s)):e&&typeof e=="object"&&(e instanceof FormData||e instanceof Blob||e instanceof ArrayBuffer||e instanceof DataView||e instanceof ReadableStream||e instanceof URLSearchParams||e instanceof String||typeof TypedArray<"u"&&e instanceof TypedArray?s.body=e:Object.assign(s,R(e,s)));let t=new Response(s.body,s);return Object.freeze(t),new Proxy(t,{get(e,n,f){switch(n){case i.isProxy:return!0;case i.source:return e;case"with":return function(...a){return S(e,...a)};case"body":return s.body?s.body[i.isProxy]?s.body:b(s.body,e):b("",e);case"ok":return e.status>=200&&e.status<400;case"headers":return e.headers;default:if(n in s&&n!="toString")return s[n];if(n in e&&n!="toString")return typeof e[n]=="function"?function(...a){return e[n].apply(e,a)}:e[n];break}}})}function j(o,s){typeof s=="function"?s(o.searchParams,o):(s=new URLSearchParams(s),s.forEach((t,e)=>{o.searchParams.append(e,t)}))}function p(...o){let s=["hash","host","hostname","href","password","pathname","port","protocol","username","search","searchParams"],t=new URL("https://localhost/");for(let e of o)if(typeof e=="string"||e instanceof String)t=new URL(e,t);else if(e instanceof URL||typeof Location<"u"&&e instanceof Location)t=new URL(e);else if(e instanceof URLSearchParams)j(t,e);else if(e&&typeof e=="object")for(let n in e)if(n=="search")typeof e.search=="function"?e.search(t.search,t):t.search=new URLSearchParams(e.search);else if(n=="searchParams")j(t,e.searchParams);else{if(!s.includes(n))throw c("metro.url: unknown url parameter "+d+"url/unknown-param-name/",n);if(typeof e[n]=="function")e[n](t[n],t);else if(typeof e[n]=="string"||e[n]instanceof String||typeof e[n]=="number"||e[n]instanceof Number||typeof e[n]=="boolean"||e[n]instanceof Boolean)t[n]=""+e[n];else if(typeof e[n]=="object"&&e[n].toString)t[n]=e[n].toString();else throw c("metro.url: unsupported value for "+n+" "+d+"url/unsupported-param-value/",o[n])}else throw c("metro.url: unsupported option value "+d+"url/unsupported-option-value/",e);return Object.freeze(t),new Proxy(t,{get(e,n,f){switch(n){case i.isProxy:return!0;case i.source:return e;case"with":return function(...a){return p(e,...a)};case"toString":case"toJSON":return function(){return e[n]()}}return e[n]}})}function v(...o){var s=new FormData;for(let t of o)if(t instanceof FormData)for(let e of t.entries())s.append(e[0],e[1]);else if(t&&typeof t=="object")for(let e of Object.entries(t))if(Array.isArray(e[1]))for(let n of e[1])s.append(e[0],n);else s.append(e[0],e[1]);else throw new c("metro.formdata: unknown option type, only FormData or Object supported",t);return Object.freeze(s),new Proxy(s,{get:(t,e,n)=>{switch(e){case i.isProxy:return!0;case i.source:return t;case"with":return function(...f){return v(t,...f)};case"toString":case"toJSON":return function(){return t[e]()}}return t[e]}})}var h={error:(o,...s)=>{console.error("\u24C2\uFE0F  ",o,...s)},info:(o,...s)=>{console.info("\u24C2\uFE0F  ",o,...s)},group:o=>{console.group("\u24C2\uFE0F  "+o)},groupEnd:o=>{console.groupEnd("\u24C2\uFE0F  "+o)}};function c(o,...s){return h.error(o,...s),new Error(o,...s)}var D={add(o,s){l.tracers[o]=s},delete(o){delete l.tracers[o]},clear(){l.tracers={}},group(){let o=0;return{request:s=>{o++,h.group(o),h.info(s?.url,s)},response:s=>{h.info(s?.body?s.body[i.source]:null,s),h.groupEnd(o),o--}}}};window.metro=P;})();
