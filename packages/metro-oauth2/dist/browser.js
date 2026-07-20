(() => {
  var __defProp = Object.defineProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };

  // ../metro-core/src/index.mjs
  var src_exports = {};
  __export(src_exports, {
    Client: () => Client,
    client: () => client,
    deepClone: () => deepClone,
    metroError: () => metroError,
    request: () => request,
    response: () => response,
    url: () => url
  });

  // ../metro-core/src/metro.mjs
  var metroURL = "https://metro.muze.nl/details/";
  if (!Symbol.metroProxy) {
    Symbol.metroProxy = /* @__PURE__ */ Symbol("isProxy");
  }
  if (!Symbol.metroSource) {
    Symbol.metroSource = /* @__PURE__ */ Symbol("source");
  }
  var Client = class _Client {
    clientOptions = {
      url: typeof window != "undefined" ? url(window.location) : url("https://localhost"),
      verbs: ["get", "post", "put", "delete", "patch", "head", "options", "query"]
    };
    static tracers = {};
    /**
     * @typedef {Object} ClientOptions
     * @property {Array} middlewares - list of middleware functions
     * @property {string|URL} url - default url of the client
     * @property {[string]} verbs - a list of verb methods to expose, e.g. ['get','post']
     * 
     * Constructs a new metro client. Can have any number of params.
     * @params {ClientOptions|URL|Function|Client}
     * @returns {Client} - A metro client object with given or default verb methods
     */
    constructor(...options) {
      for (let option of options) {
        if (typeof option == "string" || option instanceof String) {
          this.clientOptions.url = url(this.clientOptions.url.href, option);
        } else if (option instanceof _Client) {
          Object.assign(this.clientOptions, option.clientOptions);
        } else if (option instanceof Function) {
          this.#addMiddlewares([option]);
        } else if (option && typeof option == "object") {
          for (let param in option) {
            if (param == "middlewares") {
              this.#addMiddlewares(option[param]);
            } else if (param == "url") {
              this.clientOptions.url = url(this.clientOptions.url.href, option[param]);
            } else if (typeof option[param] == "function") {
              this.clientOptions[param] = option[param](this.clientOptions[param], this.clientOptions);
            } else {
              this.clientOptions[param] = option[param];
            }
          }
        }
      }
      for (const verb of this.clientOptions.verbs) {
        this[verb] = async function(...options2) {
          return this.fetch(
            request(
              this.clientOptions,
              ...options2,
              { method: verb.toUpperCase() }
            ),
            fetchOptionsFrom(...options2)
          );
        };
      }
    }
    #addMiddlewares(middlewares) {
      if (typeof middlewares == "function") {
        middlewares = [middlewares];
      }
      let index = middlewares.findIndex((m) => typeof m != "function");
      if (index >= 0) {
        throw metroError("metro.client: middlewares must be a function or an array of functions " + metroURL + "client/invalid-middlewares/", middlewares[index]);
      }
      if (!Array.isArray(this.clientOptions.middlewares)) {
        this.clientOptions.middlewares = [];
      }
      this.clientOptions.middlewares = this.clientOptions.middlewares.concat(middlewares);
    }
    /**
     * Mimics the standard browser fetch method, but uses any middleware installed through
     * the constructor.
     * @param {Request|string|Object} - Required. The URL or Request object, accepts all types that are accepted by metro.request
     * @param {Object} - Optional. Any object that is accepted by metro.request
     * @return {Promise<Response|*>} - The metro.response to this request, or any other result as changed by any included middleware.
     */
    fetch(req, options) {
      req = request(req, options);
      if (!req.url) {
        throw metroError("metro.client." + req.method.toLowerCase() + ": Missing url parameter " + metroURL + "client/fetch-missing-url/", req);
      }
      if (!options) {
        options = {};
      }
      if (!(typeof options === "object") || options instanceof String) {
        throw metroError("metro.client.fetch: Invalid options parameter " + metroURL + "client/fetch-invalid-options/", options);
      }
      const metrofetch = async function browserFetch(req2) {
        if (req2[Symbol.metroProxy]) {
          req2 = req2[Symbol.metroSource];
        }
        const res = await fetch(req2);
        return response(res);
      };
      let middlewares = [metrofetch].concat(this.clientOptions?.middlewares?.slice() || []);
      options = Object.assign({}, this.clientOptions, options);
      const traceContext = createTraceContext(req, options);
      const middlewareContext = createMiddlewareContext(this, options, traceContext);
      let next;
      for (let middleware of middlewares) {
        next = /* @__PURE__ */ (function(next2, middleware2) {
          return async function(req2) {
            let res;
            let tracers = traceContext.tracers;
            callTracers(tracers, "request", req2, middleware2, traceContext);
            try {
              res = await middleware2(req2, next2, middlewareContext);
            } catch (error2) {
              callTracers(tracers, "error", error2, req2, middleware2, traceContext);
              throw error2;
            }
            callTracers(tracers, "response", res, middleware2, traceContext);
            return res;
          };
        })(next, middleware);
      }
      return next(req);
    }
    with(...options) {
      return new _Client(deepClone(this.clientOptions), ...options);
    }
    get location() {
      return this.clientOptions.url;
    }
  };
  var traceContextId = 0;
  var TRACE_OPTION_KEYS = ["trace", "tracer", "tracers"];
  function fetchOptionsFrom(...options) {
    const result = {};
    for (const option of options) {
      if (!isPlainObject(option)) {
        continue;
      }
      for (const key of TRACE_OPTION_KEYS) {
        if (key in option) {
          result[key] = option[key];
        }
      }
    }
    return result;
  }
  function createTraceContext(req, options = {}) {
    const parent = traceParentFrom(options.trace || options.tracer || options.tracers);
    let localTracers = [];
    if (parent) {
      localTracers = parent.localTracers || [];
    } else {
      localTracers = normalizeTracers(options.trace).concat(normalizeTracers(options.tracer)).concat(normalizeTracers(options.tracers));
    }
    const globalTracers = Object.values(Client.tracers || {});
    const context = {
      __metroTraceContext: true,
      id: "metro-trace-context-" + ++traceContextId,
      parent,
      request: req,
      options,
      globalTracers,
      localTracers,
      tracers: globalTracers.concat(localTracers)
    };
    return context;
  }
  function traceParentFrom(value) {
    if (!value) {
      return null;
    }
    if (value.context?.__metroTraceContext) {
      return value.context;
    }
    if (value.__metroTraceContext) {
      return value;
    }
    return null;
  }
  function normalizeTracers(value) {
    if (!value || value.__metroTraceContext || value.context?.__metroTraceContext) {
      return [];
    }
    if (Array.isArray(value)) {
      return value.flatMap(normalizeTracers);
    }
    if (isTracer(value)) {
      return [value];
    }
    if (isPlainObject(value)) {
      return Object.values(value).flatMap(normalizeTracers);
    }
    return [];
  }
  function isTracer(value) {
    return value && typeof value == "object" && [
      "request",
      "response",
      "error",
      "event",
      "diagnostic",
      "span",
      "link",
      "current"
    ].some((name) => typeof value[name] == "function");
  }
  function createMiddlewareContext(client2, options, traceContext) {
    const trace = createTraceAPI(traceContext);
    return Object.freeze({
      client: client2,
      options,
      trace,
      fetch(req, fetchOptions = {}) {
        return client2.fetch(req, Object.assign({}, fetchOptions, { trace }));
      }
    });
  }
  function createTraceAPI(context) {
    const api = {
      __metroTraceContext: true,
      context,
      event(name, data = {}) {
        callTracers(context.tracers, "event", name, data, context);
      },
      diagnostic(diagnostic = {}) {
        callTracers(context.tracers, "diagnostic", diagnostic, context);
      },
      current() {
        for (const tracer of context.tracers) {
          if (typeof tracer.current == "function") {
            const current = tracer.current(context);
            if (current) {
              return current;
            }
          }
        }
        return { traceId: null, spanId: null };
      },
      async span(name, fn, data = {}) {
        const tracer = context.tracers.find((tracer2) => typeof tracer2.span == "function");
        if (!tracer) {
          return fn();
        }
        return tracer.span(name, fn, data, context);
      },
      link(key) {
        let traceId = null;
        for (const tracer of context.tracers) {
          if (typeof tracer.link == "function") {
            traceId = tracer.link(key, void 0, context) || traceId;
          }
        }
        return traceId;
      },
      options(extra = {}) {
        return Object.assign({}, extra, { trace: api });
      }
    };
    return api;
  }
  function callTracers(tracers, method, ...args) {
    for (const tracer of tracers) {
      if (tracer && typeof tracer[method] == "function") {
        tracer[method].call(tracer, ...args);
      }
    }
  }
  function isPlainObject(value) {
    return value && typeof value == "object" && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
  }
  function client(...options) {
    return new Client(...deepClone(options));
  }
  function getRequestParams(req, current) {
    let params = current || {};
    if (!params.url && current.url) {
      params.url = current.url;
    }
    for (let prop of [
      "method",
      "headers",
      "body",
      "mode",
      "credentials",
      "cache",
      "redirect",
      "referrer",
      "referrerPolicy",
      "integrity",
      "keepalive",
      "signal",
      "priority",
      "url"
    ]) {
      let value = req[prop];
      if (typeof value == "undefined" || value == null) {
        continue;
      }
      if (value?.[Symbol.metroProxy]) {
        value = value[Symbol.metroSource];
      }
      if (typeof value == "function") {
        params[prop] = value(params[prop], params);
      } else {
        if (prop == "url") {
          params.url = url(params.url, value);
        } else if (prop == "headers") {
          params.headers = new Headers(current.headers);
          if (!(value instanceof Headers)) {
            value = new Headers(req.headers);
          }
          for (let [key, val] of value.entries()) {
            params.headers.set(key, val);
          }
        } else {
          params[prop] = value;
        }
      }
    }
    if (req instanceof Request && req.data) {
      params.body = req.data;
    }
    return params;
  }
  function request(...options) {
    let requestParams = {
      url: typeof window != "undefined" ? url(window.location) : url("https://localhost/"),
      duplex: "half"
      // required when setting body to ReadableStream, just set it here by default already
    };
    for (let option of options) {
      if (typeof option == "string" || option instanceof URL || option instanceof URLSearchParams) {
        requestParams.url = url(requestParams.url, option);
      } else if (option && (option instanceof FormData || option instanceof ReadableStream || option instanceof Blob || option instanceof ArrayBuffer || option instanceof DataView)) {
        requestParams.body = option;
      } else if (option && typeof option == "object") {
        Object.assign(requestParams, getRequestParams(option, requestParams));
      }
    }
    let r = new Request(requestParams.url, requestParams);
    let data = requestParams.body;
    if (data) {
      if (typeof data == "object" && !(data instanceof String) && !(data instanceof ReadableStream) && !(data instanceof Blob) && !(data instanceof ArrayBuffer) && !(data instanceof DataView) && !(data instanceof FormData) && !(data instanceof URLSearchParams) && (globalThis.ArrayBuffer && ArrayBuffer.isView(data))) {
        if (typeof data.toString == "function") {
          requestParams.body = data.toString({ headers: r.headers });
          r = new Request(requestParams.url, requestParams);
        }
      }
    }
    Object.freeze(r);
    return new Proxy(r, {
      get(target, prop) {
        let result;
        switch (prop) {
          case Symbol.metroSource:
            result = target;
            break;
          case Symbol.metroProxy:
            result = true;
            break;
          case "with":
            result = function(...options2) {
              if (typeof data !== "undefined") {
                options2.unshift({ body: data });
              }
              return request(target, ...options2);
            };
            break;
          case "data":
            result = data;
            break;
          default:
            if (target[prop] instanceof Function) {
              if (prop === "clone") {
                result = function() {
                  const cloned = target.clone();
                  if (typeof data != "undefined" && !(typeof ReadableStream != "undefined" && data instanceof ReadableStream)) {
                    return request(cloned, { body: data });
                  }
                  return request(cloned);
                };
              } else {
                result = target[prop].bind(target);
              }
            } else {
              result = target[prop];
            }
            break;
        }
        return result;
      }
    });
  }
  function getResponseParams(res, current) {
    let params = current || {};
    if (!params.url && current.url) {
      params.url = current.url;
    }
    for (let prop of ["status", "statusText", "headers", "body", "url", "type", "redirected"]) {
      let value = res[prop];
      if (typeof value == "undefined" || value == null) {
        continue;
      }
      if (value?.[Symbol.metroProxy]) {
        value = value[Symbol.metroSource];
      }
      if (typeof value == "function") {
        params[prop] = value(params[prop], params);
      } else {
        if (prop == "url") {
          params.url = new URL(value, params.url || "https://localhost/");
        } else {
          params[prop] = value;
        }
      }
    }
    if (res instanceof Response && res.data) {
      params.body = res.data;
    }
    return params;
  }
  function response(...options) {
    let responseParams = {};
    for (let option of options) {
      if (typeof option == "string") {
        responseParams.body = option;
      } else if (option instanceof Response) {
        Object.assign(responseParams, getResponseParams(option, responseParams));
      } else if (option && typeof option == "object") {
        if (option instanceof FormData || option instanceof Blob || option instanceof ArrayBuffer || option instanceof DataView || option instanceof ReadableStream || option instanceof URLSearchParams || option instanceof String || typeof globalThis.TypedArray != "undefined" && option instanceof globalThis.TypedArray) {
          responseParams.body = option;
        } else {
          Object.assign(responseParams, getResponseParams(option, responseParams));
        }
      }
    }
    let data = void 0;
    if (responseParams.body) {
      data = responseParams.body;
    }
    if ([101, 204, 205, 304].includes(responseParams.status)) {
      responseParams.body = null;
    }
    let r = new Response(responseParams.body, responseParams);
    Object.freeze(r);
    return new Proxy(r, {
      get(target, prop) {
        let result;
        switch (prop) {
          case Symbol.metroProxy:
            result = true;
            break;
          case Symbol.metroSource:
            result = target;
            break;
          case "with":
            result = function(...options2) {
              return response(target, ...options2);
            };
            break;
          case "data":
            result = data;
            break;
          case "ok":
            result = target.status >= 200 && target.status < 300;
            break;
          default:
            if (typeof target[prop] == "function") {
              result = target[prop].bind(target);
            } else {
              result = target[prop];
            }
            break;
        }
        return result;
      }
    });
  }
  function appendSearchParams(url2, params) {
    if (typeof params == "function") {
      params(url2.searchParams, url2);
    } else {
      params = new URLSearchParams(params);
      params.forEach((value, key) => {
        url2.searchParams.append(key, value);
      });
    }
  }
  function appendHashParams(value, params) {
    const target = value[Symbol.metroSource] || value;
    if (!(params instanceof URLSearchParams)) {
      params = new URLSearchParams(params);
    }
    let hash = target.hash || "#";
    hash += "?" + params;
    return url(target, { hash });
  }
  function url(...options) {
    let validParams = [
      "hash",
      "fragment",
      "host",
      "hostname",
      "href",
      "password",
      "pathname",
      "port",
      "protocol",
      "username",
      "search",
      "searchParams",
      "hashParams"
    ];
    let u = new URL("https://localhost/");
    let hParams = null;
    for (let option of options) {
      if (typeof option == "string" || option instanceof String) {
        u = new URL(option, u);
      } else if (option instanceof URL || typeof Location != "undefined" && option instanceof Location) {
        u = new URL(option);
      } else if (option instanceof URLSearchParams) {
        appendSearchParams(u, option);
      } else if (option && typeof option == "object") {
        for (let param in option) {
          switch (param) {
            case "search":
              if (typeof option.search == "function") {
                option.search(u.search, u);
              } else {
                u.search = new URLSearchParams(option.search);
              }
              break;
            case "searchParams":
              appendSearchParams(u, option.searchParams);
              break;
            default:
              if (!validParams.includes(param)) {
                throw metroError("metro.url: unknown url parameter " + metroURL + "url/unknown-param-name/", param);
              }
              if (param == "fragment") {
                let fragment = option.fragment;
                if (fragment && typeof fragment == "string" && fragment[0] != "#") {
                  fragment = "#" + fragment;
                }
                option.hash = fragment;
                param = "hash";
              } else if (param == "hashParams") {
                hParams = option.hashParams;
              }
              if (typeof option[param] == "function") {
                option[param](u[param], u);
              } else if (typeof option[param] == "string" || option[param] instanceof String || typeof option[param] == "number" || option[param] instanceof Number || typeof option[param] == "boolean" || option[param] instanceof Boolean) {
                u[param] = "" + option[param];
              } else if (typeof option[param] == "object" && option[param].toString) {
                u[param] = option[param].toString();
              } else {
                throw metroError("metro.url: unsupported value for " + param + " " + metroURL + "url/unsupported-param-value/", options[param]);
              }
              break;
          }
        }
      } else {
        throw metroError("metro.url: unsupported option value " + metroURL + "url/unsupported-option-value/", option);
      }
    }
    if (hParams) {
      if (!u.hash) {
        u.hash = "#";
      }
      if (typeof hParams == "string") {
        u.hash += hParams;
      } else {
        u = appendHashParams(u, hParams);
      }
    }
    Object.freeze(u);
    return new Proxy(u, {
      get(target, prop) {
        let result;
        switch (prop) {
          case Symbol.metroProxy:
            result = true;
            break;
          case Symbol.metroSource:
            result = target;
            break;
          case "with":
            result = function(...options2) {
              return url(target, ...options2);
            };
            break;
          case "filename":
            result = target.pathname.split("/").pop();
            break;
          case "folderpath":
            result = target.pathname.substring(0, target.pathname.lastIndexOf("/") + 1);
            break;
          case "authority":
            result = target.username ?? "";
            result += target.password ? ":" + target.password : "";
            result += result ? "@" : "";
            result += target.hostname;
            result += target.port ? ":" + target.port : "";
            result += "/";
            result = target.protocol + "//" + result;
            break;
          case "fragment":
            result = target.hash.substring(1);
            break;
          case "scheme":
            if (target.protocol) {
              result = target.protocol.substring(0, target.protocol.length - 1);
            } else {
              result = "";
            }
            break;
          default:
            if (target[prop] instanceof Function) {
              result = target[prop].bind(target);
            } else {
              result = target[prop];
            }
            break;
        }
        return result;
      }
    });
  }
  var metroConsole = {
    error: (message, ...details) => {
      console.error("\u24C2\uFE0F  ", message, ...details);
    },
    info: (message, ...details) => {
      console.info("\u24C2\uFE0F  ", message, ...details);
    },
    group: (name) => {
      console.group("\u24C2\uFE0F  " + name);
    },
    groupEnd: (name) => {
      console.groupEnd("\u24C2\uFE0F  " + name);
    }
  };
  function metroError(message, ...details) {
    metroConsole.error(message, ...details);
    return new Error(message, ...details);
  }
  function deepClone(object) {
    if (Array.isArray(object)) {
      return object.slice().map(deepClone);
    }
    if (object && typeof object === "object") {
      if (object.__proto__?.constructor == Object || !object.__proto__) {
        let result = Object.assign({}, object);
        Object.keys(result).forEach((key) => {
          result[key] = deepClone(object[key]);
        });
        return result;
      } else {
        return object;
      }
    }
    return object;
  }

  // src/oauth2.mjs
  var oauth2_exports = {};
  __export(oauth2_exports, {
    base64url_encode: () => base64url_encode,
    createState: () => createState,
    default: () => oauth2mw,
    generateCodeChallenge: () => generateCodeChallenge,
    generateCodeVerifier: () => generateCodeVerifier,
    getExpires: () => getExpires,
    isAuthorized: () => isAuthorized,
    isExpired: () => isExpired,
    isRedirected: () => isRedirected,
    parseBearerChallenge: () => parseBearerChallenge
  });

  // ../../node_modules/@muze-nl/assert/src/assert-core.mjs
  var assert_core_exports = {};
  __export(assert_core_exports, {
    Optional: () => Optional,
    Recommended: () => Recommended,
    Required: () => Required,
    allOf: () => allOf,
    anyOf: () => anyOf,
    assert: () => assert,
    disable: () => disable,
    enable: () => enable,
    error: () => error,
    fails: () => fails,
    formatIssue: () => formatIssue,
    formatIssues: () => formatIssues,
    instanceOf: () => instanceOf,
    issues: () => issues,
    not: () => not,
    oneOf: () => oneOf,
    validEmail: () => validEmail,
    validURL: () => validURL,
    warn: () => warn
  });
  var assertEnabled = false;
  function enable() {
    assertEnabled = true;
  }
  function disable() {
    assertEnabled = false;
  }
  function appendPath(path = "", key) {
    if (typeof path == "undefined" || path == null) {
      path = "";
    }
    if (typeof key == "number") {
      return `${path}[${key}]`;
    }
    return `${path}.${key}`;
  }
  function pathToArray(path = "") {
    if (Array.isArray(path)) {
      return path;
    }
    if (!path) {
      return [];
    }
    let result = [];
    let matcher = /(?:^|\.)([^.\[\]]+)|\[(\d+)\]/g;
    let match;
    while (match = matcher.exec(path)) {
      if (typeof match[1] != "undefined") {
        result.push(match[1]);
      } else if (typeof match[2] != "undefined") {
        result.push(Number(match[2]));
      }
    }
    return result;
  }
  function pathToString(path = []) {
    if (typeof path == "string") {
      return path.startsWith(".") ? path.slice(1) : path;
    }
    return path.map((part, index) => {
      if (typeof part == "number") {
        return `[${part}]`;
      }
      return `${index ? "." : ""}${part}`;
    }).join("");
  }
  function describeFunction(value) {
    if (value === String) {
      return "string";
    }
    if (value === Number) {
      return "number";
    }
    if (value === Boolean) {
      return "boolean";
    }
    return value.name || "function";
  }
  function clip(text, maxLength = 60) {
    if (text.length <= maxLength) {
      return text;
    }
    return text.slice(0, maxLength - 1) + "\u2026";
  }
  function quoteString(value) {
    return `'${clip(String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\n/g, "\\n"))}'`;
  }
  function jsonSummary(value) {
    try {
      let json = JSON.stringify(value);
      if (typeof json == "string") {
        return clip(json);
      }
    } catch (e) {
    }
    let name = value?.constructor?.name;
    if (name && name != "Object") {
      return name;
    }
    return Object.prototype.toString.call(value);
  }
  function formatValue(value) {
    if (typeof value == "string") {
      return quoteString(value);
    }
    if (typeof value == "undefined") {
      return "undefined";
    }
    if (value === null) {
      return "null";
    }
    if (typeof value == "function") {
      return describeFunction(value);
    }
    if (value instanceof RegExp) {
      return value.toString();
    }
    if (typeof value == "number" || typeof value == "boolean" || typeof value == "bigint") {
      return String(value);
    }
    if (typeof value == "symbol") {
      return value.toString();
    }
    return jsonSummary(value);
  }
  function describeExpected(value) {
    if (value === String || value === Number || value === Boolean) {
      return describeFunction(value);
    }
    if (typeof value == "function") {
      return describeFunction(value);
    }
    if (value instanceof RegExp) {
      return value.toString();
    }
    if (Array.isArray(value)) {
      return "[" + value.map(describeExpected).join(", ") + "]";
    }
    return formatValue(value);
  }
  function describeOneOf(patterns) {
    return patterns.map(describeExpected).join(", ");
  }
  function conciseMessage(message, actual, expected) {
    if (message == "data and pattern are not equal") {
      return `expected ${formatValue(expected)}, found ${formatValue(actual)}`;
    }
    if (message == "data does not match pattern" || /^data\[\d+\] does not match pattern$/.test(message)) {
      return `expected ${describeExpected(expected)}, found ${formatValue(actual)}`;
    }
    if (message == "data is undefined, should match pattern") {
      return `missing; expected ${describeExpected(expected)}`;
    }
    if (message == "data is required") {
      return "required";
    }
    if (message == "data is an empty string, which is not allowed") {
      return "empty string is not allowed";
    }
    if (message == "data is not an object, pattern is") {
      return "data is not an object";
    }
    if (message == "data is not an instanceof pattern") {
      return `expected instance of ${describeExpected(expected)}, found ${formatValue(actual)}`;
    }
    if (message == "data does not match oneOf patterns" || message == "data does not match anyOf patterns") {
      return `expected one of ${describeOneOf(expected)}, found ${formatValue(actual)}`;
    }
    if (message == "data matches pattern, when required not to") {
      return `must not match ${describeExpected(expected)}`;
    }
    return message;
  }
  function formatIssue(issue, options = {}) {
    if (!issue || typeof issue != "object") {
      return String(issue);
    }
    let path = issue.pathString || pathToString(issue.path || []) || "value";
    let indent = options.indent ?? "";
    return `${indent}${path}: ${issue.message}`;
  }
  function formatIssues(issues2, options = {}) {
    if (!issues2) {
      return false;
    }
    let indent = options.indent ?? "  - ";
    return (Array.isArray(issues2) ? issues2 : [issues2]).map((issue) => formatIssue(issue, { ...options, indent }));
  }
  function issueFromProblem(problem) {
    if (!problem || typeof problem != "object") {
      return {
        path: [],
        pathString: "",
        message: String(problem),
        expected: void 0,
        actual: void 0
      };
    }
    let path = pathToArray(problem.path);
    let pathString = pathToString(path);
    let actual = problem.actual ?? problem.found;
    let expected = describeExpected(problem.expected);
    let message = conciseMessage(problem.message, actual, problem.expected);
    return {
      path,
      pathString,
      message,
      expected,
      actual
    };
  }
  function problemsToIssues(problems) {
    if (!problems) {
      return [];
    }
    let result = [];
    for (let problem of Array.isArray(problems) ? problems : [problems]) {
      if (!problem) {
        continue;
      }
      if (problem && typeof problem == "object" && problem.problems) {
        let nested = problemsToIssues(problem.problems);
        if (nested.length) {
          result = result.concat(nested);
          continue;
        }
      }
      result.push(issueFromProblem(problem));
    }
    return result;
  }
  function assert(source, test) {
    if (assertEnabled) {
      let problems = fails(source, test);
      if (problems) {
        let assertionIssues = problemsToIssues(problems);
        let formattedIssues = formatIssues(assertionIssues);
        let message = "Assertions failed:\n" + formattedIssues.join("\n");
        console.error("\u{1F170}\uFE0F  " + message);
        throw new Error(message, {
          cause: { problems, issues: assertionIssues, source }
        });
      }
    }
  }
  function Optional(pattern) {
    return function _Optional(data, root, path) {
      if (typeof data != "undefined" && data != null && typeof pattern != "undefined") {
        return fails(data, pattern, root, path);
      }
    };
  }
  function Required(pattern) {
    return function _Required(data, root, path) {
      if (data == null || typeof data == "undefined") {
        return error("data is required", data, pattern || "any value", path);
      } else if (typeof pattern != "undefined") {
        return fails(data, pattern, root, path);
      } else {
        return false;
      }
    };
  }
  function Recommended(pattern) {
    return function _Recommended(data, root, path) {
      if (data == null || typeof data == "undefined") {
        warn("data does not contain recommended value", data, pattern, path);
        return false;
      } else {
        return fails(data, pattern, root, path);
      }
    };
  }
  function oneOf(...patterns) {
    return function _oneOf(data, root, path) {
      for (let pattern of patterns) {
        if (!fails(data, pattern, root, path)) {
          return false;
        }
      }
      return error("data does not match oneOf patterns", data, patterns, path);
    };
  }
  function anyOf(...patterns) {
    return function _anyOf(data, root, path) {
      if (!Array.isArray(data)) {
        return error("data is not an array", data, "anyOf", path);
      }
      for (let [index, value] of data.entries()) {
        let itemPath = appendPath(path, index);
        if (oneOf(...patterns)(value, root, itemPath)) {
          return error("data does not match anyOf patterns", value, patterns, itemPath);
        }
      }
      return false;
    };
  }
  function allOf(...patterns) {
    return function _allOf(data, root, path) {
      let problems = [];
      for (let pattern of patterns) {
        problems = problems.concat(fails(data, pattern, root, path));
      }
      problems = problems.filter(Boolean);
      if (problems.length) {
        return error("data does not match all given patterns", data, patterns, path, problems);
      }
    };
  }
  function validURL(data, root, path) {
    try {
      if (data instanceof URL) {
        data = data.href;
      }
      let url2 = new URL(data);
      if (url2.href != data) {
        if (!(url2.href + "/" == data || url2.href == data + "/")) {
          return error("data is not a valid url", data, "validURL", path);
        }
      }
    } catch (e) {
      return error("data is not a valid url", data, "validURL", path);
    }
  }
  function validEmail(data, root, path) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data)) {
      return error("data is not a valid email", data, "validEmail", path);
    }
  }
  function instanceOf(constructor) {
    return function _instanceOf(data, root, path) {
      if (!(data instanceof constructor)) {
        return error("data is not an instanceof pattern", data, constructor, path);
      }
    };
  }
  function not(pattern) {
    return function _not(data, root, path) {
      if (!fails(data, pattern, root, path)) {
        return error("data matches pattern, when required not to", data, pattern, path);
      }
    };
  }
  function issues(data, pattern, root) {
    let problems = fails(data, pattern, root);
    if (!problems) {
      return false;
    }
    return problemsToIssues(problems);
  }
  function fails(data, pattern, root, path = "") {
    if (typeof root == "undefined") {
      root = data;
    }
    let problems = [];
    if (pattern === Boolean) {
      if (typeof data != "boolean" && !(data instanceof Boolean)) {
        problems.push(error("data is not a boolean", data, pattern, path));
      }
    } else if (pattern === Number) {
      if (typeof data != "number" && !(data instanceof Number)) {
        problems.push(error("data is not a number", data, pattern, path));
      }
    } else if (pattern === String) {
      if (typeof data != "string" && !(data instanceof String)) {
        problems.push(error("data is not a string", data, pattern, path));
      }
      if (data == "") {
        problems.push(error("data is an empty string, which is not allowed", data, pattern, path));
      }
    } else if (pattern instanceof RegExp) {
      if (Array.isArray(data)) {
        let index = data.findIndex((element, index2) => fails(element, pattern, root, appendPath(path, index2)));
        if (index > -1) {
          problems.push(error("data[" + index + "] does not match pattern", data[index], pattern, appendPath(path, index)));
        }
      } else if (typeof data == "undefined") {
        problems.push(error("data is undefined, should match pattern", data, pattern, path));
      } else if (!pattern.test(data)) {
        problems.push(error("data does not match pattern", data, pattern, path));
      }
    } else if (pattern instanceof Function) {
      let problem = pattern(data, root, path);
      if (problem) {
        if (Array.isArray(problem)) {
          problems = problems.concat(problem);
        } else {
          problems.push(problem);
        }
      }
    } else if (Array.isArray(pattern)) {
      if (!Array.isArray(data)) {
        problems.push(error("data is not an array", data, [], path));
      } else {
        for (let p of pattern) {
          for (let index of data.keys()) {
            let problem = fails(data[index], p, root, appendPath(path, index));
            if (Array.isArray(problem)) {
              problems = problems.concat(problem);
            } else if (problem) {
              problems.push(problem);
            }
          }
        }
      }
    } else if (pattern && typeof pattern == "object") {
      if (Array.isArray(data)) {
        let index = data.findIndex((element, index2) => fails(element, pattern, root, appendPath(path, index2)));
        if (index > -1) {
          problems.push(error("data[" + index + "] does not match pattern", data[index], pattern, appendPath(path, index)));
        }
      } else if (!data || typeof data != "object") {
        problems.push(error("data is not an object, pattern is", data, pattern, path));
      } else {
        if (data instanceof URLSearchParams) {
          data = Object.fromEntries(data);
        }
        if (pattern instanceof Function) {
          let result = fails(data, pattern, root, path);
          if (result) {
            problems = problems.concat(result);
          }
        } else {
          for (const [patternKey, subpattern] of Object.entries(pattern)) {
            let result = fails(data[patternKey], subpattern, root, appendPath(path, patternKey));
            if (result) {
              problems = problems.concat(result);
            }
          }
        }
      }
    } else {
      if (pattern != data) {
        problems.push(error("data and pattern are not equal", data, pattern, path));
      }
    }
    if (problems.length) {
      return problems;
    }
    return false;
  }
  function error(message, found, expected, path = "", problems) {
    let pathParts = pathToArray(path);
    let result = {
      path,
      pathString: pathToString(pathParts),
      pathParts,
      message,
      found,
      expected
    };
    if (problems) {
      result.problems = problems;
    }
    return result;
  }
  function warn(message, data, pattern, path) {
    console.warn("\u{1F170}\uFE0F  Assert: " + path, message, pattern, data);
  }

  // ../../node_modules/@muze-nl/assert/src/assert.mjs
  globalThis.assert = { ...assert_core_exports };

  // src/tokenstore.mjs
  function tokenStore(site) {
    let localState, localTokens;
    if (typeof localStorage !== "undefined") {
      localState = {
        get: () => localStorage.getItem("metro/state:" + site),
        set: (value) => localStorage.setItem("metro/state:" + site, value),
        has: () => localStorage.getItem("metro/state:" + site) !== null,
        delete: () => localStorage.removeItem("metro/state:" + site)
      };
      localTokens = {
        get: (name) => JSON.parse(localStorage.getItem(site + ":" + name)),
        set: (name, value) => localStorage.setItem(site + ":" + name, JSON.stringify(value)),
        has: (name) => localStorage.getItem(site + ":" + name) !== null,
        delete: (name) => localStorage.removeItem(site + ":" + name)
      };
    } else {
      let stateMap = /* @__PURE__ */ new Map();
      localState = {
        get: () => stateMap.get("metro/state:" + site),
        set: (value) => stateMap.set("metro/state:" + site, value),
        has: () => stateMap.has("metro/state:" + site),
        delete: () => stateMap.delete("metro/state:" + site)
      };
      localTokens = /* @__PURE__ */ new Map();
    }
    return {
      state: localState,
      tokens: localTokens
    };
  }

  // src/oauth2.mjs
  var SUPPORTED_TOKEN_TYPES = /* @__PURE__ */ new Map([
    ["bearer", "Bearer"],
    ["dpop", "DPoP"]
  ]);
  var SUPPORTED_TOKEN_ENDPOINT_AUTH_METHODS = /* @__PURE__ */ new Set([
    "none",
    "client_secret_post",
    "client_secret_basic"
  ]);
  function oauth2mw(options) {
    const defaultOptions = {
      client: client(),
      force_authorization: false,
      site: "default",
      oauth2_configuration: {
        authorization_endpoint: "/authorize",
        token_endpoint: "/token",
        redirect_uri: globalThis.document?.location.href,
        grant_type: "authorization_code",
        code_verifier: generateCodeVerifier(64)
      },
      authorize_callback: async (url2) => {
        if (window.location.href != url2.href) {
          window.location.replace(url2.href);
        }
        return false;
      }
    };
    assert(options, {});
    const oauth22 = Object.assign({}, defaultOptions.oauth2_configuration, options?.oauth2_configuration);
    options = Object.assign({}, defaultOptions, options);
    options.oauth2_configuration = oauth22;
    const store = tokenStore(options.site);
    if (!options.tokens) {
      options.tokens = store.tokens;
    }
    if (!options.state) {
      options.state = store.state;
    }
    assert(options, {
      oauth2_configuration: {
        client_id: Required(/.+/),
        grant_type: "authorization_code",
        authorization_endpoint: Required(validURL),
        token_endpoint: Required(validURL),
        redirect_uri: Required(validURL)
      }
    });
    for (let option in oauth22) {
      switch (option) {
        case "access_token":
        case "authorization_code":
        case "refresh_token":
          options.tokens.set(option, normalizeInitialToken(option, oauth22[option]));
          break;
      }
    }
    return async function(req, next) {
      if (options.force_authorization) {
        return oauth2authorized(req, next);
      }
      const res = await next(req);
      if (res.ok || !shouldAuthorizeResponse(res)) {
        return res;
      }
      return oauth2authorized(req, next);
    };
    async function oauth2authorized(req, next, retryState = {}) {
      getTokensFromLocation();
      const accessToken = options.tokens.get("access_token");
      const refreshToken = options.tokens.get("refresh_token");
      const tokenIsExpired = isExpired(accessToken);
      if (!accessToken || tokenIsExpired && !refreshToken) {
        const token = await fetchAccessToken();
        if (!token) {
          return response("false");
        }
        return oauth2authorized(req, next);
      } else if (tokenIsExpired && refreshToken) {
        const token = await refreshAccessToken();
        if (!token) {
          return response("false");
        }
        return oauth2authorized(req, next);
      } else {
        const authorizedReq = request(req, {
          headers: {
            Authorization: accessToken.type + " " + accessToken.value
          }
        });
        const res = await next(authorizedReq);
        if (!shouldAuthorizeResponse(res) || retryState.handledRejectedToken) {
          return res;
        }
        options.tokens.delete("access_token");
        const token = refreshToken ? await refreshAccessToken() : await fetchAccessToken();
        if (!token) {
          return response("false");
        }
        return oauth2authorized(req, next, { handledRejectedToken: true });
      }
    }
    function getTokensFromLocation() {
      if (typeof window !== "undefined" && window?.location) {
        let url2 = url(window.location);
        let code, state, params;
        if (url2.searchParams.has("code") || url2.searchParams.has("error")) {
          params = url2.searchParams;
          url2 = url2.with({ search: "" });
          history.pushState({}, "", url2.href);
        } else if (url2.hash) {
          let query = url2.hash.substr(1);
          params = new URLSearchParams("?" + query);
          url2 = url2.with({ hash: "" });
          history.pushState({}, "", url2.href);
        }
        if (params) {
          if (params.has("error")) {
            throw metroError("oauth2mw: authorization failed: " + params.get("error") + (params.get("error_description") ? " (" + params.get("error_description") + ")" : ""));
          }
          code = params.get("code");
          state = params.get("state");
          validateState(state);
          if (code) {
            options.tokens.set("authorization_code", code);
          }
        }
      }
    }
    async function fetchAccessToken() {
      if (oauth22.grant_type === "authorization_code" && !options.tokens.has("authorization_code")) {
        let authReqURL = await getAuthorizationCodeURL();
        if (!options.authorize_callback || typeof options.authorize_callback !== "function") {
          throw metroError("oauth2mw: oauth2 with grant_type:authorization_code requires a callback function in client options.authorize_callback");
        }
        let authorization = await options.authorize_callback(authReqURL);
        if (authorization) {
          storeAuthorizationResult(authorization);
        } else {
          return false;
        }
      }
      let tokenReq = getAccessTokenRequest();
      let response2 = await options.client.post(tokenReq);
      if (!response2.ok) {
        let msg = await response2.text();
        throw metroError("OAuth2mw: fetch access_token: " + response2.status + ": " + response2.statusText + " (" + msg + ")", { cause: tokenReq });
      }
      let data = await response2.json();
      storeTokenResponse(data);
      options.tokens.delete("authorization_code");
      return data;
    }
    async function refreshAccessToken() {
      let refreshTokenReq = getAccessTokenRequest("refresh_token");
      let response2 = await options.client.post(refreshTokenReq);
      if (!response2.ok) {
        let msg = await response2.text();
        throw metroError("OAuth2mw: refresh access_token: " + response2.status + ": " + response2.statusText + " (" + msg + ")", { cause: refreshTokenReq });
      }
      let data = await response2.json();
      storeTokenResponse(data);
      return data;
    }
    async function getAuthorizationCodeURL() {
      if (!oauth22.authorization_endpoint) {
        throw metroError("oauth2mw: Missing options.oauth2_configuration.authorization_endpoint");
      }
      let url2 = url(oauth22.authorization_endpoint, { hash: "" });
      assert(oauth22, {
        client_id: /.+/,
        redirect_uri: /.+/,
        scope: /.*/
      });
      let search = {
        response_type: "code",
        client_id: oauth22.client_id,
        redirect_uri: oauth22.redirect_uri,
        state: oauth22.state || createState(40)
      };
      if (oauth22.response_type) {
        search.response_type = oauth22.response_type;
      }
      if (oauth22.response_mode) {
        search.response_mode = oauth22.response_mode;
      }
      options.state.set(search.state);
      if (oauth22.code_verifier) {
        options.tokens.set("code_verifier", oauth22.code_verifier);
        search.code_challenge = await generateCodeChallenge(oauth22.code_verifier);
        search.code_challenge_method = "S256";
      }
      if (oauth22.scope) {
        search.scope = oauth22.scope;
      }
      if (oauth22.prompt) {
        search.prompt = oauth22.prompt;
      }
      if (oauth22.nonce) {
        search.nonce = oauth22.nonce;
      }
      return url(url2, { search });
    }
    function getAccessTokenRequest(grant_type = null) {
      assert(oauth22, {
        client_id: /.+/,
        redirect_uri: /.+/
      });
      if (!oauth22.token_endpoint) {
        throw metroError("oauth2mw: Missing options.endpoints.token url");
      }
      let url2 = url(oauth22.token_endpoint, { hash: "" });
      let params = {
        grant_type: grant_type || oauth22.grant_type
      };
      let headers = {};
      applyTokenEndpointAuthentication(params, headers);
      if (oauth22.scope) {
        params.scope = oauth22.scope;
      }
      switch (params.grant_type) {
        case "authorization_code":
          params.redirect_uri = oauth22.redirect_uri;
          params.code = options.tokens.get("authorization_code");
          const code_verifier = options.tokens.get("code_verifier");
          if (code_verifier) {
            params.code_verifier = code_verifier;
          }
          break;
        case "client_credentials":
          break;
        case "refresh_token":
          params.refresh_token = tokenValue(options.tokens.get("refresh_token"));
          break;
        default:
          throw new Error("Unknown grant_type: " + params.grant_type);
          break;
      }
      return request(url2, { method: "POST", headers, body: new URLSearchParams(params) });
    }
    function applyTokenEndpointAuthentication(params, headers) {
      const method = tokenEndpointAuthMethod(oauth22);
      if (method === "none") {
        params.client_id = oauth22.client_id;
        return;
      }
      if (!oauth22.client_secret) {
        throw metroError("oauth2mw: token_endpoint_auth_method " + method + " requires oauth2_configuration.client_secret");
      }
      if (method === "client_secret_post") {
        params.client_id = oauth22.client_id;
        params.client_secret = oauth22.client_secret;
        return;
      }
      if (method === "client_secret_basic") {
        headers.Authorization = basicAuth(oauth22.client_id, oauth22.client_secret);
        return;
      }
    }
    function storeAuthorizationResult(authorization) {
      let code = authorization;
      if (authorization && typeof authorization === "object") {
        if (authorization.error) {
          throw metroError("oauth2mw: authorization failed: " + authorization.error);
        }
        validateState(authorization.state);
        code = authorization.authorization_code || authorization.code;
      }
      if (!code) {
        throw metroError("oauth2mw: authorization callback did not return an authorization code");
      }
      options.tokens.set("authorization_code", code);
    }
    function validateState(state) {
      let storedState = options.state.get();
      if (!state || state !== storedState) {
        throw metroError("oauth2mw: authorization state mismatch");
      }
    }
    function storeTokenResponse(data) {
      const token = validateTokenResponse(data);
      options.tokens.set("access_token", token);
      if (data.refresh_token) {
        options.tokens.set("refresh_token", { value: data.refresh_token });
      }
    }
  }
  function shouldAuthorizeResponse(res) {
    if (!res) {
      return false;
    }
    if (res.status === 400) {
      return true;
    }
    const challenge = parseBearerChallenge(res.headers?.get("WWW-Authenticate"));
    if (challenge?.error === "insufficient_scope") {
      return false;
    }
    return res.status === 401;
  }
  function normalizeInitialToken(name, token) {
    if (name === "access_token" && token && typeof token === "object") {
      return token;
    }
    if (name === "access_token") {
      return { value: token, type: "Bearer", expires: null };
    }
    if (name === "refresh_token" && token && typeof token === "object") {
      return token;
    }
    return token;
  }
  function validateTokenResponse(data) {
    if (!data || typeof data !== "object") {
      throw metroError("OAuth2mw: token endpoint did not return a JSON object");
    }
    if (!data.access_token) {
      throw metroError("OAuth2mw: token response did not include access_token");
    }
    if (!data.token_type) {
      throw metroError("OAuth2mw: token response did not include token_type");
    }
    const tokenType = normalizeTokenType(data.token_type);
    return {
      value: data.access_token,
      expires: data.expires_in === void 0 ? null : getExpires(data.expires_in),
      type: tokenType,
      scope: data.scope
    };
  }
  function normalizeTokenType(type) {
    const normalized = SUPPORTED_TOKEN_TYPES.get(String(type).toLowerCase());
    if (!normalized) {
      throw metroError("OAuth2mw: unsupported token_type " + type);
    }
    return normalized;
  }
  function tokenEndpointAuthMethod(oauth22) {
    const method = oauth22.token_endpoint_auth_method || (oauth22.client_secret ? "client_secret_post" : "none");
    if (!SUPPORTED_TOKEN_ENDPOINT_AUTH_METHODS.has(method)) {
      throw metroError("oauth2mw: unsupported token_endpoint_auth_method " + method);
    }
    return method;
  }
  function basicAuth(clientId, clientSecret) {
    const value = formEncode(clientId) + ":" + formEncode(clientSecret);
    return "Basic " + base64_encode(value);
  }
  function formEncode(value) {
    return encodeURIComponent(value).replace(/%20/g, "+");
  }
  function base64_encode(value) {
    if (typeof btoa === "function") {
      return btoa(value);
    }
    return Buffer.from(value, "binary").toString("base64");
  }
  function tokenValue(token) {
    return token && typeof token === "object" ? token.value : token;
  }
  function isExpired(token) {
    if (!token) {
      return true;
    }
    if (!token.expires) {
      return false;
    }
    let expires = new Date(token.expires);
    let now = /* @__PURE__ */ new Date();
    return now.getTime() > expires.getTime();
  }
  function getExpires(duration) {
    if (duration instanceof Date) {
      return new Date(duration.getTime());
    }
    if (typeof duration === "number") {
      let date = /* @__PURE__ */ new Date();
      date.setSeconds(date.getSeconds() + duration);
      return date;
    }
    throw new TypeError("Unknown expires type " + duration);
  }
  function generateCodeVerifier(size = 64) {
    const code_verifier = new Uint8Array(size);
    globalThis.crypto.getRandomValues(code_verifier);
    return base64url_encode(code_verifier);
  }
  async function generateCodeChallenge(code_verifier) {
    const encoder2 = new TextEncoder();
    const data = encoder2.encode(code_verifier);
    const challenge = await globalThis.crypto.subtle.digest("SHA-256", data);
    return base64url_encode(challenge);
  }
  function base64url_encode(buffer) {
    const byteString = Array.from(new Uint8Array(buffer), (b) => String.fromCharCode(b)).join("");
    return btoa(byteString).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function createState(length) {
    const bytes = new Uint8Array(Math.ceil(length * 3 / 4) + 1);
    if (globalThis.crypto?.getRandomValues) {
      globalThis.crypto.getRandomValues(bytes);
      return base64url_encode(bytes).slice(0, length);
    }
    const validChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let randomState = "";
    let counter = 0;
    while (counter < length) {
      randomState += validChars.charAt(Math.floor(Math.random() * validChars.length));
      counter++;
    }
    return randomState;
  }
  function isRedirected() {
    let url2 = new URL(document.location.href);
    if (!url2.searchParams.has("code")) {
      if (url2.hash) {
        let query = url2.hash.substr(1);
        const params = new URLSearchParams("?" + query);
        if (params.has("code")) {
          return true;
        }
      }
      return false;
    }
    return true;
  }
  function isAuthorized(tokens) {
    if (typeof tokens == "string") {
      tokens = tokenStore(tokens).tokens;
    }
    let accessToken = tokens.get("access_token");
    if (accessToken && !isExpired(accessToken)) {
      return true;
    }
    let refreshToken = tokens.get("refresh_token");
    if (refreshToken) {
      return true;
    }
    return false;
  }
  function parseBearerChallenge(value) {
    if (!value || typeof value !== "string") {
      return null;
    }
    const trimmed = value.trim();
    const index = trimmed.search(/\s/);
    const scheme = index < 0 ? trimmed : trimmed.slice(0, index);
    const rest = index < 0 ? "" : trimmed.slice(index + 1);
    if (!["bearer", "dpop"].includes(scheme.toLowerCase())) {
      return null;
    }
    const result = { scheme };
    const pattern = /([A-Za-z][A-Za-z0-9_-]*)=("(?:[^"\\]|\\.)*"|[^,\s]*)/g;
    let match;
    while (match = pattern.exec(rest)) {
      let value2 = match[2];
      if (value2.startsWith('"') && value2.endsWith('"')) {
        value2 = value2.slice(1, -1).replace(/\\"/g, '"');
      }
      result[match[1]] = value2;
    }
    return result;
  }

  // src/oauth2.discovery.mjs
  var oauth2_discovery_exports = {};
  __export(oauth2_discovery_exports, {
    default: () => makeClient
  });
  var validAlgorithms = [
    "HS256",
    "HS384",
    "HS512",
    "RS256",
    "RS384",
    "RS512",
    "ES256",
    "ES384",
    "ES512"
  ];
  var validAuthMethods = [
    "client_secret_post",
    "client_secret_base",
    "client_secret_jwt",
    "private_key_jwt"
  ];
  var oauth_authorization_server_metadata = {
    authorization_endpoint: Required(validURL),
    issuer: Required(validURL),
    response_types_supported: Required(anyOf("code", "token")),
    token_endpoint: Required(validURL),
    scopes_supported: Recommended([]),
    code_challendge_methods_supported: Optional([]),
    grant_types_supported: Optional([]),
    introspection_endpoint: Optional(validURL),
    introspection_endpoint_auth_methods_supported: Optional(validAuthMethods),
    introspection_endpoint_auth_signing_alg_values_supported: Optional(validAlgorithms),
    jwks_uri: Optional(validURL),
    op_policy_uri: Optional(validURL),
    op_tos_uri: Optional(validURL),
    registration_endpoint: Optional(validURL),
    response_modes_supported: Optional([]),
    revocation_endpoint: Optional(validURL),
    revocation_endpoint_auth_methods_supported: Optional(validAuthMethods),
    revocation_endpoint_auth_signing_alg_values_supported: Optional(validAlgorithms),
    service_documentation: Optional(validURL),
    token_endpoint_auth_methods_supported: Optional([]),
    token_endpoint_auth_signing_alg_values_supported: Optional([]),
    ui_locales_supported: Optional([])
  };
  function makeClient(options = {}) {
    const defaultOptions = {
      client: client()
    };
    options = Object.assign({}, defaultOptions, options);
    assert(options, {
      issuer: Required(validURL)
    });
    const oauth_authorization_server_configuration = fetchWellknownOauthAuthorizationServer(options.issuer);
    return options.client.with(options.issuer);
  }
  async function fetchWellknownOauthAuthorizationServer(issuer, client2) {
    let res = client2.get(url(issuer, ".wellknown/oauth_authorization_server"));
    if (!res.ok) {
      throw metroError("metro.oidcmw: Error while fetching " + issuer + ".wellknown/oauth_authorization_server", res);
    }
    assert(res.headers.get("Content-Type"), /application\/json.*/);
    let configuration = await res.json();
    assert(configuration, oauth_authorization_server_metadata);
    return configuration;
  }

  // src/oauth2.popup.mjs
  function handleRedirect(origin = null) {
    let success = false;
    origin = origin || window.location.origin;
    let params = new URLSearchParams(window.location.search);
    if (!params.has("code") && !params.has("error") && window.location.hash) {
      let query = window.location.hash.substring(1);
      params = new URLSearchParams("?" + query);
    }
    let parent = window.parent !== window ? window.parent : window.opener;
    if (!parent) {
      console.error("No parent window found, cannot post authorization code (or error)");
    } else {
      let message;
      if (params.has("code")) {
        success = true;
        message = {
          authorization_code: params.get("code"),
          state: params.get("state")
        };
      } else if (params.has("error")) {
        message = {
          error: params.get("error"),
          error_description: params.get("error_description"),
          state: params.get("state")
        };
      } else {
        message = { error: "Could not find an authorization_code" };
      }
      parent.postMessage(message, origin);
    }
    return success;
  }
  function authorizePopup(authorizationCodeURL, options = {}) {
    const url2 = new URL(authorizationCodeURL, window.location.href);
    const expectedState = url2.searchParams.get("state");
    const redirectUri = url2.searchParams.get("redirect_uri");
    const expectedOrigin = redirectUri ? new URL(redirectUri, window.location.href).origin : window.location.origin;
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        if (typeof removeEventListener === "function") {
          removeEventListener("message", handler);
        }
      };
      const handler = (event) => {
        if (event.origin && event.origin !== expectedOrigin) {
          return;
        }
        if (event.data.authorization_code) {
          if (expectedState && event.data.state !== expectedState) {
            cleanup();
            reject("OAuth2 authorization state mismatch");
            return;
          }
          cleanup();
          resolve(event.data.authorization_code);
        } else if (event.data.error) {
          if (expectedState && event.data.state && event.data.state !== expectedState) {
            cleanup();
            reject("OAuth2 authorization state mismatch");
            return;
          }
          cleanup();
          reject(event.data.error_description || event.data.error);
        } else {
          cleanup();
          reject("Unknown authorization error");
        }
      };
      addEventListener("message", handler);
      const popup = options.popup || window.open(authorizationCodeURL);
      if (!popup || popup.closed) {
        cleanup();
        reject("OAuth2 popup was blocked");
        return;
      }
      if (options.popup) {
        popup.location.href = authorizationCodeURL;
      }
    });
  }

  // src/keysstore.mjs
  function keysStore() {
    return new Promise((resolve, reject) => {
      const request2 = globalThis.indexedDB.open("metro", 1);
      request2.onupgradeneeded = () => request2.result.createObjectStore("keyPairs", { keyPath: "domain" });
      request2.onerror = (event) => {
        reject(event);
      };
      request2.onsuccess = (event) => {
        const db = event.target.result;
        resolve({
          set: function(value, key) {
            return new Promise((resolve2, reject2) => {
              const tx = db.transaction("keyPairs", "readwrite", { durability: "strict" });
              const objectStore = tx.objectStore("keyPairs");
              tx.oncomplete = () => {
                resolve2();
              };
              tx.onerror = reject2;
              objectStore.put(value, key);
            });
          },
          get: function(key) {
            return new Promise((resolve2, reject2) => {
              const tx = db.transaction("keyPairs", "readonly");
              const objectStore = tx.objectStore("keyPairs");
              const request3 = objectStore.get(key);
              request3.onsuccess = () => {
                resolve2(request3.result);
              };
              request3.onerror = reject2;
              tx.onerror = reject2;
            });
          },
          clear: function() {
            return new Promise((resolve2, reject2) => {
              const tx = db.transaction("keyPairs", "readwrite");
              const objectStore = tx.objectStore("keyPairs");
              const request3 = objectStore.clear();
              request3.onsuccess = () => {
                resolve2();
              };
              request3.onerror = reject2;
              tx.onerror = reject2;
            });
          }
        });
      };
    });
  }

  // ../../node_modules/dpop/build/index.js
  var encoder = new TextEncoder();
  var decoder = new TextDecoder();
  function buf(input) {
    if (typeof input === "string") {
      return encoder.encode(input);
    }
    return decoder.decode(input);
  }
  function checkRsaKeyAlgorithm(algorithm) {
    if (typeof algorithm.modulusLength !== "number" || algorithm.modulusLength < 2048) {
      throw new OperationProcessingError(`${algorithm.name} modulusLength must be at least 2048 bits`);
    }
  }
  function subtleAlgorithm(key) {
    switch (key.algorithm.name) {
      case "ECDSA":
        return { name: key.algorithm.name, hash: "SHA-256" };
      case "RSA-PSS":
        checkRsaKeyAlgorithm(key.algorithm);
        return {
          name: key.algorithm.name,
          saltLength: 256 >> 3
        };
      case "RSASSA-PKCS1-v1_5":
        checkRsaKeyAlgorithm(key.algorithm);
        return { name: key.algorithm.name };
      case "Ed25519":
        return { name: key.algorithm.name };
    }
    throw new UnsupportedOperationError();
  }
  async function jwt(header, claimsSet, key) {
    if (key.usages.includes("sign") === false) {
      throw new TypeError('private CryptoKey instances used for signing assertions must include "sign" in their "usages"');
    }
    const input = `${b64u(buf(JSON.stringify(header)))}.${b64u(buf(JSON.stringify(claimsSet)))}`;
    const signature = b64u(await crypto.subtle.sign(subtleAlgorithm(key), key, buf(input)));
    return `${input}.${signature}`;
  }
  var encodeBase64Url;
  if (Uint8Array.prototype.toBase64) {
    encodeBase64Url = (input) => {
      if (input instanceof ArrayBuffer) {
        input = new Uint8Array(input);
      }
      return input.toBase64({ alphabet: "base64url", omitPadding: true });
    };
  } else {
    const CHUNK_SIZE = 32768;
    encodeBase64Url = (input) => {
      if (input instanceof ArrayBuffer) {
        input = new Uint8Array(input);
      }
      const arr = [];
      for (let i = 0; i < input.byteLength; i += CHUNK_SIZE) {
        arr.push(String.fromCharCode.apply(null, input.subarray(i, i + CHUNK_SIZE)));
      }
      return btoa(arr.join("")).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
    };
  }
  function b64u(input) {
    return encodeBase64Url(input);
  }
  var UnsupportedOperationError = class extends Error {
    constructor(message) {
      var _a;
      super(message !== null && message !== void 0 ? message : "operation not supported");
      this.name = this.constructor.name;
      (_a = Error.captureStackTrace) === null || _a === void 0 ? void 0 : _a.call(Error, this, this.constructor);
    }
  };
  var OperationProcessingError = class extends Error {
    constructor(message) {
      var _a;
      super(message);
      this.name = this.constructor.name;
      (_a = Error.captureStackTrace) === null || _a === void 0 ? void 0 : _a.call(Error, this, this.constructor);
    }
  };
  function psAlg(key) {
    switch (key.algorithm.hash.name) {
      case "SHA-256":
        return "PS256";
      default:
        throw new UnsupportedOperationError("unsupported RsaHashedKeyAlgorithm hash name");
    }
  }
  function rsAlg(key) {
    switch (key.algorithm.hash.name) {
      case "SHA-256":
        return "RS256";
      default:
        throw new UnsupportedOperationError("unsupported RsaHashedKeyAlgorithm hash name");
    }
  }
  function esAlg(key) {
    switch (key.algorithm.namedCurve) {
      case "P-256":
        return "ES256";
      default:
        throw new UnsupportedOperationError("unsupported EcKeyAlgorithm namedCurve");
    }
  }
  function determineJWSAlgorithm(key) {
    switch (key.algorithm.name) {
      case "RSA-PSS":
        return psAlg(key);
      case "RSASSA-PKCS1-v1_5":
        return rsAlg(key);
      case "ECDSA":
        return esAlg(key);
      case "Ed25519":
        return "Ed25519";
      default:
        throw new UnsupportedOperationError("unsupported CryptoKey algorithm name");
    }
  }
  function isCryptoKey(key) {
    return key instanceof CryptoKey;
  }
  function isPrivateKey(key) {
    return isCryptoKey(key) && key.type === "private";
  }
  function isPublicKey(key) {
    return isCryptoKey(key) && key.type === "public";
  }
  function epochTime() {
    return Math.floor(Date.now() / 1e3);
  }
  async function generateProof(keypair, htu, htm, nonce, accessToken, additional) {
    const privateKey = keypair === null || keypair === void 0 ? void 0 : keypair.privateKey;
    const publicKey = keypair === null || keypair === void 0 ? void 0 : keypair.publicKey;
    if (!isPrivateKey(privateKey)) {
      throw new TypeError('"keypair.privateKey" must be a private CryptoKey');
    }
    if (!isPublicKey(publicKey)) {
      throw new TypeError('"keypair.publicKey" must be a public CryptoKey');
    }
    if (publicKey.extractable !== true) {
      throw new TypeError('"keypair.publicKey.extractable" must be true');
    }
    if (typeof htu !== "string") {
      throw new TypeError('"htu" must be a string');
    }
    if (typeof htm !== "string") {
      throw new TypeError('"htm" must be a string');
    }
    if (nonce !== void 0 && typeof nonce !== "string") {
      throw new TypeError('"nonce" must be a string or undefined');
    }
    if (accessToken !== void 0 && typeof accessToken !== "string") {
      throw new TypeError('"accessToken" must be a string or undefined');
    }
    if (additional !== void 0 && (typeof additional !== "object" || additional === null || Array.isArray(additional))) {
      throw new TypeError('"additional" must be an object');
    }
    return jwt({
      alg: determineJWSAlgorithm(privateKey),
      typ: "dpop+jwt",
      jwk: await publicJwk(publicKey)
    }, Object.assign(Object.assign({}, additional), {
      iat: epochTime(),
      jti: crypto.randomUUID(),
      htm,
      nonce,
      htu,
      ath: accessToken ? b64u(await crypto.subtle.digest("SHA-256", buf(accessToken))) : void 0
    }), privateKey);
  }
  async function publicJwk(key) {
    const { kty, e, n, x, y, crv } = await crypto.subtle.exportKey("jwk", key);
    return { kty, crv, e, n, x, y };
  }
  async function generateKeyPair(alg, options) {
    var _a;
    let algorithm;
    if (typeof alg !== "string" || alg.length === 0) {
      throw new TypeError('"alg" must be a non-empty string');
    }
    switch (alg) {
      case "PS256":
        algorithm = {
          name: "RSA-PSS",
          hash: "SHA-256",
          modulusLength: 2048,
          publicExponent: new Uint8Array([1, 0, 1])
        };
        break;
      case "RS256":
        algorithm = {
          name: "RSASSA-PKCS1-v1_5",
          hash: "SHA-256",
          modulusLength: 2048,
          publicExponent: new Uint8Array([1, 0, 1])
        };
        break;
      case "ES256":
        algorithm = { name: "ECDSA", namedCurve: "P-256" };
        break;
      case "Ed25519":
        algorithm = { name: "Ed25519" };
        break;
      default:
        throw new UnsupportedOperationError();
    }
    return crypto.subtle.generateKey(algorithm, (_a = options === null || options === void 0 ? void 0 : options.extractable) !== null && _a !== void 0 ? _a : false, ["sign", "verify"]);
  }

  // src/oauth2.dpop.mjs
  function dpopmw(options) {
    assert(options, {
      site: Required(validURL),
      authorization_endpoint: Required(validURL),
      token_endpoint: Required(validURL),
      dpop_signing_alg_values_supported: Optional([])
      // this property is unfortunately rarely supported
    });
    return async (req, next) => {
      const keys = await keysStore();
      let keyInfo = await keys.get(options.site);
      if (!keyInfo) {
        let keyPair = await generateKeyPair("ES256");
        keyInfo = { domain: options.site, keyPair };
        await keys.set(keyInfo);
      }
      const url2 = url(req.url);
      if (req.url.startsWith(options.authorization_endpoint)) {
        let params = req.body;
        if (params instanceof URLSearchParams || params instanceof FormData) {
          params.set("dpop_jkt", keyInfo.keyPair.publicKey);
        } else {
          params.dpop_jkt = keyInfo.keyPair.publicKey;
        }
      } else if (req.url.startsWith(options.token_endpoint)) {
        const dpopHeader = await generateProof(keyInfo.keyPair, req.url, req.method);
        req = req.with({
          headers: {
            "DPoP": dpopHeader
          }
        });
      } else if (req.headers.has("Authorization")) {
        const nonce = localStorage.getItem(url2.host + ":nonce") || void 0;
        const accessToken = req.headers.get("Authorization").split(" ")[1];
        const dpopHeader = await generateProof(keyInfo.keyPair, req.url, req.method, nonce, accessToken);
        req = req.with({
          headers: {
            "Authorization": "DPoP " + accessToken,
            "DPoP": dpopHeader
          }
        });
      }
      let response2 = await next(req);
      if (response2.headers.get("DPoP-Nonce")) {
        localStorage.setItem(url2.host + ":nonce", response2.headers.get("DPoP-Nonce"));
      }
      return response2;
    };
  }

  // src/index.mjs
  var oauth2 = Object.assign({}, oauth2_exports, {
    oauth2mw,
    discover: oauth2_discovery_exports,
    tokenstore: tokenStore,
    dpopmw,
    keysstore: keysStore,
    authorizePopup,
    popupHandleRedirect: handleRedirect
  });
  var index_default = oauth2;

  // src/browser.mjs
  var metro = Object.assign({}, src_exports, globalThis.metro || {});
  if (!metro.oauth2) {
    metro.oauth2 = index_default;
  }
  globalThis.metro = metro;
  var browser_default = index_default;
})();
//# sourceMappingURL=browser.js.map
