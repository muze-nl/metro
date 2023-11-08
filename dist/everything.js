function e(e,t,o,n){Object.defineProperty(e,t,{get:o,set:n,enumerable:!0,configurable:!0})}var t=globalThis,o={},n={},s=t.parcelRequireea2c;null==s&&((s=function(e){if(e in o)return o[e].exports;if(e in n){var t=n[e];delete n[e];var s={id:e,exports:{}};return o[e]=s,t.call(s.exports,s,s.exports),s.exports}var i=Error("Cannot find module '"+e+"'");throw i.code="MODULE_NOT_FOUND",i}).register=function(e,t){n[e]=t},t.parcelRequireea2c=s),(0,s.register)("hkeot",function(t,o){e(t.exports,"symbols",()=>s),e(t.exports,"request",()=>u),e(t.exports,"metroError",()=>d),e(t.exports,"response",()=>l),e(t.exports,"client",()=>a),e(t.exports,"url",()=>p),e(t.exports,"formdata",()=>function e(...t){var o=new FormData;for(let e of t)if(e instanceof FormData)for(let t of e.entries())o.append(t[0],t[1]);else if(e&&"object"==typeof e)for(let t of Object.entries(e))if(Array.isArray(t[1]))for(let e of t[1])o.append(t[0],e);else o.append(t[0],t[1]);else throw new d("metro.formdata: unknown option type, only FormData or Object supported",e);return Object.freeze(o),new Proxy(o,{get:(t,o,n)=>{switch(o){case s.isProxy:return!0;case s.source:return t;case"with":return function(...o){return e(t,...o)};case"toString":case"toJSON":return function(){return t[o]()}}return t[o]}})}),e(t.exports,"trace",()=>y);let n="https://metro.muze.nl/details/",s={isProxy:Symbol("isProxy"),source:Symbol("source")};class i{#e={url:"undefined"!=typeof window?window.location:"https://localhost"};#t=["get","post","put","delete","patch","head","options","query"];static tracers={};constructor(...e){for(let t of e)if("string"==typeof t||t instanceof String)this.#e.url=""+t;else if(t instanceof i)Object.assign(this.#e,t.#e);else if(t instanceof Function)this.#r([t]);else if(t&&"object"==typeof t)for(let e in t)"middlewares"==e?this.#r(t[e]):"function"==typeof t[e]?this.#e[e]=t[e](this.#e[e],this.#e):this.#e[e]=t[e];for(let e of(this.#e.verbs&&(this.#t=this.#e.verbs,delete this.#e.verbs),this.#t))this[e]=async function(...t){return this.#o(u(this.#e,...t,{method:e.toUpperCase()}))};Object.freeze(this)}#r(e){"function"==typeof e&&(e=[e]);let t=e.findIndex(e=>"function"!=typeof e);if(t>=0)throw d("metro.client: middlewares must be a function or an array of functions "+n+"client/invalid-middlewares-value/",e[t]);Array.isArray(this.#e.middlewares)||(this.#e.middlewares=[]),this.#e.middlewares=this.#e.middlewares.concat(e)}#o(e){let t;if(!e.url)throw d("metro.client."+r.method.toLowerCase()+": Missing url parameter "+n+"client/missing-url-param/",e);let o=[async e=>(e[s.isProxy]&&(e=e[s.source]),l(await fetch(e)))].concat(this.#e?.middlewares?.slice()||[]);for(let e of(this.#e,o))t=function(e,t){return async function(o){let n;let s=Object.values(i.tracers);for(let e of s)e.request&&e.request.call(e,o);for(let i of(n=await t(o,e),s))i.response&&i.response.call(i,n);return n}}(t,e);return t(u(this.#e,e))}with(...e){return new i(this,...e)}}function a(...e){return new i(...e)}function c(e,t){return new Proxy(t.body,{get(t,o,n){switch(o){case s.isProxy:return!0;case s.source:return e;case"toString":return function(){return""+e}}return"object"==typeof e&&o in e?"function"==typeof e[o]?function(...t){return e[o].apply(e,t)}:e[o]:o in t&&"toString"!=o?"function"==typeof t[o]?function(...e){return t[o].apply(t,e)}:t[o]:void 0},has:(t,o)=>o in e,ownKeys:t=>Reflect.ownKeys(e),getOwnPropertyDescriptor:(t,o)=>Object.getOwnPropertyDescriptor(e,o)})}function u(...e){let t={url:"undefined"!=typeof window?window.location:"https://localhost/",duplex:"half"};for(let o of e)"string"==typeof o||o instanceof URL?t.url=p(t.url,o):o&&"object"==typeof o&&Object.assign(t,function(e,t){let o=t||{};for(let n of(!o.url&&t.url&&(o.url=t.url),["method","headers","body","mode","credentials","cache","redirect","referrer","referrerPolicy","integrity","keepalive","signal","priority","url"]))"function"==typeof e[n]?o[n]=e[n](o[n],o):void 0!==e[n]&&("url"==n?o.url=p(o.url,e.url):o[n]=e[n]);return o}(o,t));let o=t.body;!o||"object"!=typeof o||o instanceof String||o instanceof ReadableStream||o instanceof Blob||o instanceof ArrayBuffer||o instanceof DataView||o instanceof FormData||o instanceof URLSearchParams||"undefined"!=typeof TypedArray&&o instanceof TypedArray||(t.body=JSON.stringify(o));let n=new Request(t.url,t);return Object.freeze(n),new Proxy(n,{get(e,t,n){switch(t){case s.source:return e;case s.isProxy:return!0;case"with":return function(...t){return u(e,...t)};case"toString":case"toJSON":case"blob":case"text":case"json":return function(){return e[t].apply(e)};case"body":if(o||(o=e.body),o){if(o[s.isProxy])return o;return c(o,e)}}return e[t]}})}function f(e,t){let o=t||{};for(let n of(!o.url&&t.url&&(o.url=t.url),["status","statusText","headers","body","url","type","redirected"]))"function"==typeof e[n]?o[n]=e[n](o[n],o):void 0!==e[n]&&("url"==n?o.url=new URL(e.url,o.url||"https://localhost/"):o[n]=e[n]);return o}function l(...e){let t={};for(let o of e)"string"==typeof o?t.body=o:o instanceof Response?Object.assign(t,f(o,t)):o&&"object"==typeof o&&(o instanceof FormData||o instanceof Blob||o instanceof ArrayBuffer||o instanceof DataView||o instanceof ReadableStream||o instanceof URLSearchParams||o instanceof String||"undefined"!=typeof TypedArray&&o instanceof TypedArray?t.body=o:Object.assign(t,f(o,t)));let o=new Response(t.body,t);return Object.freeze(o),new Proxy(o,{get(e,o,n){switch(o){case s.isProxy:return!0;case s.source:return e;case"with":return function(...t){return l(e,...t)};case"body":if(!t.body)return c("",e);if(t.body[s.isProxy])return t.body;return c(t.body,e);case"ok":return e.status>=200&&e.status<400;case"headers":return e.headers;default:if(o in t&&"toString"!=o)return t[o];if(o in e&&"toString"!=o){if("function"==typeof e[o])return function(...t){return e[o].apply(e,t)};return e[o]}}}})}function p(...e){let t=["hash","host","hostname","href","password","pathname","port","protocol","username"],o=new URL("https://localhost/");for(let s of e)if("string"==typeof s||s instanceof String)o=new URL(s,o);else if(s instanceof URL||"undefined"!=typeof Location&&s instanceof Location)o=new URL(s);else if(s&&"object"==typeof s)for(let i in s)if("search"==i)"function"==typeof s.search?o.search=s.search(o.search,o):o.search=new URLSearchParams(s.search);else if("searchParams"==i)!function(e,t){if("function"==typeof t){let o=t(e.searchParams,e);o&&(e.searchParams=o)}else(t=new URLSearchParams(t)).forEach((t,o)=>{e.searchParams.append(o,t)})}(o,s.searchParams);else{if(!t.includes(i))throw d("metro.url: unknown url parameter "+n+"url/unknown-param-name/",i);if("function"==typeof s[i])o[i]=s[i](o[i],o);else if("string"==typeof s[i]||s[i]instanceof String||"number"==typeof s[i]||s[i]instanceof Number||"boolean"==typeof s[i]||s[i]instanceof Boolean)o[i]=""+s[i];else if("object"==typeof s[i]&&s[i].toString)o[i]=s[i].toString();else throw d("metro.url: unsupported value for "+i+" "+n+"url/unsupported-param-value/",e[i])}else throw d("metro.url: unsupported option value "+n+"url/unsupported-option-value/",s);return Object.freeze(o),new Proxy(o,{get(e,t,o){switch(t){case s.isProxy:return!0;case s.source:return e;case"with":return function(...t){return p(e,...t)};case"toString":case"toJSON":return function(){return e[t]()}}return e[t]}})}let h={error:(e,...t)=>{console.error("Ⓜ️  ",e,...t)},info:(e,...t)=>{console.info("Ⓜ️  ",e,...t)},group:e=>{console.group("Ⓜ️  "+e)},groupEnd:e=>{console.groupEnd("Ⓜ️  "+e)}};function d(e,...t){return h.error(e,...t),Error(e,...t)}let y={add(e,t){i.tracers[e]=t},delete(e){delete i.tracers[e]},clear(){i.tracers={}},group(){let e=0;return{request:t=>{e++,h.group(e),h.info(t?.url,t)},response:t=>{h.info(t?.body?t.body[s.source]:null,t),h.groupEnd(e),e--}}}}});var i=s("hkeot"),a={};e(a,"enable",()=>u),e(a,"disable",()=>f),e(a,"fails",()=>l),e(a,"check",()=>p),e(a,"optional",()=>h),e(a,"oneOf",()=>d);let c=!1;function u(){c=!0}function f(){c=!1}function l(e,t){let o=[];if(t instanceof RegExp){if(Array.isArray(e)){let n=e.findIndex(e=>l(e,t));n>-1&&o.push("data["+n+"] does not match pattern")}else t.test(e)||o.push("data does not match pattern "+t)}else if(t instanceof Function)t(e)&&o.push("data does not match function");else if(t&&"object"==typeof t){if(Array.isArray(e)){let n=e.findIndex(e=>l(e,t));n>-1&&o.push("data["+n+"] does not match pattern")}else if(e&&"object"==typeof e){e instanceof URLSearchParams&&(e=Object.fromEntries(e));let n=o[o.length-1];for(let[s,i]of Object.entries(t)){let t=l(e[s],i);t&&(n&&"string"!=typeof n||(n={},o.push(n)),n[s]=t.problems)}}else o.push("data is not an object, pattern is")}else t!=e&&o.push("data does not equal "+t);return!!o.length&&o}function p(e,t){if(!c)return;let o=l(e,t);if(o)throw new y(o,e)}function h(e){return function(t){return null!=t&&void 0!==t&&l(t,e)}}function d(...e){return function(t){for(let o of e)if(!l(t,o))return!1;return["data does not match oneOf patterns"]}}class y{constructor(e,...t){this.problems=e,this.details=t,console.trace()}}function w(e){return e=Object.assign({reviver:null,replacer:null,space:""},e),async(t,o)=>{["POST","PUT","PATCH","QUERY"].includes(t.method)?(t=t.with({headers:{"Content-Type":"application/json",Accept:"application/json"}})).body&&"object"==typeof t.body[i.symbols.source]&&(t=t.with({body:JSON.stringify(t.body[i.symbols.source],e.replacer,e.space)})):t=t.with({headers:{Accept:"application/json"}});let n=await o(t),s=JSON.parse(await n.text(),e.reviver);return n.with({body:s})}}var i=(s("hkeot"),s("hkeot"));window.metro=i,window.assert=a,window.metro.mw={jsonmw:w,oauth2:function(e){let t={tokens:new Map,endpoints:{},callbacks:{},client:i.client().with(w()),client_id:"",client_secret:"",grant_type:"authorization_code",force_authorization:!1};for(let o in e)switch(o){case"access_token":case"authorization_code":case"refresh_token":t.tokens.set(o,e[o]);break;case"client":case"client_id":case"client_secret":case"grant_type":case"force_authorization":t[o]=e[o];break;case"tokens":if("function"==typeof e.tokens.set&&"function"==typeof e.tokens.get&&"function"==typeof e.tokens.has)t.tokens=o.tokens;else if(e.tokens&&"object"==typeof e.tokens)for(let o in e.tokens)t.tokens.set(o,e.tokens[o]);break;case"endpoints":for(let t in e.endpoints)if("authorize"!=t&&"token"!=t)throw new i.metroError('Unknown endpoint, choose one of "authorize" or "token"',t);Object.assign(t.endpoints,e.endpoints);break;case"callbacks":for(let t in e.callbacks)if("authorize"!=t)throw new i.metroError('Unknown callback, choose one of "authorize"',t);Object.assign(t.callbacks,e.callbacks);break;default:throw new i.metroError("Unknown oauth2mw option ",o)}return async function(e,n){if(t.force_authorization)return o(e,n);let s=await n(e);if(s.ok)return s;switch(s.status){case 400:case 401:return o(e,n)}return s};async function o(e,a){var c;if(!t.tokens.has("access_token"))return await n(e),o(e,a);if((c=e).oauth2&&c.oauth2.tokens&&c.oauth2.tokens.access&&new Date().getTime()>c.oauth2.tokens.access.expires.getTime())return await s(e),o(e,a);{let o=t.tokens.get("access_token");return a(e=i.request(e,{headers:{Authorization:o.type+" "+o.value}}))}}async function n(e){if("authorization_code"===t.grant_type&&!t.tokens.has("authorization_code")){let e=function(){if(!t.endpoints.authorize)throw i.metroError("oauth2mw: Missing options.endpoints.authorize url");let e=i.url(t.endpoints.authorize,{hash:""});return p(t,{client_id:/.+/,authRedirectURL:/.+/,scope:/.*/}),i.url(e,{search:{response_type:"code",client_id:t.client_id,redirect_uri:t.authRedirectURL,scope:t.scope,state:function(e){let o="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",n="",s=0;for(;s<40;)n+=o.charAt(Math.floor(Math.random()*o.length)),s++;return t.state=n,n}(0)}})}();if(!t.callbacks.authorize||"function"!=typeof t.callbacks.authorize)throw i.metroError("oauth2mw: oauth2 with grant_type:authorization_code requires a callback function in client options.oauth2.callbacks.authorize");let o=await t.callbacks.authorize(e);t.tokens.set("authorization_code",o)}let o=a(),n=await t.client.get(o);if(!n.ok)throw i.metroError(n.status+":"+n.statusText,await n.text());let s=await n.json();return t.tokens.set("access_token",{value:s.access_token,expires:c(s.expires_in),type:s.token_type,scope:s.scope}),s.refresh_token&&t.tokens.set("refresh",s.refresh_token),s}async function s(e,o){let n=a("refresh_token"),s=await t.client.get(n);if(!s.ok)throw i.metroError(res.status+":"+res.statusText,await res.text());let u=await s.json();return t.tokens.set("access_token",{value:u.access_token,expires:c(u.expires_in),type:u.token_type,scope:u.scope}),u.refresh_token&&t.tokens.set("refresh_token",u.refresh_token),u}function a(e=null){if(!t.endpoints.token)throw i.metroError("oauth2mw: Missing options.endpoints.token url");let o=i.url(t.endpoints.token,{hash:""}),n={grant_type:e||t.grant_type,client_id:t.client_id,client_secret:t.client_secret};switch(t.scope&&(n.scope=t.scope),t.grant_type){case"authorization_code":t.redirect_uri&&(n.redirect_uri=t.redirect_uri),n.code=t.tokens.get("authorization"),n.response_type="token";break;case"client_credentials":case"refresh_token":throw Error("Not yet implemented")}return i.request(o,{method:"GET",url:{searchParams:n}})}function c(e){if(e instanceof Date)return new Date(e.getTime());if("number"==typeof e){let t=new Date;return t.setSeconds(t.getSeconds()+e),t}throw TypeError("Unknown expires type "+e)}}};
//# sourceMappingURL=everything.js.map