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
      if (typeof data == "object" && !(data instanceof String) && !(data instanceof ReadableStream) && !(data instanceof Blob) && !(data instanceof ArrayBuffer) && !(data instanceof DataView) && !(data instanceof FormData) && !(data instanceof URLSearchParams) && (typeof globalThis.TypedArray == "undefined" || !(data instanceof globalThis.TypedArray))) {
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
              if (data) {
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
              }
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
            result = target.status >= 200 && target.status < 400;
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
            result = target.pathname.substring(0, target.pathname.lastIndexOf("\\") + 1);
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
          case "origin":
            result = target.protocol + "//" + target.hostname;
            result += target.port ? ":" + target.port : "";
            result += "/";
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
    error: (message2, ...details) => {
      console.error("\u24C2\uFE0F  ", message2, ...details);
    },
    info: (message2, ...details) => {
      console.info("\u24C2\uFE0F  ", message2, ...details);
    },
    group: (name) => {
      console.group("\u24C2\uFE0F  " + name);
    },
    groupEnd: (name) => {
      console.groupEnd("\u24C2\uFE0F  " + name);
    }
  };
  function metroError(message2, ...details) {
    metroConsole.error(message2, ...details);
    return new Error(message2, ...details);
  }
  function deepClone(object) {
    if (Array.isArray(object)) {
      return object.slice().map(deepClone);
    }
    if (object && typeof object === "object") {
      if (object.__proto__.constructor == Object || !object.__proto__) {
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
        } catch (error2) {
          lastError = error2;
          if (!errorCanRetry(error2, options) || attempt >= attempts || req.signal?.aborted) {
            throw error2;
          }
          const delay = retryDelay(options, attempt);
          traceEvent("retry scheduled", {
            severity: "warning",
            label: `${error2.name || "Error"}, ${formatDelay2(delay)}`,
            attempt,
            attempts,
            method: req.method,
            url: req.url,
            delay
          }, context);
          traceDiagnostic({
            severity: "warning",
            code: "retry",
            message: `Retrying ${req.method} ${displayURL(req.url)} after ${error2.message || error2}`,
            data: { attempt, attempts, delay, method: req.method, url: req.url, error: error2.message }
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
  function errorCanRetry(error2, options) {
    if (typeof options.onError == "function") {
      return options.onError(error2);
    }
    return error2?.name != "AbortError" && error2?.name != "TimeoutError";
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
        const error2 = signal.reason || abortError();
        traceDiagnostic({
          severity: "error",
          code: "aborted",
          message: error2.message || "Request was aborted",
          data: { method: req.method, url: req.url }
        }, context);
        throw error2;
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
  function abortError(message2 = "Request was aborted") {
    if (typeof DOMException != "undefined") {
      return new DOMException(message2, "AbortError");
    }
    const error2 = new Error(message2);
    error2.name = "AbortError";
    return error2;
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
      } catch (error2) {
        if (controller.signal.aborted) {
          traceDiagnostic({
            severity: "error",
            code: "timeout",
            message: `Request timed out after ${ms}ms`,
            data: { method: req.method, url: req.url, ms }
          }, context);
        }
        throw error2;
      } finally {
        clearTimeout(timer);
      }
    }
    timeout.traceName = options.name;
    return timeout;
  }
  function timeoutError(ms) {
    const error2 = new Error(`Request timed out after ${ms}ms`);
    error2.name = "TimeoutError";
    error2.code = "ETIMEDOUT";
    return error2;
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
  var badRequest = (error2) => {
    return {
      status: error2.code,
      statusText: error2.message,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(error2)
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
    return async function error2(req) {
      let url2 = url(req.url);
      if (status[url2.pathname]) {
        let error3 = {
          code: parseInt(url2.pathname.substring(1)),
          message: customStatus[url2.pathname]
        };
        return response(badRequest(error3));
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
    error(error2, req, middleware, context = null) {
      const state = this.state(context);
      const span = state.stack.pop();
      if (!span) {
        return;
      }
      span.end = now();
      span.duration = span.end - span.start;
      span.status = "error";
      span.severity = "error";
      span.error = errorSummary(error2);
      this.store.saveSpan(span);
      const message2 = error2?.message || "Middleware failed";
      const trace = this.store.read(span.traceId);
      const alreadyReported = trace?.diagnostics?.some((diagnostic) => diagnostic.data?.errorMessage == message2);
      if (span.kind == "fetch" || !alreadyReported) {
        this.diagnostic({
          traceId: span.traceId,
          spanId: span.spanId,
          severity: "error",
          code: span.kind == "fetch" ? "network-error" : "middleware-error",
          message: message2,
          data: {
            middleware: middlewareName(middleware),
            method: req?.method,
            url: safeURL(req?.url),
            name: error2?.name,
            errorMessage: message2
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
      } catch (error2) {
        this.error(error2, null, { name }, context);
        throw error2;
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
  function errorSummary(error2) {
    return {
      name: error2?.name,
      message: error2?.message || String(error2),
      stack: error2?.stack
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
    info: (message2, ...details) => console.info("\u24C2\uFE0F  ", message2, ...details),
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
      error: (error2) => {
        metroConsole2.info(error2);
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

  // ../metro/src/index.mjs
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
  if (!globalThis.metro) {
    globalThis.metro = metro;
  }
  var src_default3 = metro;

  // ../../node_modules/@muze-nl/assert/src/assert.mjs
  globalThis.assertEnabled = false;
  function enable() {
    globalThis.assertEnabled = true;
  }
  function disable() {
    globalThis.assertEnabled = false;
  }
  function assert(source, test) {
    if (globalThis.assertEnabled) {
      let problems = fails(source, test);
      if (problems) {
        console.error("\u{1F170}\uFE0F  Assertions failed because of:", problems, "in this source:", source);
        throw new Error("Assertions failed", {
          cause: { problems, source }
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
      for (let value of data) {
        if (oneOf(...patterns)(value)) {
          return error("data does not match anyOf patterns", value, patterns, path);
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
  function fails(data, pattern, root, path = "") {
    if (!root) {
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
        let index = data.findIndex((element, index2) => fails(element, pattern, root, path + "[" + index2 + "]"));
        if (index > -1) {
          problems.push(error("data[" + index + "] does not match pattern", data[index], pattern, path + "[" + index + "]"));
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
      }
      for (let p of pattern) {
        for (let index of data.keys()) {
          let problem = fails(data[index], p, root, path + "[" + index + "]");
          if (Array.isArray(problem)) {
            problems = problems.concat(problem);
          } else if (problem) {
            problems.push(problem);
          }
        }
      }
    } else if (pattern && typeof pattern == "object") {
      if (Array.isArray(data)) {
        let index = data.findIndex((element, index2) => fails(element, pattern, root, path + "[" + index2 + "]"));
        if (index > -1) {
          problems.push(error("data[" + index + "] does not match pattern", data[index], pattern, path + "[" + index + "]"));
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
            let result = fails(data[patternKey], subpattern, root, path + "." + patternKey);
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
  function error(message2, found, expected, path, problems) {
    let result = {
      path,
      message: message2,
      found,
      expected
    };
    if (problems) {
      result.problems = problems;
    }
    return result;
  }
  function warn(message2, data, pattern, path) {
    console.warn("\u{1F170}\uFE0F  Assert: " + path, message2, pattern, data);
  }
  globalThis.assert = {
    warn,
    error,
    assert,
    enable,
    disable,
    Required,
    Recommended,
    Optional,
    oneOf,
    anyOf,
    allOf,
    validURL,
    validEmail,
    instanceOf,
    not,
    fails
  };

  // src/oidc.util.mjs
  var MustHave = (...options) => (value, root) => {
    if (options.filter((o) => root.hasOwnKey(o)).length > 0) {
      return false;
    }
    return error("root data must have all of", root, options);
  };
  var MustInclude = (...options) => (value) => {
    if (Array.isArray(value) && options.filter((o) => !value.includes(o)).length == 0) {
      return false;
    } else {
      return error("data must be an array which includes", value, options);
    }
  };
  var validJWA = [
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
    "none",
    "client_secret_post",
    "client_secret_basic",
    "client_secret_jwt",
    "private_key_jwt"
  ];

  // src/oidc.discovery.mjs
  async function oidcDiscovery(options = {}) {
    assert(options, {
      client: Optional(instanceOf(src_default3.client().constructor)),
      issuer: Required(validURL)
    });
    const defaultOptions = {
      client: src_default3.client().with(throwermw()).with(jsonmw()),
      requireDynamicRegistration: false
    };
    options = Object.assign({}, defaultOptions, options);
    options.client = options.client.with(throwermw()).with(jsonmw());
    const TestSucceeded = false;
    function MustUseHTTPS(url2) {
      return TestSucceeded;
    }
    const openid_provider_metadata = {
      issuer: Required(allOf(options.issuer, MustUseHTTPS)),
      authorization_endpoint: Required(validURL),
      token_endpoint: Required(validURL),
      userinfo_endpoint: Recommended(validURL),
      // todo: test for https protocol
      jwks_uri: Required(validURL),
      registration_endpoint: options.requireDynamicRegistration ? Required(validURL) : Recommended(validURL),
      scopes_supported: Recommended(MustInclude("openid")),
      response_types_supported: options.requireDynamicRegistration ? Required(MustInclude("code", "id_token", "id_token token")) : Required([]),
      response_modes_supported: Optional([]),
      grant_types_supported: options.requireDynamicRegistration ? Optional(MustInclude("authorization_code")) : Optional([]),
      acr_values_supported: Optional([]),
      subject_types_supported: Required([]),
      id_token_signing_alg_values_supported: Required(MustInclude("RS256")),
      id_token_encryption_alg_values_supported: Optional([]),
      id_token_encryption_enc_values_supported: Optional([]),
      userinfo_signing_alg_values_supported: Optional([]),
      userinfo_encryption_alg_values_supported: Optional([]),
      userinfo_encryption_enc_values_supported: Optional([]),
      request_object_signing_alg_values_supported: Optional(MustInclude("RS256")),
      // not testing for 'none'
      request_object_encryption_alg_values_supported: Optional([]),
      request_object_encryption_enc_values_supported: Optional([]),
      token_endpoint_auth_methods_supported: Optional(anyOf(...validAuthMethods)),
      token_endpoint_auth_signing_alg_values_supported: Optional(MustInclude("RS256"), not(MustInclude("none"))),
      display_values_supported: Optional(anyOf("page", "popup", "touch", "wap")),
      claim_types_supported: Optional(anyOf("normal", "aggregated", "distributed")),
      claims_supported: Recommended([]),
      service_documentation: Optional(validURL),
      claims_locales_supported: Optional([]),
      ui_locales_supported: Optional([]),
      claims_parameter_supported: Optional(Boolean),
      request_parameter_supported: Optional(Boolean),
      request_uri_parameter_supported: Optional(Boolean),
      op_policy_uri: Optional(validURL),
      op_tos_uri: Optional(validURL)
    };
    const configURL = src_default3.url(options.issuer, ".well-known/openid-configuration");
    const response2 = await options.client.get(
      // https://openid.net/specs/openid-connect-discovery-1_0.html#ProviderConfigurationRequest
      // note: this allows path components in the options.issuer url
      configURL
    );
    const openid_config = response2.data;
    assert(openid_config, openid_provider_metadata);
    assert(openid_config.issuer, options.issuer);
    return openid_config;
  }

  // src/oidc.register.mjs
  async function register(options) {
    const openid_client_metadata = {
      redirect_uris: Required([validURL]),
      response_types: Optional([]),
      grant_types: Optional(anyOf("authorization_code", "refresh_token")),
      //TODO: match response_types with grant_types
      application_type: Optional(oneOf("native", "web")),
      contacts: Optional([validEmail]),
      client_name: Optional(String),
      logo_uri: Optional(validURL),
      client_uri: Optional(validURL),
      policy_uri: Optional(validURL),
      tos_uri: Optional(validURL),
      jwks_uri: Optional(validURL, not(MustHave("jwks"))),
      jwks: Optional(validURL, not(MustHave("jwks_uri"))),
      sector_identifier_uri: Optional(validURL),
      subject_type: Optional(String),
      id_token_signed_response_alg: Optional(oneOf(...validJWA)),
      id_token_encrypted_response_alg: Optional(oneOf(...validJWA)),
      id_token_encrypted_response_enc: Optional(oneOf(...validJWA), MustHave("id_token_encrypted_response_alg")),
      userinfo_signed_response_alg: Optional(oneOf(...validJWA)),
      userinfo_encrypted_response_alg: Optional(oneOf(...validJWA)),
      userinfo_encrypted_response_enc: Optional(oneOf(...validJWA), MustHave("userinfo_encrypted_response_alg")),
      request_object_signing_alg: Optional(oneOf(...validJWA)),
      request_object_encryption_alg: Optional(oneOf(...validJWA)),
      request_object_encryption_enc: Optional(oneOf(...validJWA)),
      token_endpoint_auth_method: Optional(oneOf(...validAuthMethods)),
      token_endpoint_auth_signing_alg: Optional(oneOf(...validJWA)),
      default_max_age: Optional(Number),
      require_auth_time: Optional(Boolean),
      default_acr_values: Optional([String]),
      initiate_login_uri: Optional([validURL]),
      request_uris: Optional([validURL])
    };
    assert(options, {
      client: Optional(instanceOf(src_default3.client().constructor)),
      registration_endpoint: validURL,
      client_info: openid_client_metadata
    });
    const defaultOptions = {
      client: src_default3.client().with(throwermw()).with(jsonmw()),
      client_info: {
        redirect_uris: [globalThis.document?.location.href]
      }
    };
    options = Object.assign({}, defaultOptions, options);
    options.client = options.client.with(throwermw()).with(jsonmw());
    if (!options.client_info) {
      options.client_info = {};
    }
    if (!options.client_info.redirect_uris) {
      options.client_info.redirect_uris = [globalThis.document?.location.href];
    }
    let response2 = await options.client.post(options.registration_endpoint, {
      body: options.client_info
    });
    let info = response2.data;
    if (!info.client_id) {
      throw src_default3.metroError("metro.oidc: Error: dynamic registration of client failed, no client_id returned", response2);
    }
    options.client_info = Object.assign(options.client_info, info);
    return options.client_info;
  }

  // ../metro-oauth2/src/tokenstore.mjs
  function tokenStore(site) {
    let localState, localTokens;
    if (typeof localStorage !== "undefined") {
      localState = {
        get: () => localStorage.getItem("metro/state:" + site),
        set: (value) => localStorage.setItem("metro/state:" + site, value),
        has: () => localStorage.getItem("metro/state:" + site) !== null,
        delete: () => localStorage.remoteItem("metro/state:" + site)
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

  // ../metro-oauth2/src/oauth2.mjs
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
    const oauth2 = Object.assign({}, defaultOptions.oauth2_configuration, options?.oauth2_configuration);
    options = Object.assign({}, defaultOptions, options);
    options.oauth2_configuration = oauth2;
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
    for (let option in oauth2) {
      switch (option) {
        case "access_token":
        case "authorization_code":
        case "refresh_token":
          options.tokens.set(option, normalizeInitialToken(option, oauth2[option]));
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
    async function oauth2authorized(req, next) {
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
        req = request(req, {
          headers: {
            Authorization: accessToken.type + " " + accessToken.value
          }
        });
        return next(req);
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
      if (oauth2.grant_type === "authorization_code" && !options.tokens.has("authorization_code")) {
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
      if (!oauth2.authorization_endpoint) {
        throw metroError("oauth2mw: Missing options.oauth2_configuration.authorization_endpoint");
      }
      let url2 = url(oauth2.authorization_endpoint, { hash: "" });
      assert(oauth2, {
        client_id: /.+/,
        redirect_uri: /.+/,
        scope: /.*/
      });
      let search = {
        response_type: "code",
        client_id: oauth2.client_id,
        redirect_uri: oauth2.redirect_uri,
        state: oauth2.state || createState(40)
      };
      if (oauth2.response_type) {
        search.response_type = oauth2.response_type;
      }
      if (oauth2.response_mode) {
        search.response_mode = oauth2.response_mode;
      }
      options.state.set(search.state);
      if (oauth2.code_verifier) {
        options.tokens.set("code_verifier", oauth2.code_verifier);
        search.code_challenge = await generateCodeChallenge(oauth2.code_verifier);
        search.code_challenge_method = "S256";
      }
      if (oauth2.scope) {
        search.scope = oauth2.scope;
      }
      if (oauth2.prompt) {
        search.prompt = oauth2.prompt;
      }
      if (oauth2.nonce) {
        search.nonce = oauth2.nonce;
      }
      return url(url2, { search });
    }
    function getAccessTokenRequest(grant_type = null) {
      assert(oauth2, {
        client_id: /.+/,
        redirect_uri: /.+/
      });
      if (!oauth2.token_endpoint) {
        throw metroError("oauth2mw: Missing options.endpoints.token url");
      }
      let url2 = url(oauth2.token_endpoint, { hash: "" });
      let params = {
        grant_type: grant_type || oauth2.grant_type
      };
      let headers = {};
      applyTokenEndpointAuthentication(params, headers);
      if (oauth2.scope) {
        params.scope = oauth2.scope;
      }
      switch (params.grant_type) {
        case "authorization_code":
          params.redirect_uri = oauth2.redirect_uri;
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
      const method = tokenEndpointAuthMethod(oauth2);
      if (method === "none") {
        params.client_id = oauth2.client_id;
        return;
      }
      if (!oauth2.client_secret) {
        throw metroError("oauth2mw: token_endpoint_auth_method " + method + " requires oauth2_configuration.client_secret");
      }
      if (method === "client_secret_post") {
        params.client_id = oauth2.client_id;
        params.client_secret = oauth2.client_secret;
        return;
      }
      if (method === "client_secret_basic") {
        headers.Authorization = basicAuth(oauth2.client_id, oauth2.client_secret);
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
  function tokenEndpointAuthMethod(oauth2) {
    const method = oauth2.token_endpoint_auth_method || (oauth2.client_secret ? "client_secret_post" : "none");
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
    let now2 = /* @__PURE__ */ new Date();
    return now2.getTime() > expires.getTime();
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
    const encoder3 = new TextEncoder();
    const data = encoder3.encode(code_verifier);
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
    constructor(message2) {
      var _a;
      super(message2 !== null && message2 !== void 0 ? message2 : "operation not supported");
      this.name = this.constructor.name;
      (_a = Error.captureStackTrace) === null || _a === void 0 ? void 0 : _a.call(Error, this, this.constructor);
    }
  };
  var OperationProcessingError = class extends Error {
    constructor(message2) {
      var _a;
      super(message2);
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

  // ../metro-oauth2/src/keysstore.mjs
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

  // ../metro-oauth2/src/oauth2.dpop.mjs
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
      const url2 = src_default3.url(req.url);
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

  // src/oidc.store.mjs
  function oidcStore(site) {
    let store;
    if (typeof localStorage !== "undefined") {
      store = {
        get: (name) => JSON.parse(localStorage.getItem("metro/oidc:" + site + ":" + name)),
        set: (name, value) => localStorage.setItem("metro/oidc:" + site + ":" + name, JSON.stringify(value)),
        has: (name) => localStorage.getItem("metro/oidc:" + site + ":" + name) !== null
      };
    } else {
      let storeMap = /* @__PURE__ */ new Map();
      store = {
        get: (name) => JSON.parse(storeMap.get("metro/oidc:" + site + ":" + name) || null),
        set: (name, value) => storeMap.set("metro/oidc:" + site + ":" + name, JSON.stringify(value)),
        has: (name) => storeMap.has("metro/oidc:" + site + ":" + name)
      };
    }
    return store;
  }

  // ../../node_modules/jose/dist/webapi/lib/buffer_utils.js
  var encoder2 = new TextEncoder();
  var decoder2 = new TextDecoder();
  var MAX_INT32 = 2 ** 32;
  function concat(...buffers) {
    const size = buffers.reduce((acc, { length }) => acc + length, 0);
    const buf2 = new Uint8Array(size);
    let i = 0;
    for (const buffer of buffers) {
      buf2.set(buffer, i);
      i += buffer.length;
    }
    return buf2;
  }
  function encode(string) {
    const bytes = new Uint8Array(string.length);
    for (let i = 0; i < string.length; i++) {
      const code = string.charCodeAt(i);
      if (code > 127) {
        throw new TypeError("non-ASCII string encountered in encode()");
      }
      bytes[i] = code;
    }
    return bytes;
  }

  // ../../node_modules/jose/dist/webapi/lib/base64.js
  function decodeBase64(encoded) {
    if (Uint8Array.fromBase64) {
      return Uint8Array.fromBase64(encoded);
    }
    const binary = atob(encoded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  // ../../node_modules/jose/dist/webapi/util/base64url.js
  function decode(input) {
    if (Uint8Array.fromBase64) {
      return Uint8Array.fromBase64(typeof input === "string" ? input : decoder2.decode(input), {
        alphabet: "base64url"
      });
    }
    let encoded = input;
    if (encoded instanceof Uint8Array) {
      encoded = decoder2.decode(encoded);
    }
    encoded = encoded.replace(/-/g, "+").replace(/_/g, "/");
    try {
      return decodeBase64(encoded);
    } catch {
      throw new TypeError("The input to be decoded is not correctly encoded.");
    }
  }

  // ../../node_modules/jose/dist/webapi/lib/crypto_key.js
  var unusable = (name, prop = "algorithm.name") => new TypeError(`CryptoKey does not support this operation, its ${prop} must be ${name}`);
  var isAlgorithm = (algorithm, name) => algorithm.name === name;
  function getHashLength(hash) {
    return parseInt(hash.name.slice(4), 10);
  }
  function checkHashLength(algorithm, expected) {
    const actual = getHashLength(algorithm.hash);
    if (actual !== expected)
      throw unusable(`SHA-${expected}`, "algorithm.hash");
  }
  function getNamedCurve(alg) {
    switch (alg) {
      case "ES256":
        return "P-256";
      case "ES384":
        return "P-384";
      case "ES512":
        return "P-521";
      default:
        throw new Error("unreachable");
    }
  }
  function checkUsage(key, usage) {
    if (usage && !key.usages.includes(usage)) {
      throw new TypeError(`CryptoKey does not support this operation, its usages must include ${usage}.`);
    }
  }
  function checkSigCryptoKey(key, alg, usage) {
    switch (alg) {
      case "HS256":
      case "HS384":
      case "HS512": {
        if (!isAlgorithm(key.algorithm, "HMAC"))
          throw unusable("HMAC");
        checkHashLength(key.algorithm, parseInt(alg.slice(2), 10));
        break;
      }
      case "RS256":
      case "RS384":
      case "RS512": {
        if (!isAlgorithm(key.algorithm, "RSASSA-PKCS1-v1_5"))
          throw unusable("RSASSA-PKCS1-v1_5");
        checkHashLength(key.algorithm, parseInt(alg.slice(2), 10));
        break;
      }
      case "PS256":
      case "PS384":
      case "PS512": {
        if (!isAlgorithm(key.algorithm, "RSA-PSS"))
          throw unusable("RSA-PSS");
        checkHashLength(key.algorithm, parseInt(alg.slice(2), 10));
        break;
      }
      case "Ed25519":
      case "EdDSA": {
        if (!isAlgorithm(key.algorithm, "Ed25519"))
          throw unusable("Ed25519");
        break;
      }
      case "ML-DSA-44":
      case "ML-DSA-65":
      case "ML-DSA-87": {
        if (!isAlgorithm(key.algorithm, alg))
          throw unusable(alg);
        break;
      }
      case "ES256":
      case "ES384":
      case "ES512": {
        if (!isAlgorithm(key.algorithm, "ECDSA"))
          throw unusable("ECDSA");
        const expected = getNamedCurve(alg);
        const actual = key.algorithm.namedCurve;
        if (actual !== expected)
          throw unusable(expected, "algorithm.namedCurve");
        break;
      }
      default:
        throw new TypeError("CryptoKey does not support this operation");
    }
    checkUsage(key, usage);
  }

  // ../../node_modules/jose/dist/webapi/lib/invalid_key_input.js
  function message(msg, actual, ...types) {
    types = types.filter(Boolean);
    if (types.length > 2) {
      const last = types.pop();
      msg += `one of type ${types.join(", ")}, or ${last}.`;
    } else if (types.length === 2) {
      msg += `one of type ${types[0]} or ${types[1]}.`;
    } else {
      msg += `of type ${types[0]}.`;
    }
    if (actual == null) {
      msg += ` Received ${actual}`;
    } else if (typeof actual === "function" && actual.name) {
      msg += ` Received function ${actual.name}`;
    } else if (typeof actual === "object" && actual != null) {
      if (actual.constructor?.name) {
        msg += ` Received an instance of ${actual.constructor.name}`;
      }
    }
    return msg;
  }
  var invalidKeyInput = (actual, ...types) => message("Key must be ", actual, ...types);
  var withAlg = (alg, actual, ...types) => message(`Key for the ${alg} algorithm must be `, actual, ...types);

  // ../../node_modules/jose/dist/webapi/util/errors.js
  var JOSEError = class extends Error {
    static code = "ERR_JOSE_GENERIC";
    code = "ERR_JOSE_GENERIC";
    constructor(message2, options) {
      super(message2, options);
      this.name = this.constructor.name;
      Error.captureStackTrace?.(this, this.constructor);
    }
  };
  var JWTClaimValidationFailed = class extends JOSEError {
    static code = "ERR_JWT_CLAIM_VALIDATION_FAILED";
    code = "ERR_JWT_CLAIM_VALIDATION_FAILED";
    claim;
    reason;
    payload;
    constructor(message2, payload, claim = "unspecified", reason = "unspecified") {
      super(message2, { cause: { claim, reason, payload } });
      this.claim = claim;
      this.reason = reason;
      this.payload = payload;
    }
  };
  var JWTExpired = class extends JOSEError {
    static code = "ERR_JWT_EXPIRED";
    code = "ERR_JWT_EXPIRED";
    claim;
    reason;
    payload;
    constructor(message2, payload, claim = "unspecified", reason = "unspecified") {
      super(message2, { cause: { claim, reason, payload } });
      this.claim = claim;
      this.reason = reason;
      this.payload = payload;
    }
  };
  var JOSEAlgNotAllowed = class extends JOSEError {
    static code = "ERR_JOSE_ALG_NOT_ALLOWED";
    code = "ERR_JOSE_ALG_NOT_ALLOWED";
  };
  var JOSENotSupported = class extends JOSEError {
    static code = "ERR_JOSE_NOT_SUPPORTED";
    code = "ERR_JOSE_NOT_SUPPORTED";
  };
  var JWSInvalid = class extends JOSEError {
    static code = "ERR_JWS_INVALID";
    code = "ERR_JWS_INVALID";
  };
  var JWTInvalid = class extends JOSEError {
    static code = "ERR_JWT_INVALID";
    code = "ERR_JWT_INVALID";
  };
  var JWKSInvalid = class extends JOSEError {
    static code = "ERR_JWKS_INVALID";
    code = "ERR_JWKS_INVALID";
  };
  var JWKSNoMatchingKey = class extends JOSEError {
    static code = "ERR_JWKS_NO_MATCHING_KEY";
    code = "ERR_JWKS_NO_MATCHING_KEY";
    constructor(message2 = "no applicable key found in the JSON Web Key Set", options) {
      super(message2, options);
    }
  };
  var JWKSMultipleMatchingKeys = class extends JOSEError {
    [Symbol.asyncIterator];
    static code = "ERR_JWKS_MULTIPLE_MATCHING_KEYS";
    code = "ERR_JWKS_MULTIPLE_MATCHING_KEYS";
    constructor(message2 = "multiple matching keys found in the JSON Web Key Set", options) {
      super(message2, options);
    }
  };
  var JWSSignatureVerificationFailed = class extends JOSEError {
    static code = "ERR_JWS_SIGNATURE_VERIFICATION_FAILED";
    code = "ERR_JWS_SIGNATURE_VERIFICATION_FAILED";
    constructor(message2 = "signature verification failed", options) {
      super(message2, options);
    }
  };

  // ../../node_modules/jose/dist/webapi/lib/is_key_like.js
  var isCryptoKey2 = (key) => {
    if (key?.[Symbol.toStringTag] === "CryptoKey")
      return true;
    try {
      return key instanceof CryptoKey;
    } catch {
      return false;
    }
  };
  var isKeyObject = (key) => key?.[Symbol.toStringTag] === "KeyObject";
  var isKeyLike = (key) => isCryptoKey2(key) || isKeyObject(key);

  // ../../node_modules/jose/dist/webapi/lib/helpers.js
  function decodeBase64url(value, label, ErrorClass) {
    try {
      return decode(value);
    } catch {
      throw new ErrorClass(`Failed to base64url decode the ${label}`);
    }
  }

  // ../../node_modules/jose/dist/webapi/lib/type_checks.js
  var isObjectLike = (value) => typeof value === "object" && value !== null;
  function isObject(input) {
    if (!isObjectLike(input) || Object.prototype.toString.call(input) !== "[object Object]") {
      return false;
    }
    if (Object.getPrototypeOf(input) === null) {
      return true;
    }
    let proto = input;
    while (Object.getPrototypeOf(proto) !== null) {
      proto = Object.getPrototypeOf(proto);
    }
    return Object.getPrototypeOf(input) === proto;
  }
  function isDisjoint(...headers) {
    const sources = headers.filter(Boolean);
    if (sources.length === 0 || sources.length === 1) {
      return true;
    }
    let acc;
    for (const header of sources) {
      const parameters = Object.keys(header);
      if (!acc || acc.size === 0) {
        acc = new Set(parameters);
        continue;
      }
      for (const parameter of parameters) {
        if (acc.has(parameter)) {
          return false;
        }
        acc.add(parameter);
      }
    }
    return true;
  }
  var isJWK = (key) => isObject(key) && typeof key.kty === "string";
  var isPrivateJWK = (key) => key.kty !== "oct" && (key.kty === "AKP" && typeof key.priv === "string" || typeof key.d === "string");
  var isPublicJWK = (key) => key.kty !== "oct" && key.d === void 0 && key.priv === void 0;
  var isSecretJWK = (key) => key.kty === "oct" && typeof key.k === "string";

  // ../../node_modules/jose/dist/webapi/lib/signing.js
  function checkKeyLength(alg, key) {
    if (alg.startsWith("RS") || alg.startsWith("PS")) {
      const { modulusLength } = key.algorithm;
      if (typeof modulusLength !== "number" || modulusLength < 2048) {
        throw new TypeError(`${alg} requires key modulusLength to be 2048 bits or larger`);
      }
    }
  }
  function subtleAlgorithm2(alg, algorithm) {
    const hash = `SHA-${alg.slice(-3)}`;
    switch (alg) {
      case "HS256":
      case "HS384":
      case "HS512":
        return { hash, name: "HMAC" };
      case "PS256":
      case "PS384":
      case "PS512":
        return { hash, name: "RSA-PSS", saltLength: parseInt(alg.slice(-3), 10) >> 3 };
      case "RS256":
      case "RS384":
      case "RS512":
        return { hash, name: "RSASSA-PKCS1-v1_5" };
      case "ES256":
      case "ES384":
      case "ES512":
        return { hash, name: "ECDSA", namedCurve: algorithm.namedCurve };
      case "Ed25519":
      case "EdDSA":
        return { name: "Ed25519" };
      case "ML-DSA-44":
      case "ML-DSA-65":
      case "ML-DSA-87":
        return { name: alg };
      default:
        throw new JOSENotSupported(`alg ${alg} is not supported either by JOSE or your javascript runtime`);
    }
  }
  async function getSigKey(alg, key, usage) {
    if (key instanceof Uint8Array) {
      if (!alg.startsWith("HS")) {
        throw new TypeError(invalidKeyInput(key, "CryptoKey", "KeyObject", "JSON Web Key"));
      }
      return crypto.subtle.importKey("raw", key, { hash: `SHA-${alg.slice(-3)}`, name: "HMAC" }, false, [usage]);
    }
    checkSigCryptoKey(key, alg, usage);
    return key;
  }
  async function verify(alg, key, signature, data) {
    const cryptoKey = await getSigKey(alg, key, "verify");
    checkKeyLength(alg, cryptoKey);
    const algorithm = subtleAlgorithm2(alg, cryptoKey.algorithm);
    try {
      return await crypto.subtle.verify(algorithm, cryptoKey, signature, data);
    } catch {
      return false;
    }
  }

  // ../../node_modules/jose/dist/webapi/lib/jwk_to_key.js
  var unsupportedAlg = 'Invalid or unsupported JWK "alg" (Algorithm) Parameter value';
  function subtleMapping(jwk) {
    let algorithm;
    let keyUsages;
    switch (jwk.kty) {
      case "AKP": {
        switch (jwk.alg) {
          case "ML-DSA-44":
          case "ML-DSA-65":
          case "ML-DSA-87":
            algorithm = { name: jwk.alg };
            keyUsages = jwk.priv ? ["sign"] : ["verify"];
            break;
          default:
            throw new JOSENotSupported(unsupportedAlg);
        }
        break;
      }
      case "RSA": {
        switch (jwk.alg) {
          case "PS256":
          case "PS384":
          case "PS512":
            algorithm = { name: "RSA-PSS", hash: `SHA-${jwk.alg.slice(-3)}` };
            keyUsages = jwk.d ? ["sign"] : ["verify"];
            break;
          case "RS256":
          case "RS384":
          case "RS512":
            algorithm = { name: "RSASSA-PKCS1-v1_5", hash: `SHA-${jwk.alg.slice(-3)}` };
            keyUsages = jwk.d ? ["sign"] : ["verify"];
            break;
          case "RSA-OAEP":
          case "RSA-OAEP-256":
          case "RSA-OAEP-384":
          case "RSA-OAEP-512":
            algorithm = {
              name: "RSA-OAEP",
              hash: `SHA-${parseInt(jwk.alg.slice(-3), 10) || 1}`
            };
            keyUsages = jwk.d ? ["decrypt", "unwrapKey"] : ["encrypt", "wrapKey"];
            break;
          default:
            throw new JOSENotSupported(unsupportedAlg);
        }
        break;
      }
      case "EC": {
        switch (jwk.alg) {
          case "ES256":
          case "ES384":
          case "ES512":
            algorithm = {
              name: "ECDSA",
              namedCurve: { ES256: "P-256", ES384: "P-384", ES512: "P-521" }[jwk.alg]
            };
            keyUsages = jwk.d ? ["sign"] : ["verify"];
            break;
          case "ECDH-ES":
          case "ECDH-ES+A128KW":
          case "ECDH-ES+A192KW":
          case "ECDH-ES+A256KW":
            algorithm = { name: "ECDH", namedCurve: jwk.crv };
            keyUsages = jwk.d ? ["deriveBits"] : [];
            break;
          default:
            throw new JOSENotSupported(unsupportedAlg);
        }
        break;
      }
      case "OKP": {
        switch (jwk.alg) {
          case "Ed25519":
          case "EdDSA":
            algorithm = { name: "Ed25519" };
            keyUsages = jwk.d ? ["sign"] : ["verify"];
            break;
          case "ECDH-ES":
          case "ECDH-ES+A128KW":
          case "ECDH-ES+A192KW":
          case "ECDH-ES+A256KW":
            algorithm = { name: jwk.crv };
            keyUsages = jwk.d ? ["deriveBits"] : [];
            break;
          default:
            throw new JOSENotSupported(unsupportedAlg);
        }
        break;
      }
      default:
        throw new JOSENotSupported('Invalid or unsupported JWK "kty" (Key Type) Parameter value');
    }
    return { algorithm, keyUsages };
  }
  async function jwkToKey(jwk) {
    if (!jwk.alg) {
      throw new TypeError('"alg" argument is required when "jwk.alg" is not present');
    }
    const { algorithm, keyUsages } = subtleMapping(jwk);
    const keyData = { ...jwk };
    if (keyData.kty !== "AKP") {
      delete keyData.alg;
    }
    delete keyData.use;
    return crypto.subtle.importKey("jwk", keyData, algorithm, jwk.ext ?? (jwk.d || jwk.priv ? false : true), jwk.key_ops ?? keyUsages);
  }

  // ../../node_modules/jose/dist/webapi/lib/normalize_key.js
  var unusableForAlg = "given KeyObject instance cannot be used for this algorithm";
  var cache;
  var handleJWK = async (key, jwk, alg, freeze = false) => {
    cache ||= /* @__PURE__ */ new WeakMap();
    let cached = cache.get(key);
    if (cached?.[alg]) {
      return cached[alg];
    }
    const cryptoKey = await jwkToKey({ ...jwk, alg });
    if (freeze)
      Object.freeze(key);
    if (!cached) {
      cache.set(key, { [alg]: cryptoKey });
    } else {
      cached[alg] = cryptoKey;
    }
    return cryptoKey;
  };
  var handleKeyObject = (keyObject, alg) => {
    cache ||= /* @__PURE__ */ new WeakMap();
    let cached = cache.get(keyObject);
    if (cached?.[alg]) {
      return cached[alg];
    }
    const isPublic = keyObject.type === "public";
    const extractable = isPublic ? true : false;
    let cryptoKey;
    if (keyObject.asymmetricKeyType === "x25519") {
      switch (alg) {
        case "ECDH-ES":
        case "ECDH-ES+A128KW":
        case "ECDH-ES+A192KW":
        case "ECDH-ES+A256KW":
          break;
        default:
          throw new TypeError(unusableForAlg);
      }
      cryptoKey = keyObject.toCryptoKey(keyObject.asymmetricKeyType, extractable, isPublic ? [] : ["deriveBits"]);
    }
    if (keyObject.asymmetricKeyType === "ed25519") {
      if (alg !== "EdDSA" && alg !== "Ed25519") {
        throw new TypeError(unusableForAlg);
      }
      cryptoKey = keyObject.toCryptoKey(keyObject.asymmetricKeyType, extractable, [
        isPublic ? "verify" : "sign"
      ]);
    }
    switch (keyObject.asymmetricKeyType) {
      case "ml-dsa-44":
      case "ml-dsa-65":
      case "ml-dsa-87": {
        if (alg !== keyObject.asymmetricKeyType.toUpperCase()) {
          throw new TypeError(unusableForAlg);
        }
        cryptoKey = keyObject.toCryptoKey(keyObject.asymmetricKeyType, extractable, [
          isPublic ? "verify" : "sign"
        ]);
      }
    }
    if (keyObject.asymmetricKeyType === "rsa") {
      let hash;
      switch (alg) {
        case "RSA-OAEP":
          hash = "SHA-1";
          break;
        case "RS256":
        case "PS256":
        case "RSA-OAEP-256":
          hash = "SHA-256";
          break;
        case "RS384":
        case "PS384":
        case "RSA-OAEP-384":
          hash = "SHA-384";
          break;
        case "RS512":
        case "PS512":
        case "RSA-OAEP-512":
          hash = "SHA-512";
          break;
        default:
          throw new TypeError(unusableForAlg);
      }
      if (alg.startsWith("RSA-OAEP")) {
        return keyObject.toCryptoKey({
          name: "RSA-OAEP",
          hash
        }, extractable, isPublic ? ["encrypt"] : ["decrypt"]);
      }
      cryptoKey = keyObject.toCryptoKey({
        name: alg.startsWith("PS") ? "RSA-PSS" : "RSASSA-PKCS1-v1_5",
        hash
      }, extractable, [isPublic ? "verify" : "sign"]);
    }
    if (keyObject.asymmetricKeyType === "ec") {
      const nist = /* @__PURE__ */ new Map([
        ["prime256v1", "P-256"],
        ["secp384r1", "P-384"],
        ["secp521r1", "P-521"]
      ]);
      const namedCurve = nist.get(keyObject.asymmetricKeyDetails?.namedCurve);
      if (!namedCurve) {
        throw new TypeError(unusableForAlg);
      }
      const expectedCurve = { ES256: "P-256", ES384: "P-384", ES512: "P-521" };
      if (expectedCurve[alg] && namedCurve === expectedCurve[alg]) {
        cryptoKey = keyObject.toCryptoKey({
          name: "ECDSA",
          namedCurve
        }, extractable, [isPublic ? "verify" : "sign"]);
      }
      if (alg.startsWith("ECDH-ES")) {
        cryptoKey = keyObject.toCryptoKey({
          name: "ECDH",
          namedCurve
        }, extractable, isPublic ? [] : ["deriveBits"]);
      }
    }
    if (!cryptoKey) {
      throw new TypeError(unusableForAlg);
    }
    if (!cached) {
      cache.set(keyObject, { [alg]: cryptoKey });
    } else {
      cached[alg] = cryptoKey;
    }
    return cryptoKey;
  };
  async function normalizeKey(key, alg) {
    if (key instanceof Uint8Array) {
      return key;
    }
    if (isCryptoKey2(key)) {
      return key;
    }
    if (isKeyObject(key)) {
      if (key.type === "secret") {
        return key.export();
      }
      if ("toCryptoKey" in key && typeof key.toCryptoKey === "function") {
        try {
          return handleKeyObject(key, alg);
        } catch (err) {
          if (err instanceof TypeError) {
            throw err;
          }
        }
      }
      let jwk = key.export({ format: "jwk" });
      return handleJWK(key, jwk, alg);
    }
    if (isJWK(key)) {
      if (key.k) {
        return decode(key.k);
      }
      return handleJWK(key, key, alg, true);
    }
    throw new Error("unreachable");
  }

  // ../../node_modules/jose/dist/webapi/key/import.js
  async function importJWK(jwk, alg, options) {
    if (!isObject(jwk)) {
      throw new TypeError("JWK must be an object");
    }
    let ext;
    alg ??= jwk.alg;
    ext ??= options?.extractable ?? jwk.ext;
    switch (jwk.kty) {
      case "oct":
        if (typeof jwk.k !== "string" || !jwk.k) {
          throw new TypeError('missing "k" (Key Value) Parameter value');
        }
        return decode(jwk.k);
      case "RSA":
        if ("oth" in jwk && jwk.oth !== void 0) {
          throw new JOSENotSupported('RSA JWK "oth" (Other Primes Info) Parameter value is not supported');
        }
        return jwkToKey({ ...jwk, alg, ext });
      case "AKP": {
        if (typeof jwk.alg !== "string" || !jwk.alg) {
          throw new TypeError('missing "alg" (Algorithm) Parameter value');
        }
        if (alg !== void 0 && alg !== jwk.alg) {
          throw new TypeError("JWK alg and alg option value mismatch");
        }
        return jwkToKey({ ...jwk, ext });
      }
      case "EC":
      case "OKP":
        return jwkToKey({ ...jwk, alg, ext });
      default:
        throw new JOSENotSupported('Unsupported "kty" (Key Type) Parameter value');
    }
  }

  // ../../node_modules/jose/dist/webapi/lib/validate_crit.js
  function validateCrit(Err, recognizedDefault, recognizedOption, protectedHeader, joseHeader) {
    if (joseHeader.crit !== void 0 && protectedHeader?.crit === void 0) {
      throw new Err('"crit" (Critical) Header Parameter MUST be integrity protected');
    }
    if (!protectedHeader || protectedHeader.crit === void 0) {
      return /* @__PURE__ */ new Set();
    }
    if (!Array.isArray(protectedHeader.crit) || protectedHeader.crit.length === 0 || protectedHeader.crit.some((input) => typeof input !== "string" || input.length === 0)) {
      throw new Err('"crit" (Critical) Header Parameter MUST be an array of non-empty strings when present');
    }
    let recognized;
    if (recognizedOption !== void 0) {
      recognized = new Map([...Object.entries(recognizedOption), ...recognizedDefault.entries()]);
    } else {
      recognized = recognizedDefault;
    }
    for (const parameter of protectedHeader.crit) {
      if (!recognized.has(parameter)) {
        throw new JOSENotSupported(`Extension Header Parameter "${parameter}" is not recognized`);
      }
      if (joseHeader[parameter] === void 0) {
        throw new Err(`Extension Header Parameter "${parameter}" is missing`);
      }
      if (recognized.get(parameter) && protectedHeader[parameter] === void 0) {
        throw new Err(`Extension Header Parameter "${parameter}" MUST be integrity protected`);
      }
    }
    return new Set(protectedHeader.crit);
  }

  // ../../node_modules/jose/dist/webapi/lib/validate_algorithms.js
  function validateAlgorithms(option, algorithms) {
    if (algorithms !== void 0 && (!Array.isArray(algorithms) || algorithms.some((s) => typeof s !== "string"))) {
      throw new TypeError(`"${option}" option must be an array of strings`);
    }
    if (!algorithms) {
      return void 0;
    }
    return new Set(algorithms);
  }

  // ../../node_modules/jose/dist/webapi/lib/check_key_type.js
  var tag = (key) => key?.[Symbol.toStringTag];
  var jwkMatchesOp = (alg, key, usage) => {
    if (key.use !== void 0) {
      let expected;
      switch (usage) {
        case "sign":
        case "verify":
          expected = "sig";
          break;
        case "encrypt":
        case "decrypt":
          expected = "enc";
          break;
      }
      if (key.use !== expected) {
        throw new TypeError(`Invalid key for this operation, its "use" must be "${expected}" when present`);
      }
    }
    if (key.alg !== void 0 && key.alg !== alg) {
      throw new TypeError(`Invalid key for this operation, its "alg" must be "${alg}" when present`);
    }
    if (Array.isArray(key.key_ops)) {
      let expectedKeyOp;
      switch (true) {
        case (usage === "sign" || usage === "verify"):
        case alg === "dir":
        case alg.includes("CBC-HS"):
          expectedKeyOp = usage;
          break;
        case alg.startsWith("PBES2"):
          expectedKeyOp = "deriveBits";
          break;
        case /^A\d{3}(?:GCM)?(?:KW)?$/.test(alg):
          if (!alg.includes("GCM") && alg.endsWith("KW")) {
            expectedKeyOp = usage === "encrypt" ? "wrapKey" : "unwrapKey";
          } else {
            expectedKeyOp = usage;
          }
          break;
        case (usage === "encrypt" && alg.startsWith("RSA")):
          expectedKeyOp = "wrapKey";
          break;
        case usage === "decrypt":
          expectedKeyOp = alg.startsWith("RSA") ? "unwrapKey" : "deriveBits";
          break;
      }
      if (expectedKeyOp && key.key_ops?.includes?.(expectedKeyOp) === false) {
        throw new TypeError(`Invalid key for this operation, its "key_ops" must include "${expectedKeyOp}" when present`);
      }
    }
    return true;
  };
  var symmetricTypeCheck = (alg, key, usage) => {
    if (key instanceof Uint8Array)
      return;
    if (isJWK(key)) {
      if (isSecretJWK(key) && jwkMatchesOp(alg, key, usage))
        return;
      throw new TypeError(`JSON Web Key for symmetric algorithms must have JWK "kty" (Key Type) equal to "oct" and the JWK "k" (Key Value) present`);
    }
    if (!isKeyLike(key)) {
      throw new TypeError(withAlg(alg, key, "CryptoKey", "KeyObject", "JSON Web Key", "Uint8Array"));
    }
    if (key.type !== "secret") {
      throw new TypeError(`${tag(key)} instances for symmetric algorithms must be of type "secret"`);
    }
  };
  var asymmetricTypeCheck = (alg, key, usage) => {
    if (isJWK(key)) {
      switch (usage) {
        case "decrypt":
        case "sign":
          if (isPrivateJWK(key) && jwkMatchesOp(alg, key, usage))
            return;
          throw new TypeError(`JSON Web Key for this operation must be a private JWK`);
        case "encrypt":
        case "verify":
          if (isPublicJWK(key) && jwkMatchesOp(alg, key, usage))
            return;
          throw new TypeError(`JSON Web Key for this operation must be a public JWK`);
      }
    }
    if (!isKeyLike(key)) {
      throw new TypeError(withAlg(alg, key, "CryptoKey", "KeyObject", "JSON Web Key"));
    }
    if (key.type === "secret") {
      throw new TypeError(`${tag(key)} instances for asymmetric algorithms must not be of type "secret"`);
    }
    if (key.type === "public") {
      switch (usage) {
        case "sign":
          throw new TypeError(`${tag(key)} instances for asymmetric algorithm signing must be of type "private"`);
        case "decrypt":
          throw new TypeError(`${tag(key)} instances for asymmetric algorithm decryption must be of type "private"`);
      }
    }
    if (key.type === "private") {
      switch (usage) {
        case "verify":
          throw new TypeError(`${tag(key)} instances for asymmetric algorithm verifying must be of type "public"`);
        case "encrypt":
          throw new TypeError(`${tag(key)} instances for asymmetric algorithm encryption must be of type "public"`);
      }
    }
  };
  function checkKeyType(alg, key, usage) {
    switch (alg.substring(0, 2)) {
      case "A1":
      case "A2":
      case "di":
      case "HS":
      case "PB":
        symmetricTypeCheck(alg, key, usage);
        break;
      default:
        asymmetricTypeCheck(alg, key, usage);
    }
  }

  // ../../node_modules/jose/dist/webapi/jws/flattened/verify.js
  async function flattenedVerify(jws, key, options) {
    if (!isObject(jws)) {
      throw new JWSInvalid("Flattened JWS must be an object");
    }
    if (jws.protected === void 0 && jws.header === void 0) {
      throw new JWSInvalid('Flattened JWS must have either of the "protected" or "header" members');
    }
    if (jws.protected !== void 0 && typeof jws.protected !== "string") {
      throw new JWSInvalid("JWS Protected Header incorrect type");
    }
    if (jws.payload === void 0) {
      throw new JWSInvalid("JWS Payload missing");
    }
    if (typeof jws.signature !== "string") {
      throw new JWSInvalid("JWS Signature missing or incorrect type");
    }
    if (jws.header !== void 0 && !isObject(jws.header)) {
      throw new JWSInvalid("JWS Unprotected Header incorrect type");
    }
    let parsedProt = {};
    if (jws.protected) {
      try {
        const protectedHeader = decode(jws.protected);
        parsedProt = JSON.parse(decoder2.decode(protectedHeader));
      } catch {
        throw new JWSInvalid("JWS Protected Header is invalid");
      }
    }
    if (!isDisjoint(parsedProt, jws.header)) {
      throw new JWSInvalid("JWS Protected and JWS Unprotected Header Parameter names must be disjoint");
    }
    const joseHeader = {
      ...parsedProt,
      ...jws.header
    };
    const extensions = validateCrit(JWSInvalid, /* @__PURE__ */ new Map([["b64", true]]), options?.crit, parsedProt, joseHeader);
    let b64 = true;
    if (extensions.has("b64")) {
      b64 = parsedProt.b64;
      if (typeof b64 !== "boolean") {
        throw new JWSInvalid('The "b64" (base64url-encode payload) Header Parameter must be a boolean');
      }
    }
    const { alg } = joseHeader;
    if (typeof alg !== "string" || !alg) {
      throw new JWSInvalid('JWS "alg" (Algorithm) Header Parameter missing or invalid');
    }
    const algorithms = options && validateAlgorithms("algorithms", options.algorithms);
    if (algorithms && !algorithms.has(alg)) {
      throw new JOSEAlgNotAllowed('"alg" (Algorithm) Header Parameter value not allowed');
    }
    if (b64) {
      if (typeof jws.payload !== "string") {
        throw new JWSInvalid("JWS Payload must be a string");
      }
    } else if (typeof jws.payload !== "string" && !(jws.payload instanceof Uint8Array)) {
      throw new JWSInvalid("JWS Payload must be a string or an Uint8Array instance");
    }
    let resolvedKey = false;
    if (typeof key === "function") {
      key = await key(parsedProt, jws);
      resolvedKey = true;
    }
    checkKeyType(alg, key, "verify");
    const data = concat(jws.protected !== void 0 ? encode(jws.protected) : new Uint8Array(), encode("."), typeof jws.payload === "string" ? b64 ? encode(jws.payload) : encoder2.encode(jws.payload) : jws.payload);
    const signature = decodeBase64url(jws.signature, "signature", JWSInvalid);
    const k = await normalizeKey(key, alg);
    const verified = await verify(alg, k, signature, data);
    if (!verified) {
      throw new JWSSignatureVerificationFailed();
    }
    let payload;
    if (b64) {
      payload = decodeBase64url(jws.payload, "payload", JWSInvalid);
    } else if (typeof jws.payload === "string") {
      payload = encoder2.encode(jws.payload);
    } else {
      payload = jws.payload;
    }
    const result = { payload };
    if (jws.protected !== void 0) {
      result.protectedHeader = parsedProt;
    }
    if (jws.header !== void 0) {
      result.unprotectedHeader = jws.header;
    }
    if (resolvedKey) {
      return { ...result, key: k };
    }
    return result;
  }

  // ../../node_modules/jose/dist/webapi/jws/compact/verify.js
  async function compactVerify(jws, key, options) {
    if (jws instanceof Uint8Array) {
      jws = decoder2.decode(jws);
    }
    if (typeof jws !== "string") {
      throw new JWSInvalid("Compact JWS must be a string or Uint8Array");
    }
    const { 0: protectedHeader, 1: payload, 2: signature, length } = jws.split(".");
    if (length !== 3) {
      throw new JWSInvalid("Invalid Compact JWS");
    }
    const verified = await flattenedVerify({ payload, protected: protectedHeader, signature }, key, options);
    const result = { payload: verified.payload, protectedHeader: verified.protectedHeader };
    if (typeof key === "function") {
      return { ...result, key: verified.key };
    }
    return result;
  }

  // ../../node_modules/jose/dist/webapi/lib/jwt_claims_set.js
  var epoch = (date) => Math.floor(date.getTime() / 1e3);
  var minute = 60;
  var hour = minute * 60;
  var day = hour * 24;
  var week = day * 7;
  var year = day * 365.25;
  var REGEX = /^(\+|\-)? ?(\d+|\d+\.\d+) ?(seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)(?: (ago|from now))?$/i;
  function secs(str) {
    const matched = REGEX.exec(str);
    if (!matched || matched[4] && matched[1]) {
      throw new TypeError("Invalid time period format");
    }
    const value = parseFloat(matched[2]);
    const unit = matched[3].toLowerCase();
    let numericDate;
    switch (unit) {
      case "sec":
      case "secs":
      case "second":
      case "seconds":
      case "s":
        numericDate = Math.round(value);
        break;
      case "minute":
      case "minutes":
      case "min":
      case "mins":
      case "m":
        numericDate = Math.round(value * minute);
        break;
      case "hour":
      case "hours":
      case "hr":
      case "hrs":
      case "h":
        numericDate = Math.round(value * hour);
        break;
      case "day":
      case "days":
      case "d":
        numericDate = Math.round(value * day);
        break;
      case "week":
      case "weeks":
      case "w":
        numericDate = Math.round(value * week);
        break;
      default:
        numericDate = Math.round(value * year);
        break;
    }
    if (matched[1] === "-" || matched[4] === "ago") {
      return -numericDate;
    }
    return numericDate;
  }
  var normalizeTyp = (value) => {
    if (value.includes("/")) {
      return value.toLowerCase();
    }
    return `application/${value.toLowerCase()}`;
  };
  var checkAudiencePresence = (audPayload, audOption) => {
    if (typeof audPayload === "string") {
      return audOption.includes(audPayload);
    }
    if (Array.isArray(audPayload)) {
      return audOption.some(Set.prototype.has.bind(new Set(audPayload)));
    }
    return false;
  };
  function validateClaimsSet(protectedHeader, encodedPayload, options = {}) {
    let payload;
    try {
      payload = JSON.parse(decoder2.decode(encodedPayload));
    } catch {
    }
    if (!isObject(payload)) {
      throw new JWTInvalid("JWT Claims Set must be a top-level JSON object");
    }
    const { typ } = options;
    if (typ && (typeof protectedHeader.typ !== "string" || normalizeTyp(protectedHeader.typ) !== normalizeTyp(typ))) {
      throw new JWTClaimValidationFailed('unexpected "typ" JWT header value', payload, "typ", "check_failed");
    }
    const { requiredClaims = [], issuer, subject, audience, maxTokenAge } = options;
    const presenceCheck = [...requiredClaims];
    if (maxTokenAge !== void 0)
      presenceCheck.push("iat");
    if (audience !== void 0)
      presenceCheck.push("aud");
    if (subject !== void 0)
      presenceCheck.push("sub");
    if (issuer !== void 0)
      presenceCheck.push("iss");
    for (const claim of new Set(presenceCheck.reverse())) {
      if (!(claim in payload)) {
        throw new JWTClaimValidationFailed(`missing required "${claim}" claim`, payload, claim, "missing");
      }
    }
    if (issuer && !(Array.isArray(issuer) ? issuer : [issuer]).includes(payload.iss)) {
      throw new JWTClaimValidationFailed('unexpected "iss" claim value', payload, "iss", "check_failed");
    }
    if (subject && payload.sub !== subject) {
      throw new JWTClaimValidationFailed('unexpected "sub" claim value', payload, "sub", "check_failed");
    }
    if (audience && !checkAudiencePresence(payload.aud, typeof audience === "string" ? [audience] : audience)) {
      throw new JWTClaimValidationFailed('unexpected "aud" claim value', payload, "aud", "check_failed");
    }
    let tolerance;
    switch (typeof options.clockTolerance) {
      case "string":
        tolerance = secs(options.clockTolerance);
        break;
      case "number":
        tolerance = options.clockTolerance;
        break;
      case "undefined":
        tolerance = 0;
        break;
      default:
        throw new TypeError("Invalid clockTolerance option type");
    }
    const { currentDate } = options;
    const now2 = epoch(currentDate || /* @__PURE__ */ new Date());
    if ((payload.iat !== void 0 || maxTokenAge) && typeof payload.iat !== "number") {
      throw new JWTClaimValidationFailed('"iat" claim must be a number', payload, "iat", "invalid");
    }
    if (payload.nbf !== void 0) {
      if (typeof payload.nbf !== "number") {
        throw new JWTClaimValidationFailed('"nbf" claim must be a number', payload, "nbf", "invalid");
      }
      if (payload.nbf > now2 + tolerance) {
        throw new JWTClaimValidationFailed('"nbf" claim timestamp check failed', payload, "nbf", "check_failed");
      }
    }
    if (payload.exp !== void 0) {
      if (typeof payload.exp !== "number") {
        throw new JWTClaimValidationFailed('"exp" claim must be a number', payload, "exp", "invalid");
      }
      if (payload.exp <= now2 - tolerance) {
        throw new JWTExpired('"exp" claim timestamp check failed', payload, "exp", "check_failed");
      }
    }
    if (maxTokenAge) {
      const age = now2 - payload.iat;
      const max = typeof maxTokenAge === "number" ? maxTokenAge : secs(maxTokenAge);
      if (age - tolerance > max) {
        throw new JWTExpired('"iat" claim timestamp check failed (too far in the past)', payload, "iat", "check_failed");
      }
      if (age < 0 - tolerance) {
        throw new JWTClaimValidationFailed('"iat" claim timestamp check failed (it should be in the past)', payload, "iat", "check_failed");
      }
    }
    return payload;
  }

  // ../../node_modules/jose/dist/webapi/jwt/verify.js
  async function jwtVerify(jwt2, key, options) {
    const verified = await compactVerify(jwt2, key, options);
    if (verified.protectedHeader.crit?.includes("b64") && verified.protectedHeader.b64 === false) {
      throw new JWTInvalid("JWTs MUST NOT use unencoded payload");
    }
    const payload = validateClaimsSet(verified.protectedHeader, verified.payload, options);
    const result = { payload, protectedHeader: verified.protectedHeader };
    if (typeof key === "function") {
      return { ...result, key: verified.key };
    }
    return result;
  }

  // ../../node_modules/jose/dist/webapi/jwks/local.js
  function getKtyFromAlg(alg) {
    switch (typeof alg === "string" && alg.slice(0, 2)) {
      case "RS":
      case "PS":
        return "RSA";
      case "ES":
        return "EC";
      case "Ed":
        return "OKP";
      case "ML":
        return "AKP";
      default:
        throw new JOSENotSupported('Unsupported "alg" value for a JSON Web Key Set');
    }
  }
  function isJWKSLike(jwks) {
    return jwks && typeof jwks === "object" && Array.isArray(jwks.keys) && jwks.keys.every(isJWKLike);
  }
  function isJWKLike(key) {
    return isObject(key);
  }
  var LocalJWKSet = class {
    #jwks;
    #cached = /* @__PURE__ */ new WeakMap();
    constructor(jwks) {
      if (!isJWKSLike(jwks)) {
        throw new JWKSInvalid("JSON Web Key Set malformed");
      }
      this.#jwks = structuredClone(jwks);
    }
    jwks() {
      return this.#jwks;
    }
    async getKey(protectedHeader, token) {
      const { alg, kid } = { ...protectedHeader, ...token?.header };
      const kty = getKtyFromAlg(alg);
      const candidates = this.#jwks.keys.filter((jwk2) => {
        let candidate = kty === jwk2.kty;
        if (candidate && typeof kid === "string") {
          candidate = kid === jwk2.kid;
        }
        if (candidate && (typeof jwk2.alg === "string" || kty === "AKP")) {
          candidate = alg === jwk2.alg;
        }
        if (candidate && typeof jwk2.use === "string") {
          candidate = jwk2.use === "sig";
        }
        if (candidate && Array.isArray(jwk2.key_ops)) {
          candidate = jwk2.key_ops.includes("verify");
        }
        if (candidate) {
          switch (alg) {
            case "ES256":
              candidate = jwk2.crv === "P-256";
              break;
            case "ES384":
              candidate = jwk2.crv === "P-384";
              break;
            case "ES512":
              candidate = jwk2.crv === "P-521";
              break;
            case "Ed25519":
            case "EdDSA":
              candidate = jwk2.crv === "Ed25519";
              break;
          }
        }
        return candidate;
      });
      const { 0: jwk, length } = candidates;
      if (length === 0) {
        throw new JWKSNoMatchingKey();
      }
      if (length !== 1) {
        const error2 = new JWKSMultipleMatchingKeys();
        const _cached = this.#cached;
        error2[Symbol.asyncIterator] = async function* () {
          for (const jwk2 of candidates) {
            try {
              yield await importWithAlgCache(_cached, jwk2, alg);
            } catch {
            }
          }
        };
        throw error2;
      }
      return importWithAlgCache(this.#cached, jwk, alg);
    }
  };
  async function importWithAlgCache(cache2, jwk, alg) {
    const cached = cache2.get(jwk) || cache2.set(jwk, {}).get(jwk);
    if (cached[alg] === void 0) {
      const key = await importJWK({ ...jwk, ext: true }, alg);
      if (key instanceof Uint8Array || key.type !== "public") {
        throw new JWKSInvalid("JSON Web Key Set members must be public keys");
      }
      cached[alg] = key;
    }
    return cached[alg];
  }
  function createLocalJWKSet(jwks) {
    const set = new LocalJWKSet(jwks);
    const localJWKSet = async (protectedHeader, token) => set.getKey(protectedHeader, token);
    Object.defineProperties(localJWKSet, {
      jwks: {
        value: () => structuredClone(set.jwks()),
        enumerable: false,
        configurable: false,
        writable: false
      }
    });
    return localJWKSet;
  }

  // src/oidc.jwt.mjs
  var jwksCache = /* @__PURE__ */ new WeakMap();
  function keySetFor(jwks) {
    if (!jwks || !Array.isArray(jwks.keys)) {
      throw metroError("metro.oidc: Error: jwks must be an object with a keys array");
    }
    if (!jwksCache.has(jwks)) {
      jwksCache.set(jwks, createLocalJWKSet(jwks));
    }
    return jwksCache.get(jwks);
  }
  function supportedAlgorithms(openidConfiguration = {}) {
    const algorithms = openidConfiguration.id_token_signing_alg_values_supported;
    if (Array.isArray(algorithms) && algorithms.length) {
      return algorithms.filter((algorithm) => algorithm !== "none");
    }
    return ["RS256"];
  }
  async function validateIdToken(idToken2, options = {}) {
    if (!idToken2) {
      throw metroError("metro.oidc: Error: token response did not include an id_token");
    }
    if (!options.jwks) {
      throw metroError("metro.oidc: Error: cannot validate id_token without jwks");
    }
    if (!options.issuer) {
      throw metroError("metro.oidc: Error: cannot validate id_token without issuer");
    }
    if (!options.client_id) {
      throw metroError("metro.oidc: Error: cannot validate id_token without client_id");
    }
    const { payload, protectedHeader } = await jwtVerify(
      idToken2,
      keySetFor(options.jwks),
      {
        issuer: options.issuer,
        audience: options.client_id,
        algorithms: options.algorithms || supportedAlgorithms(options.openid_configuration),
        clockTolerance: options.clockTolerance ?? 60,
        requiredClaims: ["iss", "sub", "aud", "exp", "iat"]
      }
    );
    if (options.nonce !== void 0 && payload.nonce !== options.nonce) {
      throw metroError("metro.oidc: Error: id_token nonce mismatch");
    }
    return {
      header: protectedHeader,
      claims: payload
    };
  }

  // src/oidcmw.mjs
  function oidcmw(options = {}) {
    const defaultOptions = {
      client: client(),
      force_authorization: false,
      use_dpop: true,
      authorize_callback: async (url2) => {
        if (window.location.href != url2.href) {
          window.location.replace(url2.href);
        }
        return false;
      }
    };
    options = Object.assign({}, defaultOptions, options);
    assert(options, {
      client: Required(instanceOf(client().constructor)),
      // required because it is set in defaultOptions
      client_info: Required(),
      issuer: Required(validURL),
      oauth2: Optional({}),
      openid_configuration: Optional()
    });
    if (!options.store) {
      options.store = oidcStore(options.issuer);
    }
    if (!options.openid_configuration && options.store.has("openid_configuration")) {
      options.openid_configuration = options.store.get("openid_configuration");
    }
    if (!options.client_info?.client_id && options.store.has("client_info")) {
      options.client_info = options.store.get("client_info");
    }
    return async (req, next) => {
      let res;
      if (!options.force_authorization) {
        try {
          res = await next(req);
        } catch (err) {
          if (res.status != 401 && res.status != 403) {
            throw err;
          }
        }
        if (res.ok || res.status != 401 && res.status != 403) {
          return res;
        }
      }
      if (!options.openid_configuration) {
        options.openid_configuration = await oidcDiscovery({
          issuer: options.issuer,
          client: options.client.with(options.issuer)
        });
        options.store.set("openid_configuration", options.openid_configuration);
      }
      if (!options.client_info?.client_id) {
        if (!options.openid_configuration.registration_endpoint) {
          throw metroError("metro.oidcmw: Error: issuer " + options.issuer + " does not support dynamic client registration, but you haven't specified a client_id");
        }
        options.client_info = await register({
          registration_endpoint: options.openid_configuration.registration_endpoint,
          client: options.client,
          client_info: options.client_info
        });
        options.store.set("client_info", options.client_info);
      }
      const scope = options.scope || "openid";
      const nonce = options.nonce || generateCodeVerifier(32);
      options.store.set("pending_nonce", nonce);
      const oauth2Options = Object.assign(
        {
          site: options.issuer,
          client: options.client,
          force_authorization: true,
          authorize_callback: options.authorize_callback,
          oauth2_configuration: {
            client_id: options.client_info?.client_id,
            client_secret: options.client_info?.client_secret,
            grant_type: "authorization_code",
            response_type: "code",
            response_mode: "query",
            authorization_endpoint: options.openid_configuration.authorization_endpoint,
            token_endpoint: options.openid_configuration.token_endpoint,
            scope,
            //FIXME: should only use scopes supported by server
            redirect_uri: options.client_info.redirect_uris[0],
            nonce
          }
        }
        //...
      );
      const storeIdToken = async (req2, next2) => {
        const res2 = await next2(req2);
        const tokenEndpoint = url(options.openid_configuration.token_endpoint, { hash: "" }).href;
        const requestUrl = url(req2.url, { hash: "" }).href;
        if (requestUrl !== tokenEndpoint) {
          return res2;
        }
        const contentType = res2.headers.get("content-type");
        if (!contentType?.startsWith("application/json")) {
          return res2;
        }
        let data = res2.data && typeof res2.data === "object" ? res2.data : null;
        if (!data) {
          const res22 = res2.clone();
          data = await res22.json();
        }
        const id_token = data?.id_token;
        const jwks = await getJwks();
        const validation = await validateIdToken(id_token, {
          issuer: options.openid_configuration.issuer,
          client_id: options.client_info.client_id,
          jwks,
          openid_configuration: options.openid_configuration,
          nonce: options.store.get("pending_nonce")
        });
        options.store.set("id_token", id_token);
        options.store.set("id_token_claims", validation.claims);
        return res2;
      };
      const getJwks = async () => {
        if (!options.jwks) {
          const jwksClient = options.client.with(throwermw()).with(jsonmw());
          const response2 = await jwksClient.get(options.openid_configuration.jwks_uri);
          options.jwks = response2.data;
        }
        return options.jwks;
      };
      let oauth2client = options.client.with(options.issuer).with(storeIdToken);
      if (options.use_dpop) {
        const dpopOptions = {
          site: options.issuer,
          authorization_endpoint: options.openid_configuration.authorization_endpoint,
          token_endpoint: options.openid_configuration.token_endpoint,
          dpop_signing_alg_values_supported: options.openid_configuration.dpop_signing_alg_values_supported
        };
        oauth2client = oauth2client.with(dpopmw(dpopOptions));
      }
      oauth2Options.client = oauth2client;
      oauth2client = oauth2client.with(oauth2mw(oauth2Options));
      res = await oauth2client.fetch(req);
      return res;
    };
  }
  function isRedirected2() {
    return isRedirected();
  }
  function idToken(options) {
    if (!options.store) {
      if (!options.issuer) {
        throw metroError("Must supply options.issuer or options.store to get the id_token");
      }
      options.store = oidcStore(options.issuer);
    }
    return options.store.get("id_token");
  }
  function idTokenClaims(options) {
    if (!options.store) {
      if (!options.issuer) {
        throw metroError("Must supply options.issuer or options.store to get the id_token claims");
      }
      options.store = oidcStore(options.issuer);
    }
    return options.store.get("id_token_claims");
  }

  // src/browser.mjs
  var oidc = {
    oidcmw,
    discover: oidcDiscovery,
    register,
    isRedirected: isRedirected2,
    idToken,
    idTokenClaims
  };
  if (!globalThis.metro.oidc) {
    globalThis.metro.oidc = oidc;
  }
  var browser_default = oidc;
})();
//# sourceMappingURL=browser.js.map
