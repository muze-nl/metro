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
            } catch (error) {
              callTracers(tracers, "error", error, req2, middleware2, traceContext);
              throw error;
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
    const api2 = {
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
        return Object.assign({}, extra, { trace: api2 });
      }
    };
    return api2;
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

  // ../metro-middleware/src/json.mjs
  function jsonmw(options) {
    options = Object.assign({
      contentType: "application/json",
      reviver: null,
      replacer: null,
      space: ""
    }, options);
    return async function json(req, next) {
      if (!req.headers.get("Accept")) {
        req = req.with({
          headers: {
            "Accept": options.accept ?? options.contentType
          }
        });
      }
      if (req.method !== "GET" && req.method !== "HEAD") {
        if (req.data && typeof req.data == "object" && !(req.data instanceof ReadableStream)) {
          const contentType = req.headers.get("Content-Type");
          if (!contentType || isPlainText(contentType)) {
            req = req.with({
              headers: {
                "Content-Type": options.contentType
              }
            });
          }
          if (isJSON(req.headers.get("Content-Type"))) {
            req = req.with({
              body: JSON.stringify(req.data, options.replacer, options.space)
            });
          }
        }
      }
      let res = await next(req);
      if (res && isJSON(res.headers?.get("Content-Type"))) {
        let tempRes = res.clone();
        let body = await tempRes.text();
        try {
          let json2 = JSON.parse(body, options.reviver);
          return res.with({
            body: json2
          });
        } catch (e) {
        }
      }
      return res;
    };
  }
  var jsonRE = /^application\/([a-zA-Z0-9\-_]+\+)?json\b/;
  function isJSON(contentType) {
    return jsonRE.exec(contentType);
  }
  function isPlainText(contentType) {
    return /^text\/plain\b/.exec(contentType);
  }

  // ../metro-middleware/src/thrower.mjs
  function throwermw(options) {
    return async function thrower(req, next) {
      let res = await next(req);
      if (!res.ok) {
        if (options && typeof options[res.status] == "function") {
          res = options[res.status].apply(res, req);
        } else {
          throw new Error(res.status + ": " + res.statusText, {
            cause: res
          });
        }
      }
      return res;
    };
  }

  // ../metro-middleware/src/getdata.mjs
  function getdatamw() {
    return async function getdata(req, next) {
      let res = await next(req);
      if (res.ok && res.data) {
        return res.data;
      }
      return res;
    };
  }

  // ../metro-middleware/src/_trace.mjs
  function traceEvent(name, data = {}, context = null) {
    for (const tracer of tracersFor(context)) {
      if (tracer && typeof tracer.event == "function") {
        tracer.event.call(tracer, name, data, context);
      }
    }
  }
  function traceDiagnostic(diagnostic = {}, context = null) {
    for (const tracer of tracersFor(context)) {
      if (tracer && typeof tracer.diagnostic == "function") {
        tracer.diagnostic.call(tracer, diagnostic, context);
      }
    }
  }
  function tracersFor(context) {
    return context?.tracers || Object.values(Client.tracers || {});
  }

  // ../metro-middleware/src/backoff.mjs
  var DEFAULT_BACKOFF_STATUSES = [429, 503];
  function backoffmw(options = {}) {
    options = Object.assign({
      name: "backoff",
      store: memoryBackoffStore(),
      scope: "origin",
      statuses: DEFAULT_BACKOFF_STATUSES,
      maxDelay: 6e4,
      sleep,
      now: () => Date.now()
    }, options);
    async function backoff(req, next, context) {
      const key = backoffKey(req, options);
      const until = options.store.get(key) || 0;
      const wait = Math.max(0, until - options.now());
      if (wait > 0) {
        traceEvent("server backoff wait", {
          severity: "warning",
          label: formatDelay(wait),
          method: req.method,
          url: req.url,
          wait,
          key
        }, context);
        await options.sleep(wait, req.signal);
      }
      const res = await next(req);
      const delay = responseBackoffDelay(res, options);
      if (delay > 0) {
        options.store.set(key, options.now() + delay);
        traceEvent("server requested backoff", {
          severity: res.status >= 400 ? "warning" : "info",
          label: formatDelay(delay),
          method: req.method,
          url: req.url,
          status: res.status,
          delay,
          key
        }, context);
        traceDiagnostic({
          severity: res.status >= 400 ? "warning" : "info",
          code: "server-backoff",
          message: `Server asked Metro to back off ${formatDelay(delay)}`,
          data: {
            method: req.method,
            url: req.url,
            status: res.status,
            delay,
            key
          }
        }, context);
      }
      return res;
    }
    backoff.traceName = options.name;
    return backoff;
  }
  function responseBackoffDelay(res, options = {}) {
    options = Object.assign({
      statuses: DEFAULT_BACKOFF_STATUSES,
      maxDelay: 6e4
    }, options);
    if (!res?.headers) {
      return 0;
    }
    const retryAfter = parseRetryAfter(res.headers.get("Retry-After"));
    if (retryAfter > 0 && statusAllowsBackoff(res.status, options)) {
      return capDelay(retryAfter, options.maxDelay);
    }
    const rateLimitReset = parseRateLimitReset(res.headers.get("RateLimit-Reset"));
    const rateLimitRemaining = parseNumberHeader(res.headers.get("RateLimit-Remaining"));
    if (rateLimitReset > 0 && rateLimitRemaining === 0) {
      return capDelay(rateLimitReset, options.maxDelay);
    }
    const combinedRateLimit = parseCombinedRateLimit(res.headers.get("RateLimit"));
    if (combinedRateLimit.delay > 0 && combinedRateLimit.remaining === 0) {
      return capDelay(combinedRateLimit.delay, options.maxDelay);
    }
    return 0;
  }
  function parseRetryAfter(value, now2 = Date.now()) {
    if (!value) {
      return 0;
    }
    value = String(value).trim();
    if (/^\d+$/.test(value)) {
      return parseInt(value, 10) * 1e3;
    }
    const date = Date.parse(value);
    if (!Number.isNaN(date)) {
      return Math.max(0, date - now2);
    }
    return 0;
  }
  function parseRateLimitReset(value) {
    if (!value) {
      return 0;
    }
    const match = String(value).trim().match(/^\d+(?:\.\d+)?/);
    if (!match) {
      return 0;
    }
    return Math.ceil(parseFloat(match[0]) * 1e3);
  }
  function parseCombinedRateLimit(value) {
    const result = { remaining: null, delay: 0 };
    if (!value) {
      return result;
    }
    for (const part of String(value).split(/[;,]/)) {
      const [rawName, rawValue] = part.split("=").map((item) => item?.trim());
      const name = rawName?.toLowerCase();
      const value2 = rawValue?.replace(/^"|"$/g, "");
      if (name == "r") {
        result.remaining = parseNumberHeader(value2);
      } else if (name == "t") {
        result.delay = parseRateLimitReset(value2);
      }
    }
    return result;
  }
  function memoryBackoffStore() {
    const values = /* @__PURE__ */ new Map();
    return {
      get(key) {
        return values.get(key) || 0;
      },
      set(key, until) {
        values.set(key, until);
      },
      clear(key = null) {
        if (key == null) {
          values.clear();
        } else {
          values.delete(key);
        }
      }
    };
  }
  function localStorageBackoffStore(options = {}) {
    const storage = options.storage || safeLocalStorage();
    if (!storage) {
      return memoryBackoffStore();
    }
    const prefix = options.prefix || "metro:backoff:";
    return {
      get(key) {
        const until = parseInt(storage.getItem(prefix + key), 10);
        return Number.isNaN(until) ? 0 : until;
      },
      set(key, until) {
        storage.setItem(prefix + key, String(until));
      },
      clear(key = null) {
        if (key != null) {
          storage.removeItem(prefix + key);
          return;
        }
        const keys = [];
        for (let index = 0; index < storage.length; index++) {
          const name = storage.key(index);
          if (name?.startsWith(prefix)) {
            keys.push(name);
          }
        }
        for (const name of keys) {
          storage.removeItem(name);
        }
      }
    };
  }
  function sleep(ms, signal) {
    if (!ms || ms <= 0) {
      return Promise.resolve();
    }
    if (signal?.aborted) {
      return Promise.reject(signal.reason || new Error("Request was aborted"));
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(done, ms);
      function done() {
        cleanup();
        resolve();
      }
      function abort() {
        cleanup();
        reject(signal.reason || new Error("Request was aborted"));
      }
      function cleanup() {
        clearTimeout(timer);
        signal?.removeEventListener?.("abort", abort);
      }
      signal?.addEventListener?.("abort", abort, { once: true });
    });
  }
  function statusAllowsBackoff(status2, options) {
    return options.statuses == "*" || options.statuses.includes(status2);
  }
  function capDelay(delay, maxDelay) {
    if (!maxDelay || maxDelay < 0) {
      return delay;
    }
    return Math.min(delay, maxDelay);
  }
  function parseNumberHeader(value) {
    if (value == null) {
      return null;
    }
    const match = String(value).trim().match(/^\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : null;
  }
  function backoffKey(req, options) {
    if (typeof options.scope == "function") {
      return options.scope(req);
    }
    const url2 = new URL(req.url);
    if (options.scope == "url") {
      return url2.href;
    }
    if (options.scope == "path") {
      return `${url2.origin}${url2.pathname}`;
    }
    return url2.origin;
  }
  function formatDelay(delay) {
    return delay < 1e3 ? `${Math.round(delay)}ms` : `${(delay / 1e3).toFixed(delay < 1e4 ? 1 : 0)}s`;
  }
  function safeLocalStorage() {
    try {
      return typeof localStorage != "undefined" ? localStorage : null;
    } catch (e) {
      return null;
    }
  }
  backoffmw.memoryStore = memoryBackoffStore;
  backoffmw.localStorageStore = localStorageBackoffStore;
  backoffmw.parseRetryAfter = parseRetryAfter;
  backoffmw.responseDelay = responseBackoffDelay;

  // ../metro-middleware/src/retry.mjs
  var DEFAULT_RETRY_STATUS = [408, 425, 429, 500, 502, 503, 504];
  var DEFAULT_RETRY_METHODS = ["GET", "HEAD", "OPTIONS"];
  function retrymw(options = {}) {
    if (typeof options == "number") {
      options = { attempts: options };
    }
    options = Object.assign({
      name: "retry",
      attempts: 3,
      delay: 250,
      factor: 2,
      maxDelay: 3e4,
      jitter: true,
      methods: DEFAULT_RETRY_METHODS,
      status: DEFAULT_RETRY_STATUS,
      respectRetryAfter: true,
      respectRateLimit: true,
      sleep,
      random: Math.random
    }, options);
    async function retry(req, next, context) {
      const attempts = attemptsFor(options.attempts, req);
      if (attempts <= 1 || !methodCanRetry(req, options)) {
        return next(req);
      }
      let lastError = null;
      for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
          if (attempt > 1) {
            traceEvent("retry attempt", {
              severity: "info",
              label: `${attempt}/${attempts}`,
              attempt,
              attempts,
              method: req.method,
              url: req.url
            }, context);
          }
          const res = await next(req.with ? req.with() : req);
          if (!responseCanRetry(res, options) || attempt >= attempts) {
            return res;
          }
          const delay = retryDelay(options, attempt, res);
          traceEvent("retry scheduled", {
            severity: "warning",
            label: `${res.status}, ${formatDelay2(delay)}`,
            attempt,
            attempts,
            status: res.status,
            method: req.method,
            url: req.url,
            delay
          }, context);
          traceDiagnostic({
            severity: "warning",
            code: "retry",
            message: `Retrying ${req.method} ${displayURL(req.url)} after HTTP ${res.status}`,
            data: { attempt, attempts, status: res.status, delay, method: req.method, url: req.url }
          }, context);
          await options.sleep(delay, req.signal);
        } catch (error) {
          lastError = error;
          if (!errorCanRetry(error, options) || attempt >= attempts || req.signal?.aborted) {
            throw error;
          }
          const delay = retryDelay(options, attempt);
          traceEvent("retry scheduled", {
            severity: "warning",
            label: `${error.name || "Error"}, ${formatDelay2(delay)}`,
            attempt,
            attempts,
            method: req.method,
            url: req.url,
            delay
          }, context);
          traceDiagnostic({
            severity: "warning",
            code: "retry",
            message: `Retrying ${req.method} ${displayURL(req.url)} after ${error.message || error}`,
            data: { attempt, attempts, delay, method: req.method, url: req.url, error: error.message }
          }, context);
          await options.sleep(delay, req.signal);
        }
      }
      throw lastError;
    }
    retry.traceName = options.name;
    return retry;
  }
  function retryDelay(options, attempt, res = null) {
    let serverDelay = 0;
    if (res && (options.respectRetryAfter || options.respectRateLimit)) {
      serverDelay = responseBackoffDelay(res, {
        statuses: options.status,
        maxDelay: options.maxDelay
      });
    }
    let delay = delayFor(options.delay, attempt, res);
    if (delay > 0 && options.factor && attempt > 1) {
      delay = delay * Math.pow(options.factor, attempt - 1);
    }
    if (options.jitter && delay > 0) {
      delay = delay * (0.5 + options.random());
    }
    if (options.maxDelay && options.maxDelay > 0) {
      delay = Math.min(delay, options.maxDelay);
    }
    return Math.max(serverDelay, Math.round(delay));
  }
  function methodCanRetry(req, options) {
    if (options.methods == "*") {
      return true;
    }
    return options.methods.map((method) => method.toUpperCase()).includes(req.method.toUpperCase());
  }
  function responseCanRetry(res, options) {
    if (typeof options.when == "function") {
      return options.when(res);
    }
    return options.status == "*" || options.status.includes(res.status);
  }
  function errorCanRetry(error, options) {
    if (typeof options.onError == "function") {
      return options.onError(error);
    }
    return error?.name != "AbortError" && error?.name != "TimeoutError";
  }
  function attemptsFor(attempts, req) {
    return typeof attempts == "function" ? attempts(req) : attempts;
  }
  function delayFor(delay, attempt, res) {
    return typeof delay == "function" ? delay(attempt, res) : delay;
  }
  function formatDelay2(delay) {
    return delay < 1e3 ? `${Math.round(delay)}ms` : `${(delay / 1e3).toFixed(delay < 1e4 ? 1 : 0)}s`;
  }
  function displayURL(value) {
    try {
      const url2 = new URL(value, "https://localhost/");
      return url2.origin == "https://localhost" ? url2.pathname + url2.search : url2.href;
    } catch (e) {
      return String(value);
    }
  }

  // ../metro-middleware/src/abort.mjs
  function abortmw(options = {}) {
    if (isAbortSignal(options)) {
      options = { signal: options };
    }
    if (typeof options == "function") {
      options = { signal: options };
    }
    options = Object.assign({
      name: "abort"
    }, options);
    async function abort(req, next, context) {
      const signal = signalFor(options.signal, req);
      if (!signal) {
        return next(req);
      }
      if (signal.aborted) {
        const error = signal.reason || abortError();
        traceDiagnostic({
          severity: "error",
          code: "aborted",
          message: error.message || "Request was aborted",
          data: { method: req.method, url: req.url }
        }, context);
        throw error;
      }
      traceEvent("abort signal attached", {
        severity: "info",
        method: req.method,
        url: req.url
      }, context);
      return next(req.with({ signal: combineSignals(req.signal, signal) }));
    }
    abort.traceName = options.name;
    return abort;
  }
  function combineSignals(...signals) {
    signals = signals.filter(Boolean);
    if (!signals.length) {
      return null;
    }
    if (signals.length == 1) {
      return signals[0];
    }
    const controller = new AbortController();
    const cleanup = [];
    const abort = (event) => {
      for (const remove2 of cleanup) {
        remove2();
      }
      const source = event?.target || signals.find((signal) => signal.aborted);
      if (!controller.signal.aborted) {
        controller.abort(source?.reason || abortError());
      }
    };
    for (const signal of signals) {
      if (signal.aborted) {
        abort({ target: signal });
        break;
      }
      signal.addEventListener("abort", abort, { once: true });
      cleanup.push(() => signal.removeEventListener("abort", abort));
    }
    return controller.signal;
  }
  function abortError(message = "Request was aborted") {
    if (typeof DOMException != "undefined") {
      return new DOMException(message, "AbortError");
    }
    const error = new Error(message);
    error.name = "AbortError";
    return error;
  }
  function signalFor(signal, req) {
    return typeof signal == "function" ? signal(req) : signal;
  }
  function isAbortSignal(value) {
    return value && typeof value == "object" && typeof value.aborted == "boolean" && typeof value.addEventListener == "function";
  }
  abortmw.combineSignals = combineSignals;
  abortmw.abortError = abortError;

  // ../metro-middleware/src/timeout.mjs
  function timeoutmw(options = 3e4) {
    if (typeof options == "number") {
      options = { ms: options };
    }
    options = Object.assign({
      ms: 3e4,
      name: "timeout"
    }, options);
    async function timeout(req, next, context) {
      const ms = delayFor2(options.ms, req);
      if (!ms || ms <= 0) {
        return next(req);
      }
      const controller = new AbortController();
      const timer = setTimeout(() => {
        controller.abort(timeoutError(ms));
      }, ms);
      const signal = combineSignals(req.signal, options.signal, controller.signal);
      traceEvent("timeout armed", {
        severity: "info",
        label: `${ms}ms`,
        method: req.method,
        url: req.url,
        ms
      }, context);
      try {
        return await next(req.with({ signal }));
      } catch (error) {
        if (controller.signal.aborted) {
          traceDiagnostic({
            severity: "error",
            code: "timeout",
            message: `Request timed out after ${ms}ms`,
            data: { method: req.method, url: req.url, ms }
          }, context);
        }
        throw error;
      } finally {
        clearTimeout(timer);
      }
    }
    timeout.traceName = options.name;
    return timeout;
  }
  function timeoutError(ms) {
    const error = new Error(`Request timed out after ${ms}ms`);
    error.name = "TimeoutError";
    error.code = "ETIMEDOUT";
    return error;
  }
  function delayFor2(ms, req) {
    return typeof ms == "function" ? ms(req) : ms;
  }
  timeoutmw.timeoutError = timeoutError;

  // ../metro-middleware/src/echo.mock.mjs
  function echomw() {
    return async function echo(req) {
      let options = {
        status: 200,
        statusText: "OK",
        url: req.url,
        headers: req.headers,
        body: req.body
      };
      return response(options);
    };
  }

  // ../metro-middleware/src/error.mock.mjs
  var baseResponse = {
    status: 200,
    statusText: "OK",
    headers: {
      "Content-Type": "application/json"
    }
  };
  var badRequest = (error) => {
    return {
      status: error.code,
      statusText: error.message,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(error)
    };
  };
  var status = {
    "/400/": "Bad Request",
    "/401/": "Unauthorized",
    "/402/": "Payment Required",
    "/403/": "Forbidden",
    "/404/": "Not Found",
    "/405/": "Method Not Allowed",
    "/406/": "Not Acceptable",
    "/407/": "Proxy Authentication Required",
    "/408/": "Request Timeout",
    "/409/": "Conflict",
    "/410/": "Gone",
    "/411/": "Length Required",
    "/412/": "Precondition Failed",
    "/413/": "Payload Too Large",
    "/414/": "URI Too Long",
    "/415/": "Unsupported Media Type",
    "/416/": "Range Not Satisfiable",
    "/417/": "Expectation Failed",
    "/418/": "I'm a teapot",
    "/421/": "Misdireceted Request",
    "/422/": "Unprocessable Content",
    "/423/": "Locked",
    "/424/": "Failed Dependency",
    "/425/": "Too Early",
    "/426/": "Upgrade Required",
    "/428/": "Precondition Required",
    "/429/": "Too Many Requests",
    "/431/": "Request Header Fields Too Large",
    "/451/": "Unavailable For Legal Reasons",
    "/500/": "Internal Server Error",
    "/501/": "Not Implemented",
    "/502/": "Bad Gateway",
    "/503/": "Service Unavailable",
    "/504/": "Gateway Timeout",
    "/505/": "HTTP Version Not Supported",
    "/506/": "Variant Also Negotiated",
    "/507/": "Insufficient Storage",
    "/508/": "Loop Detected",
    "/510/": "Not Extended",
    "/511/": "Network Authentication Required"
  };
  function errormw(options) {
    const customStatus = Object.assign({}, status, options);
    return async function error(req) {
      let url2 = url(req.url);
      if (status[url2.pathname]) {
        let error2 = {
          code: parseInt(url2.pathname.substring(1)),
          message: customStatus[url2.pathname]
        };
        return response(badRequest(error2));
      } else {
        return response(baseResponse);
      }
    };
  }

  // ../metro-middleware/src/index.mjs
  var src_default = {
    json: jsonmw,
    thrower: throwermw,
    getdata: getdatamw,
    retry: retrymw,
    timeout: timeoutmw,
    abort: abortmw,
    backoff: backoffmw,
    echoMock: echomw,
    errorMock: errormw
  };

  // ../metro-api/src/index.mjs
  var API = class extends Client {
    #methods = null;
    #base = "";
    constructor(base, methods, bind = null) {
      if (base instanceof Client) {
        super(base.clientOptions, throwermw(), getdatamw());
      } else {
        super(base, throwermw(), getdatamw());
      }
      if (!bind) {
        bind = this;
      }
      this.#methods = methods;
      this.#base = base;
      for (const methodName in methods) {
        if (typeof methods[methodName] == "function") {
          this[methodName] = methods[methodName].bind(bind);
        } else if (methods[methodName] && typeof methods[methodName] == "object" && (Object.getPrototypeOf(methods[methodName]) === null || Object.getPrototypeOf(methods[methodName]).constructor === Object)) {
          this[methodName] = new this.constructor(base, methods[methodName], bind);
        } else {
          this[methodName] = methods[methodName];
        }
      }
    }
    extend(methods) {
      return new this.constructor(this.#base, Object.assign({}, this.#methods, methods));
    }
  };
  var JsonAPI = class extends API {
    constructor(base, methods, bind = null) {
      if (base instanceof Client) {
        super(base.with(jsonmw()), methods, bind);
      } else {
        super(client(base, jsonmw()), methods, bind);
      }
    }
  };
  function api(...options) {
    return new API(...deepClone(options));
  }
  function jsonApi(...options) {
    return new JsonAPI(...deepClone(options));
  }

  // ../metro-trace/src/index.mjs
  var src_exports2 = {};
  __export(src_exports2, {
    GraphTracer: () => GraphTracer,
    add: () => add,
    clear: () => clear,
    default: () => src_default2,
    delete: () => remove,
    graph: () => graph,
    group: () => group,
    localConsole: () => localConsole,
    remove: () => remove
  });

  // ../metro-trace/src/tracegraph.mjs
  var DEFAULT_OPTIONS = {
    name: "Metro trace",
    view: "tree",
    persist: true,
    autoPrint: true,
    includeRawTrace: false,
    maxAge: 10 * 60 * 1e3,
    maxTraces: 20,
    slowStepMs: 1e3,
    store: null,
    expectedStatus: (status2) => status2 < 400,
    console: typeof console != "undefined" ? console : null
  };
  var SEVERITY_WEIGHT = {
    ok: 0,
    info: 1,
    warning: 2,
    error: 3,
    blocked: 4
  };
  var SEVERITY_SYMBOL = {
    ok: "\u2713",
    info: "\u2139",
    warning: "\u26A0",
    error: "\u2716",
    blocked: "\u26D4",
    skipped: "\u23ED",
    pending: "\u2026"
  };
  function graph(options = {}) {
    return new GraphTracer(options);
  }
  function localConsole(options = {}) {
    return graph(options);
  }
  var GraphTracer = class {
    constructor(options = {}) {
      this.options = Object.assign({}, DEFAULT_OPTIONS, options);
      if (!this.options.store) {
        this.options.store = this.options.persist ? localStorageStore(this.options) : memoryStore();
      }
      this.store = this.options.store;
      this.defaultState = traceState();
      this.runs = /* @__PURE__ */ new Map();
      this.lastTraceId = null;
      this.store.cleanup?.(this.options);
    }
    request(req, middleware, context = null) {
      const state = this.state(context);
      if (!state.activeTraceId) {
        this.startTrace(requestName(req), {}, context);
      }
      this.startSpan(middlewareName(middleware), {
        kind: middlewareKind(middleware),
        method: req?.method,
        url: safeURL(req?.url)
      }, context);
    }
    response(res, middleware, context = null) {
      const state = this.state(context);
      const span = state.stack.pop();
      if (!span) {
        return;
      }
      span.end = now();
      span.duration = span.end - span.start;
      span.response = responseSummary(res);
      span.status = "ok";
      span.severity = "ok";
      this.addResponseDiagnostics(span, res, context);
      this.store.saveSpan(span);
      this.finishTraceIfComplete(null, context);
    }
    error(error, req, middleware, context = null) {
      const state = this.state(context);
      const span = state.stack.pop();
      if (!span) {
        return;
      }
      span.end = now();
      span.duration = span.end - span.start;
      span.status = "error";
      span.severity = "error";
      span.error = errorSummary(error);
      this.store.saveSpan(span);
      const message = error?.message || "Middleware failed";
      const trace = this.store.read(span.traceId);
      const alreadyReported = trace?.diagnostics?.some((diagnostic) => diagnostic.data?.errorMessage == message);
      if (span.kind == "fetch" || !alreadyReported) {
        this.diagnostic({
          traceId: span.traceId,
          spanId: span.spanId,
          severity: "error",
          code: span.kind == "fetch" ? "network-error" : "middleware-error",
          message,
          data: {
            middleware: middlewareName(middleware),
            method: req?.method,
            url: safeURL(req?.url),
            name: error?.name,
            errorMessage: message
          }
        }, context);
      }
      this.finishTraceIfComplete("error", context);
    }
    /**
     * Add a custom event to the current trace. Use from/to metadata to make it
     * appear in sequence diagrams.
     */
    event(name, data = {}, context = null) {
      const state = this.state(context);
      const traceId = data.traceId || state.activeTraceId || state.lastTraceId || this.lastTraceId || this.startTrace(this.options.name, {}, context);
      const parent = data.parentSpanId || state.stack[state.stack.length - 1]?.spanId || state.activeParentSpanId || null;
      const event = {
        id: id("event"),
        traceId,
        spanId: parent,
        time: now(),
        name,
        severity: data.severity || "info",
        data: sanitizeData(data)
      };
      this.store.saveEvent(event);
      return event;
    }
    /**
     * Record a manual span. This is useful for middleware internals that are not
     * represented by a Metro fetch call, for example token validation or PKCE.
     */
    async span(name, fn, data = {}, context = null) {
      this.startSpan(name, data, context);
      try {
        const result = await fn();
        this.response(data.response || { status: 200 }, { name }, context);
        return result;
      } catch (error) {
        this.error(error, null, { name }, context);
        throw error;
      }
    }
    startTrace(name, data = {}, context = null) {
      const state = this.state(context);
      const trace = {
        id: data.traceId || id("trace"),
        name,
        start: now(),
        status: "running",
        severity: "ok",
        data: sanitizeData(data)
      };
      state.activeTraceId = trace.id;
      state.lastTraceId = trace.id;
      this.lastTraceId = trace.id;
      this.store.saveTrace(trace);
      return trace.id;
    }
    startSpan(name, data = {}, context = null) {
      const state = this.state(context);
      const traceId = data.traceId || state.activeTraceId || this.startTrace(this.options.name, {}, context);
      const parentSpanId = data.parentSpanId || state.stack[state.stack.length - 1]?.spanId || state.activeParentSpanId || null;
      const span = {
        traceId,
        spanId: id("span"),
        parentSpanId,
        name,
        kind: data.kind || "manual",
        start: now(),
        status: "running",
        severity: "ok",
        data: sanitizeData(data)
      };
      state.stack.push(span);
      this.store.saveSpan(span);
      return span;
    }
    diagnostic(diagnostic, context = null) {
      const state = this.state(context);
      const currentSpan = state.stack[state.stack.length - 1];
      const traceId = diagnostic.traceId || currentSpan?.traceId || state.activeTraceId || state.lastTraceId || this.lastTraceId;
      if (!traceId) {
        return null;
      }
      const result = Object.assign({
        id: id("diagnostic"),
        traceId,
        spanId: diagnostic.spanId || currentSpan?.spanId || null,
        time: now(),
        severity: "warning"
      }, diagnostic);
      result.data = sanitizeData(result.data || {});
      this.store.saveDiagnostic(result);
      return result;
    }
    current(context = null) {
      const state = this.state(context);
      return {
        traceId: state.activeTraceId,
        spanId: state.stack[state.stack.length - 1]?.spanId || state.activeParentSpanId || null
      };
    }
    /**
     * Remember a trace id under a stable key, for example an OAuth state value.
     * The key is local to this trace store.
     */
    link(key, traceId = void 0, context = null) {
      const state = this.state(context);
      traceId = traceId || state.activeTraceId || state.lastTraceId || this.lastTraceId;
      if (key && traceId) {
        this.store.link(key, traceId);
      }
      return traceId;
    }
    /**
     * Resume adding manual events/spans to a trace after a redirect or popup.
     */
    resume(traceId, parentSpanId = null, context = null) {
      if (!traceId) {
        return null;
      }
      const state = this.state(context);
      state.activeTraceId = traceId;
      state.activeParentSpanId = parentSpanId;
      state.lastTraceId = traceId;
      this.lastTraceId = traceId;
      return this.current(context);
    }
    resumeLink(key, parentSpanId = null, context = null) {
      return this.resume(this.store.lookup(key), parentSpanId, context);
    }
    pause(context = null) {
      if (context?.__metroTraceContext) {
        this.runs.delete(context.id);
        return;
      }
      this.defaultState = traceState();
    }
    get(traceId = this.lastTraceId) {
      return this.store.read(traceId);
    }
    print(traceId = this.lastTraceId, options = {}) {
      const trace = typeof traceId == "object" ? traceId : this.get(traceId);
      if (!trace) {
        return null;
      }
      return printTrace(trace, Object.assign({}, this.options, options));
    }
    printLast(options = {}) {
      return this.print(this.lastTraceId || this.store.lastTraceId?.(), options);
    }
    render(traceId = this.lastTraceId, options = {}) {
      const trace = typeof traceId == "object" ? traceId : this.get(traceId);
      if (!trace) {
        return "";
      }
      return renderTrace(trace, Object.assign({}, this.options, options));
    }
    clear() {
      this.store.clear();
      this.defaultState = traceState();
      this.runs.clear();
      this.lastTraceId = null;
    }
    addResponseDiagnostics(span, res, context = null) {
      if (span.duration >= this.options.slowStepMs) {
        span.severity = maxSeverity(span.severity, "warning");
        this.diagnostic({
          traceId: span.traceId,
          spanId: span.spanId,
          severity: "warning",
          code: "slow-step",
          message: `${span.name} took ${formatDuration(span.duration)}`,
          data: { threshold: this.options.slowStepMs, actual: span.duration }
        }, context);
      }
      if (!res || typeof res.status == "undefined" || span.kind != "fetch") {
        return;
      }
      if (this.statusExpected(res.status, span) === false) {
        const severity = res.status >= 500 ? "error" : "warning";
        span.status = severity == "error" ? "error" : "warning";
        span.severity = maxSeverity(span.severity, severity);
        this.diagnostic({
          traceId: span.traceId,
          spanId: span.spanId,
          severity,
          code: "unexpected-status",
          message: `${span.name} returned unexpected HTTP ${res.status}`,
          data: { status: res.status, url: span.data?.url }
        }, context);
      }
    }
    statusExpected(status2, span) {
      const expected = this.options.expectedStatus;
      if (typeof expected == "function") {
        return expected(status2, span);
      }
      if (Array.isArray(expected)) {
        return expected.includes(status2);
      }
      return status2 < 400;
    }
    finishTraceIfComplete(status2 = null, context = null) {
      const state = this.state(context);
      if (state.stack.length || !state.activeTraceId) {
        return;
      }
      if (context?.parent) {
        this.runs.delete(context.id);
        return;
      }
      const trace = this.store.read(state.activeTraceId);
      if (!trace) {
        this.pause(context);
        return;
      }
      trace.end = now();
      trace.duration = trace.end - trace.start;
      trace.status = status2 || traceStatus(trace);
      trace.severity = traceSeverity(trace);
      this.store.saveTrace(trace);
      state.lastTraceId = trace.id;
      this.lastTraceId = trace.id;
      if (this.options.autoPrint) {
        this.print(trace.id);
      }
      this.pause(context);
    }
    state(context = null) {
      if (!context?.__metroTraceContext) {
        return this.defaultState;
      }
      let state = this.runs.get(context.id);
      if (state) {
        return state;
      }
      state = traceState();
      const parentState = context.parent ? this.runs.get(context.parent.id) : null;
      if (parentState) {
        state.activeTraceId = parentState.activeTraceId;
        state.activeParentSpanId = parentState.stack[parentState.stack.length - 1]?.spanId || parentState.activeParentSpanId || null;
        state.lastTraceId = parentState.lastTraceId;
      }
      this.runs.set(context.id, state);
      return state;
    }
  };
  function traceState() {
    return {
      stack: [],
      activeTraceId: null,
      activeParentSpanId: null,
      lastTraceId: null
    };
  }
  function renderTrace(trace, options = {}) {
    options = Object.assign({}, DEFAULT_OPTIONS, options);
    const diagnostics = trace.diagnostics || [];
    const lines = [];
    lines.push(`${traceTitle(trace)} ${trace.status || ""} ${formatDuration(trace.duration || elapsed(trace))}`.trim());
    const primary = primaryDiagnostic(diagnostics);
    if (primary) {
      lines.push("");
      lines.push("Primary diagnostic:");
      lines.push(`${symbol(primary.severity)} ${primary.code}: ${primary.message}`);
    }
    if (diagnostics.length) {
      lines.push("");
      lines.push("Diagnostics:");
      for (const diagnostic of diagnostics) {
        lines.push(`${symbol(diagnostic.severity)} ${diagnostic.code}: ${diagnostic.message}`);
      }
    }
    lines.push("");
    lines.push(options.view == "sequence" ? renderSequence(trace, options) : renderTree(trace, options));
    return lines.join("\n");
  }
  function renderTree(trace, options = {}) {
    const spans = trace.spans || [];
    const events = trace.events || [];
    const children = /* @__PURE__ */ new Map();
    for (const span of spans) {
      const parent = span.parentSpanId || "";
      if (!children.has(parent)) {
        children.set(parent, []);
      }
      children.get(parent).push(span);
    }
    for (const group2 of children.values()) {
      group2.sort((a, b) => a.start - b.start);
    }
    const eventsBySpan = /* @__PURE__ */ new Map();
    for (const event of events) {
      const spanId = event.spanId || "";
      if (!eventsBySpan.has(spanId)) {
        eventsBySpan.set(spanId, []);
      }
      eventsBySpan.get(spanId).push(event);
    }
    for (const group2 of eventsBySpan.values()) {
      group2.sort((a, b) => a.time - b.time);
    }
    const roots = children.get("") || [];
    const lines = [];
    if (!roots.length && !events.length) {
      return "(empty trace)";
    }
    for (let index = 0; index < roots.length; index++) {
      appendSpan(lines, roots[index], children, eventsBySpan, "", index == roots.length - 1);
    }
    for (const event of eventsBySpan.get("") || []) {
      lines.push(`${symbol(event.severity)} ${event.name}${eventLabel(event)}`);
    }
    return lines.join("\n");
  }
  function renderSequence(trace, options = {}) {
    const arrows = sequenceArrows(trace);
    if (!arrows.length) {
      return renderTree(trace, options);
    }
    const actors = collectActors(arrows);
    const width = Math.max(14, ...actors.map((actor) => actor.length));
    const gap = "    ";
    const lines = [];
    lines.push(actors.map((actor) => pad(actor, width)).join(gap));
    lines.push(actors.map(() => pad("\u2502", width)).join(gap));
    for (const arrow of arrows) {
      lines.push(sequenceLine(actors, arrow, width, gap));
    }
    return lines.join("\n");
  }
  function printTrace(trace, options = {}) {
    const output = renderTrace(trace, options);
    const out = options.console || console;
    if (!out) {
      return output;
    }
    const title = `${symbol(trace.severity)} ${traceTitle(trace)} ${trace.status || ""} ${formatDuration(trace.duration || elapsed(trace))}`.trim();
    if (out.groupCollapsed) {
      out.groupCollapsed("\u24C2\uFE0F  " + title);
    } else if (out.group) {
      out.group("\u24C2\uFE0F  " + title);
    }
    printDiagnostics(trace.diagnostics || [], out);
    for (const line of output.split("\n")) {
      printLine(line, out);
    }
    if (options.includeRawTrace && out.dir) {
      out.dir(trace);
    }
    if (out.groupEnd) {
      out.groupEnd();
    }
    return output;
  }
  function memoryStore() {
    let traces = /* @__PURE__ */ new Map();
    let spans = /* @__PURE__ */ new Map();
    let events = /* @__PURE__ */ new Map();
    let diagnostics = /* @__PURE__ */ new Map();
    let links = /* @__PURE__ */ new Map();
    let last = null;
    return {
      saveTrace(trace) {
        traces.set(trace.id, Object.assign({}, trace));
        last = trace.id;
      },
      saveSpan(span) {
        spans.set(span.spanId, Object.assign({}, span));
      },
      saveEvent(event) {
        events.set(event.id, Object.assign({}, event));
      },
      saveDiagnostic(diagnostic) {
        diagnostics.set(diagnostic.id, Object.assign({}, diagnostic));
      },
      read(traceId) {
        return assemble(traceId, traces, spans, events, diagnostics);
      },
      lastTraceId() {
        return last;
      },
      link(key, traceId) {
        links.set(key, traceId);
      },
      lookup(key) {
        return links.get(key);
      },
      cleanup() {
      },
      clear() {
        traces.clear();
        spans.clear();
        events.clear();
        diagnostics.clear();
        links.clear();
        last = null;
      }
    };
  }
  function localStorageStore(options = {}) {
    const storage = options.storage || safeLocalStorage2();
    if (!storage) {
      return memoryStore();
    }
    const prefix = options.prefix || "metro:trace:";
    const key = (suffix) => prefix + suffix;
    return {
      saveTrace(trace) {
        safeStore(() => {
          storage.setItem(key(`trace:${trace.id}`), JSON.stringify(trace));
          storage.setItem(key("last"), trace.id);
          updateIndex(storage, prefix, trace.id);
        });
      },
      saveSpan(span) {
        safeStore(() => storage.setItem(key(`span:${span.traceId}:${span.spanId}`), JSON.stringify(span)));
      },
      saveEvent(event) {
        safeStore(() => storage.setItem(key(`event:${event.traceId}:${event.id}`), JSON.stringify(event)));
      },
      saveDiagnostic(diagnostic) {
        safeStore(() => storage.setItem(key(`diagnostic:${diagnostic.traceId}:${diagnostic.id}`), JSON.stringify(diagnostic)));
      },
      read(traceId) {
        return safeStore(() => readLocalTrace(storage, prefix, traceId), null);
      },
      lastTraceId() {
        return safeStore(() => storage.getItem(key("last")), null);
      },
      link(linkKey, traceId) {
        safeStore(() => storage.setItem(key(`link:${linkKey}`), traceId));
      },
      lookup(linkKey) {
        return safeStore(() => storage.getItem(key(`link:${linkKey}`)), null);
      },
      cleanup(cleanupOptions = options) {
        safeStore(() => cleanupLocalStorage(storage, prefix, cleanupOptions));
      },
      clear() {
        safeStore(() => clearLocalStorage(storage, prefix));
      }
    };
  }
  function safeStore(fn, fallback = void 0) {
    try {
      return fn();
    } catch (e) {
      return fallback;
    }
  }
  function appendSpan(lines, span, children, eventsBySpan, prefix, isLast) {
    const branch = isLast ? "\u2514\u2500 " : "\u251C\u2500 ";
    lines.push(`${prefix}${branch}${spanLine(span)}`);
    const childPrefix = prefix + (isLast ? "   " : "\u2502  ");
    const childSpans = children.get(span.spanId) || [];
    const childEvents = eventsBySpan.get(span.spanId) || [];
    const items = [
      ...childSpans.map((item) => ({ type: "span", item, time: item.start })),
      ...childEvents.map((item) => ({ type: "event", item, time: item.time }))
    ].sort((a, b) => a.time - b.time);
    for (let index = 0; index < items.length; index++) {
      const item = items[index];
      const last = index == items.length - 1;
      if (item.type == "span") {
        appendSpan(lines, item.item, children, eventsBySpan, childPrefix, last);
      } else {
        lines.push(`${childPrefix}${last ? "\u2514\u2500 " : "\u251C\u2500 "}${symbol(item.item.severity)} ${item.item.name}${eventLabel(item.item)}`);
      }
    }
  }
  function spanLine(span) {
    const status2 = span.status == "running" ? "pending" : span.severity || span.status || "ok";
    const response2 = span.response?.status ? ` HTTP ${span.response.status}` : "";
    const url2 = span.data?.url ? ` ${displayURL2(span.data.url)}` : "";
    return `${symbol(status2)} ${span.name}${response2}${url2} ${formatDuration(span.duration || elapsed(span))}`.trim();
  }
  function eventLabel(event) {
    if (event.data?.label) {
      return ` \u2014 ${event.data.label}`;
    }
    if (event.data?.url) {
      return ` ${displayURL2(event.data.url)}`;
    }
    return "";
  }
  function sequenceArrows(trace) {
    const arrows = [];
    const spans = [...trace.spans || []].sort((a, b) => a.start - b.start);
    const roots = spans.filter((span) => !span.parentSpanId);
    for (const span of roots) {
      arrows.push({
        from: "App",
        to: "Metro",
        label: `${span.data?.method || ""} ${displayURL2(span.data?.url)}`.trim() || span.name,
        severity: span.severity,
        time: span.start
      });
    }
    for (const span of spans) {
      if (span.kind == "fetch" || span.name == "browserFetch") {
        const host = hostActor(span.data?.url);
        arrows.push({
          from: "Metro",
          to: host,
          label: `${span.data?.method || "GET"} ${pathLabel(span.data?.url)}`,
          severity: span.severity,
          time: span.start
        });
        if (span.response || span.error || span.status == "running") {
          arrows.push({
            from: host,
            to: "Metro",
            label: span.error ? `error: ${span.error.message}` : span.response?.status ? `${span.response.status}` : "pending",
            severity: span.severity,
            time: span.end || now()
          });
        }
      }
    }
    for (const event of trace.events || []) {
      if (event.data?.from && event.data?.to) {
        arrows.push({
          from: event.data.from,
          to: event.data.to,
          label: event.data.label || event.name,
          severity: event.severity,
          time: event.time
        });
      }
    }
    return arrows.sort((a, b) => a.time - b.time);
  }
  function collectActors(arrows) {
    const actors = [];
    for (const arrow of arrows) {
      if (!actors.includes(arrow.from)) {
        actors.push(arrow.from);
      }
      if (!actors.includes(arrow.to)) {
        actors.push(arrow.to);
      }
    }
    return actors;
  }
  function sequenceLine(actors, arrow, width, gap) {
    const from = actors.indexOf(arrow.from);
    const to = actors.indexOf(arrow.to);
    const left = Math.min(from, to);
    const right = Math.max(from, to);
    const cells = actors.map(() => pad("\u2502", width));
    const label = `${symbol(arrow.severity)} ${arrow.label}`.trim();
    for (let index = left; index <= right; index++) {
      if (index == from) {
        cells[index] = pad(from < to ? "\u251C" : "\u25C0", width);
      } else if (index == to) {
        cells[index] = pad(from < to ? "\u25B6" : "\u2524", width);
      } else {
        cells[index] = pad("\u2500", width);
      }
    }
    return cells.join(gap) + "  " + label;
  }
  function printDiagnostics(diagnostics, out) {
    const primary = primaryDiagnostic(diagnostics);
    if (primary && out.error) {
      out.error(`${symbol(primary.severity)} ${primary.code}: ${primary.message}`);
    }
    for (const diagnostic of diagnostics) {
      if (diagnostic == primary) {
        continue;
      }
      printLine(`${symbol(diagnostic.severity)} ${diagnostic.code}: ${diagnostic.message}`, out);
    }
  }
  function printLine(line, out) {
    if (/✖|⛔/.test(line) && out.error) {
      out.error(line);
    } else if (/⚠/.test(line) && out.warn) {
      out.warn(line);
    } else if (out.log) {
      out.log(line);
    }
  }
  function assemble(traceId, traces, spans, events, diagnostics) {
    const trace = traces.get(traceId);
    if (!trace) {
      return null;
    }
    const result = Object.assign({}, trace);
    result.spans = [...spans.values()].filter((span) => span.traceId == traceId);
    result.events = [...events.values()].filter((event) => event.traceId == traceId);
    result.diagnostics = [...diagnostics.values()].filter((diagnostic) => diagnostic.traceId == traceId);
    result.status = result.status == "running" ? traceStatus(result) : result.status;
    result.severity = traceSeverity(result);
    return result;
  }
  function readLocalTrace(storage, prefix, traceId) {
    if (!traceId) {
      return null;
    }
    const trace = parseJSON(storage.getItem(prefix + `trace:${traceId}`));
    if (!trace) {
      return null;
    }
    trace.spans = [];
    trace.events = [];
    trace.diagnostics = [];
    for (let index = 0; index < storage.length; index++) {
      const key = storage.key(index);
      if (key?.startsWith(prefix + `span:${traceId}:`)) {
        trace.spans.push(parseJSON(storage.getItem(key)));
      } else if (key?.startsWith(prefix + `event:${traceId}:`)) {
        trace.events.push(parseJSON(storage.getItem(key)));
      } else if (key?.startsWith(prefix + `diagnostic:${traceId}:`)) {
        trace.diagnostics.push(parseJSON(storage.getItem(key)));
      }
    }
    trace.spans = trace.spans.filter(Boolean);
    trace.events = trace.events.filter(Boolean);
    trace.diagnostics = trace.diagnostics.filter(Boolean);
    trace.status = trace.status == "running" ? traceStatus(trace) : trace.status;
    trace.severity = traceSeverity(trace);
    return trace;
  }
  function updateIndex(storage, prefix, traceId) {
    const indexKey = prefix + "index";
    const index = parseJSON(storage.getItem(indexKey)) || [];
    const next = [traceId, ...index.filter((id2) => id2 != traceId)];
    storage.setItem(indexKey, JSON.stringify(next));
  }
  function cleanupLocalStorage(storage, prefix, options = {}) {
    const indexKey = prefix + "index";
    const index = parseJSON(storage.getItem(indexKey)) || [];
    const maxAge = options.maxAge ?? DEFAULT_OPTIONS.maxAge;
    const maxTraces = options.maxTraces ?? DEFAULT_OPTIONS.maxTraces;
    const keep = [];
    const remove2 = [];
    const cutoff = now() - maxAge;
    for (const traceId of index) {
      const trace = parseJSON(storage.getItem(prefix + `trace:${traceId}`));
      if (!trace || trace.start < cutoff || keep.length >= maxTraces) {
        remove2.push(traceId);
      } else {
        keep.push(traceId);
      }
    }
    for (const traceId of remove2) {
      removeTrace(storage, prefix, traceId);
    }
    storage.setItem(indexKey, JSON.stringify(keep));
  }
  function clearLocalStorage(storage, prefix) {
    const keys = [];
    for (let index = 0; index < storage.length; index++) {
      const key = storage.key(index);
      if (key?.startsWith(prefix)) {
        keys.push(key);
      }
    }
    for (const key of keys) {
      storage.removeItem(key);
    }
  }
  function removeTrace(storage, prefix, traceId) {
    const keys = [];
    for (let index = 0; index < storage.length; index++) {
      const key = storage.key(index);
      if (key == prefix + `trace:${traceId}` || key?.startsWith(prefix + `span:${traceId}:`) || key?.startsWith(prefix + `event:${traceId}:`) || key?.startsWith(prefix + `diagnostic:${traceId}:`)) {
        keys.push(key);
      }
    }
    for (const key of keys) {
      storage.removeItem(key);
    }
  }
  function traceStatus(trace) {
    const spans = trace.spans || [];
    if (spans.some((span) => span.status == "running")) {
      return "incomplete";
    }
    if ((trace.diagnostics || []).some((diagnostic) => diagnostic.severity == "error" || diagnostic.severity == "blocked")) {
      return "error";
    }
    if ((trace.diagnostics || []).some((diagnostic) => diagnostic.severity == "warning")) {
      return "warning";
    }
    return "ok";
  }
  function traceSeverity(trace) {
    let severity = trace.status == "running" ? "pending" : "ok";
    for (const span of trace.spans || []) {
      severity = maxSeverity(severity, span.severity || span.status || "ok");
    }
    for (const diagnostic of trace.diagnostics || []) {
      severity = maxSeverity(severity, diagnostic.severity || "warning");
    }
    return severity;
  }
  function primaryDiagnostic(diagnostics) {
    return [...diagnostics].sort((a, b) => (SEVERITY_WEIGHT[b.severity] || 0) - (SEVERITY_WEIGHT[a.severity] || 0))[0];
  }
  function maxSeverity(a, b) {
    return (SEVERITY_WEIGHT[b] || 0) > (SEVERITY_WEIGHT[a] || 0) ? b : a;
  }
  function symbol(status2) {
    return SEVERITY_SYMBOL[status2] || SEVERITY_SYMBOL.info;
  }
  function requestName(req) {
    return `${req?.method || "GET"} ${displayURL2(req?.url)}`;
  }
  function middlewareName(middleware) {
    return middleware?.displayName || middleware?.traceName || middleware?.name || "anonymous middleware";
  }
  function middlewareKind(middleware) {
    return middlewareName(middleware) == "browserFetch" ? "fetch" : "middleware";
  }
  function responseSummary(res) {
    if (!res) {
      return null;
    }
    return {
      status: res.status,
      statusText: res.statusText,
      ok: res.ok,
      url: safeURL(res.url),
      redirected: res.redirected,
      type: res.type
    };
  }
  function errorSummary(error) {
    return {
      name: error?.name,
      message: error?.message || String(error),
      stack: error?.stack
    };
  }
  function traceTitle(trace) {
    return trace?.name || trace?.id || "Metro trace";
  }
  function safeURL(value) {
    if (!value) {
      return value;
    }
    try {
      const url2 = new URL(value, typeof window != "undefined" ? window.location.href : "https://localhost/");
      url2.username = "";
      url2.password = "";
      for (const param of [...url2.searchParams.keys()]) {
        if (isSecretName(param)) {
          url2.searchParams.set(param, "\u2026");
        }
      }
      return url2.href;
    } catch (e) {
      return String(value);
    }
  }
  function displayURL2(value) {
    if (!value) {
      return "";
    }
    try {
      const url2 = new URL(value, "https://localhost/");
      return url2.origin == "https://localhost" ? url2.pathname + url2.search : url2.href;
    } catch (e) {
      return String(value);
    }
  }
  function hostActor(value) {
    try {
      return new URL(value, "https://localhost/").host || "Network";
    } catch (e) {
      return "Network";
    }
  }
  function pathLabel(value) {
    try {
      const url2 = new URL(value, "https://localhost/");
      return url2.pathname + url2.search;
    } catch (e) {
      return displayURL2(value);
    }
  }
  function sanitizeData(data) {
    const result = {};
    for (const [key, value] of Object.entries(data || {})) {
      if (["traceId", "parentSpanId", "severity"].includes(key)) {
        continue;
      }
      if (isSecretName(key)) {
        result[key] = "\u2026";
      } else if (value instanceof URL) {
        result[key] = safeURL(value.href);
      } else if (typeof value == "string" && looksLikeURL(value)) {
        result[key] = safeURL(value);
      } else if (value == null || ["string", "number", "boolean"].includes(typeof value)) {
        result[key] = value;
      } else {
        result[key] = String(value);
      }
    }
    return result;
  }
  function isSecretName(name) {
    return /token|secret|password|credential|cookie|authorization|verifier|assertion|code/i.test(name);
  }
  function looksLikeURL(value) {
    return /^https?:\/\//.test(value) || /^\//.test(value);
  }
  function formatDuration(duration) {
    if (typeof duration != "number" || Number.isNaN(duration)) {
      return "";
    }
    if (duration < 1e3) {
      return `${Math.round(duration)}ms`;
    }
    return `${(duration / 1e3).toFixed(2)}s`;
  }
  function elapsed(item) {
    return item?.start ? now() - item.start : 0;
  }
  function now() {
    return Date.now();
  }
  function id(prefix) {
    return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
  }
  function pad(value, width) {
    value = String(value);
    return value + " ".repeat(Math.max(0, width - value.length));
  }
  function parseJSON(value) {
    try {
      return value ? JSON.parse(value) : null;
    } catch (e) {
      return null;
    }
  }
  function safeLocalStorage2() {
    try {
      return typeof localStorage != "undefined" ? localStorage : null;
    } catch (e) {
      return null;
    }
  }

  // ../metro-trace/src/index.mjs
  var metroConsole2 = {
    info: (message, ...details) => console.info("\u24C2\uFE0F  ", message, ...details),
    group: (name) => console.group("\u24C2\uFE0F  " + name),
    groupEnd: (name) => console.groupEnd("\u24C2\uFE0F  " + name)
  };
  function add(name, tracer) {
    Client.tracers[name] = tracer;
  }
  function remove(name) {
    delete Client.tracers[name];
  }
  function clear() {
    Client.tracers = {};
  }
  function group() {
    let group2 = 0;
    return {
      request: (req, middleware) => {
        group2++;
        metroConsole2.group(group2);
        metroConsole2.info(req?.url, req, middleware);
      },
      response: (res, middleware) => {
        metroConsole2.info(res?.body ? res.body[Symbol.metroSource] : null, res, middleware);
        metroConsole2.groupEnd(group2);
        group2--;
      },
      error: (error) => {
        metroConsole2.info(error);
        metroConsole2.groupEnd(group2);
        group2--;
      }
    };
  }
  var src_default2 = {
    add,
    delete: remove,
    remove,
    clear,
    group,
    graph: (...args) => graph(...args),
    localConsole: (...args) => localConsole(...args)
  };

  // ../metro-hashparams/src/index.mjs
  var src_exports3 = {};
  __export(src_exports3, {
    append: () => append,
    clear: () => clear2,
    parse: () => parse
  });
  function parse(url2) {
    const hash = url(url2).hash.substr(1);
    const query = /\?[^#]*/.exec(hash)?.[0];
    return new URLSearchParams(query);
  }
  function append(url2, params) {
    url2 = url(url2);
    if (!(params instanceof URLSearchParams)) {
      params = new URLSearchParams(params);
    }
    let hash = url2.hash || "#";
    hash += "?" + params;
    return url2.with({ hash });
  }
  function clear2(url2) {
    url2 = url(url2);
    let hash = url2.hash.replace(/\?[^#]*/, "");
    if (hash.substr(0, 2) === "##") {
      hash = hash.substr(1);
    }
    return url2.with({ hash });
  }

  // ../metro-formdata/src/index.mjs
  var metroURL2 = "https://metro.muze.nl/details/";
  if (!Symbol.metroProxy) {
    Symbol.metroProxy = /* @__PURE__ */ Symbol("isProxy");
  }
  if (!Symbol.metroSource) {
    Symbol.metroSource = /* @__PURE__ */ Symbol("source");
  }
  function formdata(...options) {
    var params = new FormData();
    for (let option of options) {
      if (typeof HTMLFormElement != "undefined" && option instanceof HTMLFormElement) {
        option = new FormData(option);
      }
      if (option instanceof FormData) {
        for (let entry of option.entries()) {
          params.append(entry[0], entry[1]);
        }
      } else if (option && typeof option == "object") {
        for (let entry of Object.entries(option)) {
          if (Array.isArray(entry[1])) {
            for (let value of entry[1]) {
              params.append(entry[0], value);
            }
          } else {
            params.append(entry[0], entry[1]);
          }
        }
      } else {
        throw metroError("metro.formdata: unknown option type " + metroURL2 + "formdata/unknown-option-value/", option);
      }
    }
    Object.freeze(params);
    return new Proxy(params, {
      get(target, prop) {
        let result;
        switch (prop) {
          case Symbol.metroProxy:
            result = true;
            break;
          case Symbol.metroSource:
            result = target;
            break;
          //TODO: add toString() that can check
          //headers param: toString({headers:request.headers})
          //for the content-type
          case "with":
            result = function(...options2) {
              return formdata(target, ...options2);
            };
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

  // src/index.mjs
  var metro = Object.assign({}, src_exports, {
    API,
    JsonAPI,
    api,
    jsonApi,
    mw: src_default,
    trace: src_exports2,
    hashParams: src_exports3,
    formdata
  });
  var index_default = metro;

  // src/everything.mjs
  if (!globalThis.metro) {
    globalThis.metro = index_default;
  }
  var everything_default = index_default;
})();
//# sourceMappingURL=everything.js.map
