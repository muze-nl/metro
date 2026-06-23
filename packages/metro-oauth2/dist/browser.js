(() => {
  var __defProp = Object.defineProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };

  // ../metro/src/metro.mjs
  var metro_exports = {};
  __export(metro_exports, {
    Client: () => Client,
    client: () => client,
    deepClone: () => deepClone,
    formdata: () => formdata,
    metroError: () => metroError,
    request: () => request,
    response: () => response,
    trace: () => trace,
    url: () => url
  });

  // ../metro/src/hashparams.mjs
  var hashparams_exports = {};
  __export(hashparams_exports, {
    append: () => append,
    clear: () => clear,
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
  function clear(url2) {
    url2 = url(url2);
    let hash = url2.hash.replace(/\?[^#]*/, "");
    if (hash.substr(0, 2) === "##") {
      hash = hash.substr(1);
    }
    return url2.with({ hash });
  }

  // ../metro/src/metro.mjs
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
          return this.fetch(request(
            this.clientOptions,
            ...options2,
            { method: verb.toUpperCase() }
          ));
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
      let next;
      for (let middleware of middlewares) {
        next = /* @__PURE__ */ (function(next2, middleware2) {
          return async function(req2) {
            let res;
            let tracers = Object.values(_Client.tracers);
            for (let tracer of tracers) {
              if (tracer.request) {
                tracer.request.call(tracer, req2, middleware2);
              }
            }
            res = await middleware2(req2, next2);
            for (let tracer of tracers) {
              if (tracer.response) {
                tracer.response.call(tracer, res, middleware2);
              }
            }
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
        u = append(u, hParams)[Symbol.metroSource];
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
  function formdata(...options) {
    var params = new FormData();
    for (let option of options) {
      if (option instanceof HTMLFormElement) {
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
        throw new metroError("metro.formdata: unknown option type " + metroURL + "formdata/unknown-option-value/", option);
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
  var trace = {
    /**
     * Adds a named tracer function
     * @param {string} name - the name of the tracer
     * @param {Function} tracer - the tracer function to call
     */
    add(name, tracer) {
      Client.tracers[name] = tracer;
    },
    /**
     * Removes a named tracer function
     * @param {string} name
     */
    delete(name) {
      delete Client.tracers[name];
    },
    /**
     * Removes all tracer functions
     */
    clear() {
      Client.tracers = {};
    },
    /**
     * Returns a set of request and response tracer functions that use the
     * console.group feature to shows nested request/response pairs, with
     * most commonly needed information for debugging
     */
    group() {
      let group = 0;
      return {
        request: (req, middleware) => {
          group++;
          metroConsole.group(group);
          metroConsole.info(req?.url, req, middleware);
        },
        response: (res, middleware) => {
          metroConsole.info(res?.body ? res.body[Symbol.metroSource] : null, res, middleware);
          metroConsole.groupEnd(group);
          group--;
        }
      };
    }
  };
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

  // ../metro/src/mw/json.mjs
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

  // ../metro/src/mw/thrower.mjs
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

  // ../metro/src/mw/getdata.mjs
  function getdatamw() {
    return async function getdata(req, next) {
      let res = await next(req);
      if (res.ok && res.data) {
        return res.data;
      }
      return res;
    };
  }

  // ../metro/src/api.mjs
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

  // ../metro/src/everything.mjs
  var metro = Object.assign({}, metro_exports, {
    mw: {
      json: jsonmw,
      thrower: throwermw,
      getdata: getdatamw
    },
    api,
    jsonApi,
    hashParams: hashparams_exports
  });
  if (!globalThis.metro) {
    globalThis.metro = metro;
  }
  var everything_default = metro;

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
  function error(message, found, expected, path, problems) {
    let result = {
      path,
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

  // src/tokenstore.mjs
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
    issuer: Required(validURL),
    authorization_endpoint: Required(validURL),
    token_endpoint: Required(validURL),
    jwks_uri: Optional(validURL),
    registration_endpoint: Optional(validURL),
    scopes_supported: Recommended([]),
    response_types_supported: Required(anyOf("code", "token")),
    response_modes_supported: Optional([]),
    grant_types_supported: Optional([]),
    token_endpoint_auth_methods_supported: Optional([]),
    token_endpoint_auth_signing_alg_values_supported: Optional([]),
    service_documentation: Optional(validURL),
    ui_locales_supported: Optional([]),
    op_policy_uri: Optional(validURL),
    op_tos_uri: Optional(validURL),
    revocation_endpoint: Optional(validURL),
    revocation_endpoint_auth_methods_supported: Optional(validAuthMethods),
    revocation_endpoint_auth_signing_alg_values_supported: Optional(validAlgorithms),
    introspection_endpoint: Optional(validURL),
    introspection_endpoint_auth_methods_supported: Optional(validAuthMethods),
    introspection_endpoint_auth_signing_alg_values_supported: Optional(validAlgorithms),
    code_challendge_methods_supported: Optional([])
  };
  function makeClient(options = {}) {
    const defaultOptions = {
      client: everything_default.client()
    };
    options = Object.assign({}, defaultOptions, options);
    assert(options, {
      issuer: Required(validURL)
    });
    const oauth_authorization_server_configuration = fetchWellknownOauthAuthorizationServer(options.issuer);
    return options.client.with(options.issuer);
  }
  async function fetchWellknownOauthAuthorizationServer(issuer, client2) {
    let res = client2.get(everything_default.url(issuer, ".wellknown/oauth_authorization_server"));
    if (res.ok) {
      assert(res.headers.get("Content-Type"), /application\/json.*/);
      let configuration = await res.json();
      assert(configuration, oauth_authorization_server_metadata);
      return configuration;
    }
    throw everything_default.metroError("metro.oidcmw: Error while fetching " + issuer + ".wellknown/oauth_authorization_server", res);
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
  function authorizePopup(authorizationCodeURL) {
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
      window.open(authorizationCodeURL);
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
      const url2 = everything_default.url(req.url);
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

  // src/browser.mjs
  var oauth2 = Object.assign({}, oauth2_exports, {
    oauth2mw,
    discover: oauth2_discovery_exports,
    tokenstore: tokenStore,
    dpopmw,
    keysstore: keysStore,
    authorizePopup,
    popupHandleRedirect: handleRedirect
  });
  if (!globalThis.metro.oauth2) {
    globalThis.metro.oauth2 = oauth2;
  }
  var browser_default = oauth2;
})();
//# sourceMappingURL=browser.js.map
