(() => {
  // ../metro/src/metro.mjs
  var metroURL = "https://metro.muze.nl/details/";
  var symbols = {
    isProxy: Symbol("isProxy"),
    source: Symbol("source")
  };
  var Client = class _Client {
    #options = {
      url: typeof window != "undefined" ? window.location : "https://localhost"
    };
    #verbs = ["get", "post", "put", "delete", "patch", "head", "options", "query"];
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
          this.#options.url = "" + option;
        } else if (option instanceof _Client) {
          Object.assign(this.#options, option.#options);
        } else if (option instanceof Function) {
          this.#addMiddlewares([option]);
        } else if (option && typeof option == "object") {
          for (let param in option) {
            if (param == "middlewares") {
              this.#addMiddlewares(option[param]);
            } else if (typeof option[param] == "function") {
              this.#options[param] = option[param](this.#options[param], this.#options);
            } else {
              this.#options[param] = option[param];
            }
          }
        }
      }
      if (this.#options.verbs) {
        this.#verbs = this.#options.verbs;
        delete this.#options.verbs;
      }
      for (const verb of this.#verbs) {
        this[verb] = async function(...options2) {
          return this.fetch(request(
            this.#options,
            ...options2,
            { method: verb.toUpperCase() }
          ));
        };
      }
      Object.freeze(this);
    }
    #addMiddlewares(middlewares) {
      if (typeof middlewares == "function") {
        middlewares = [middlewares];
      }
      let index = middlewares.findIndex((m) => typeof m != "function");
      if (index >= 0) {
        throw metroError("metro.client: middlewares must be a function or an array of functions " + metroURL + "client/invalid-middlewares-value/", middlewares[index]);
      }
      if (!Array.isArray(this.#options.middlewares)) {
        this.#options.middlewares = [];
      }
      this.#options.middlewares = this.#options.middlewares.concat(middlewares);
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
        throw metroError("metro.client." + req.method.toLowerCase() + ": Missing url parameter " + metroURL + "client/missing-url-param/", req);
      }
      if (!options) {
        options = {};
      }
      if (!(typeof options === "object") || Array.isArray(options) || options instanceof String) {
        throw metroError("metro.client.fetch: Options is not an object");
      }
      const metrofetch = async function browserFetch(req2) {
        if (req2[symbols.isProxy]) {
          req2 = req2[symbols.source];
        }
        const res = await fetch(req2);
        return response(res);
      };
      let middlewares = [metrofetch].concat(this.#options?.middlewares?.slice() || []);
      options = Object.assign({}, this.#options, options);
      let next;
      for (let middleware of middlewares) {
        next = /* @__PURE__ */ function(next2, middleware2) {
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
        }(next, middleware);
      }
      return next(req);
    }
    with(...options) {
      return new _Client(this, ...options);
    }
  };
  function client(...options) {
    return new Client(...options);
  }
  function bodyProxy(body, r) {
    let source = r.body;
    if (!source) {
      if (body === null) {
        source = new ReadableStream();
      } else if (body instanceof ReadableStream) {
        source = body;
      } else if (body instanceof Blob) {
        source = body.stream();
      } else {
        source = new ReadableStream({
          start(controller) {
            let chunk;
            switch (typeof body) {
              case "object":
                if (typeof body.toString == "function") {
                  chunk = body.toString();
                } else if (body instanceof FormData) {
                  chunk = new URLSearchParams(body).toString();
                } else if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) {
                  chunk = body;
                } else {
                  throw metroError("Cannot convert body to ReadableStream", body);
                }
                break;
              case "string":
              case "number":
              case "boolean":
                chunk = body;
                break;
              default:
                throw metroError("Cannot convert body to ReadableStream", body);
                break;
            }
            controller.enqueue(chunk);
            controller.close();
          }
        });
      }
    }
    return new Proxy(source, {
      get(target, prop, receiver) {
        switch (prop) {
          case symbols.isProxy:
            return true;
            break;
          case symbols.source:
            return body;
            break;
          case "toString":
            return function() {
              return "" + body;
            };
            break;
        }
        if (body && typeof body == "object") {
          if (prop in body) {
            if (typeof body[prop] == "function") {
              return function(...args) {
                return body[prop].apply(body, args);
              };
            }
            return body[prop];
          }
        }
        if (prop in target && prop != "toString") {
          if (typeof target[prop] == "function") {
            return function(...args) {
              return target[prop].apply(target, args);
            };
          }
          return target[prop];
        }
      },
      has(target, prop) {
        if (body && typeof body == "object") {
          return prop in body;
        } else {
          return prop in target;
        }
      },
      ownKeys(target) {
        if (body && typeof body == "object") {
          return Reflect.ownKeys(body);
        } else {
          return Reflect.ownKeys(target);
        }
      },
      getOwnPropertyDescriptor(target, prop) {
        if (body && typeof body == "object") {
          return Object.getOwnPropertyDescriptor(body, prop);
        } else {
          return Object.getOwnPropertyDescriptor(target, prop);
        }
      }
    });
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
      if (typeof req[prop] == "function") {
        req[prop](params[prop], params);
      } else if (typeof req[prop] != "undefined") {
        if (prop == "url") {
          params.url = url(params.url, req.url);
        } else if (prop == "headers") {
          params.headers = new Headers(current.headers);
          if (!(req.headers instanceof Headers)) {
            req.headers = new Headers(req.headers);
          }
          for (let [key, value] of req.headers.entries()) {
            params.headers.set(key, value);
          }
        } else {
          params[prop] = req[prop];
        }
      }
    }
    return params;
  }
  function request(...options) {
    let requestParams = {
      url: typeof window != "undefined" ? window.location : "https://localhost/",
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
    let body = requestParams.body;
    if (body) {
      if (typeof body == "object" && !(body instanceof String) && !(body instanceof ReadableStream) && !(body instanceof Blob) && !(body instanceof ArrayBuffer) && !(body instanceof DataView) && !(body instanceof FormData) && !(body instanceof URLSearchParams) && (typeof TypedArray == "undefined" || !(body instanceof TypedArray))) {
        requestParams.body = JSON.stringify(body);
      }
    }
    let r = new Request(requestParams.url, requestParams);
    Object.freeze(r);
    return new Proxy(r, {
      get(target, prop, receiver) {
        switch (prop) {
          case symbols.source:
            return target;
            break;
          case symbols.isProxy:
            return true;
            break;
          case "with":
            return function(...options2) {
              if (body) {
                options2.unshift({ body });
              }
              return request(target, ...options2);
            };
            break;
          case "toString":
          case "toJSON":
            return function() {
              return target[prop].apply(target);
            };
            break;
          case "blob":
          case "text":
          case "json":
            return function() {
              return target[prop].apply(target);
            };
            break;
          case "body":
            if (!body) {
              body = target.body;
            }
            if (body) {
              if (body[symbols.isProxy]) {
                return body;
              }
              return bodyProxy(body, target);
            }
            break;
        }
        return target[prop];
      }
    });
  }
  function getResponseParams(res, current) {
    let params = current || {};
    if (!params.url && current.url) {
      params.url = current.url;
    }
    for (let prop of ["status", "statusText", "headers", "body", "url", "type", "redirected"]) {
      if (typeof res[prop] == "function") {
        res[prop](params[prop], params);
      } else if (typeof res[prop] != "undefined") {
        if (prop == "url") {
          params.url = new URL(res.url, params.url || "https://localhost/");
        } else {
          params[prop] = res[prop];
        }
      }
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
        if (option instanceof FormData || option instanceof Blob || option instanceof ArrayBuffer || option instanceof DataView || option instanceof ReadableStream || option instanceof URLSearchParams || option instanceof String || typeof TypedArray != "undefined" && option instanceof TypedArray) {
          responseParams.body = option;
        } else {
          Object.assign(responseParams, getResponseParams(option, responseParams));
        }
      }
    }
    let r = new Response(responseParams.body, responseParams);
    Object.freeze(r);
    return new Proxy(r, {
      get(target, prop, receiver) {
        switch (prop) {
          case symbols.isProxy:
            return true;
            break;
          case symbols.source:
            return target;
            break;
          case "with":
            return function(...options2) {
              return response(target, ...options2);
            };
            break;
          case "body":
            if (responseParams.body) {
              if (responseParams.body[symbols.isProxy]) {
                return responseParams.body;
              }
              return bodyProxy(responseParams.body, target);
            } else {
              return bodyProxy("", target);
            }
            break;
          case "ok":
            return target.status >= 200 && target.status < 400;
            break;
          case "headers":
            return target.headers;
            break;
          default:
            if (prop in responseParams && prop != "toString") {
              return responseParams[prop];
            }
            if (prop in target && prop != "toString") {
              if (typeof target[prop] == "function") {
                return function(...args) {
                  return target[prop].apply(target, args);
                };
              }
              return target[prop];
            }
            break;
        }
        return void 0;
      }
    });
  }
  function appendSearchParams(url3, params) {
    if (typeof params == "function") {
      params(url3.searchParams, url3);
    } else {
      params = new URLSearchParams(params);
      params.forEach((value, key) => {
        url3.searchParams.append(key, value);
      });
    }
  }
  function url(...options) {
    let validParams = [
      "hash",
      "host",
      "hostname",
      "href",
      "password",
      "pathname",
      "port",
      "protocol",
      "username",
      "search",
      "searchParams"
    ];
    let u = new URL("https://localhost/");
    for (let option of options) {
      if (typeof option == "string" || option instanceof String) {
        u = new URL(option, u);
      } else if (option instanceof URL || typeof Location != "undefined" && option instanceof Location) {
        u = new URL(option);
      } else if (option instanceof URLSearchParams) {
        appendSearchParams(u, option);
      } else if (option && typeof option == "object") {
        for (let param in option) {
          if (param == "search") {
            if (typeof option.search == "function") {
              option.search(u.search, u);
            } else {
              u.search = new URLSearchParams(option.search);
            }
          } else if (param == "searchParams") {
            appendSearchParams(u, option.searchParams);
          } else {
            if (!validParams.includes(param)) {
              throw metroError("metro.url: unknown url parameter " + metroURL + "url/unknown-param-name/", param);
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
          }
        }
      } else {
        throw metroError("metro.url: unsupported option value " + metroURL + "url/unsupported-option-value/", option);
      }
    }
    Object.freeze(u);
    return new Proxy(u, {
      get(target, prop, receiver) {
        switch (prop) {
          case symbols.isProxy:
            return true;
            break;
          case symbols.source:
            return target;
            break;
          case "with":
            return function(...options2) {
              return url(target, ...options2);
            };
            break;
          case "toString":
          case "toJSON":
            return function() {
              return target[prop]();
            };
            break;
        }
        return target[prop];
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

  // ../metro/src/mw/json.mjs
  function jsonmw(options) {
    options = Object.assign({
      reviver: null,
      replacer: null,
      space: ""
    }, options);
    return async (req, next) => {
      if (["POST", "PUT", "PATCH", "QUERY"].includes(req.method)) {
        req = req.with({
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
          }
        });
        if (req.body && typeof req.body[symbols.source] == "object") {
          req = req.with({
            body: JSON.stringify(req.body[symbols.source], options.replacer, options.space)
          });
        }
      } else {
        req = req.with({
          headers: {
            "Accept": "application/json"
          }
        });
      }
      let res = await next(req);
      let body = await res.text();
      let json = JSON.parse(body, options.reviver);
      return res.with({
        body: json
      });
    };
  }

  // ../metro/src/mw/thrower.mjs
  function thrower(options) {
    return async (req, next) => {
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

  // ../assert/src/assert.mjs
  globalThis.assertEnabled = false;
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
    return function _Optional(data2, root, path) {
      if (typeof data2 != "undefined" && data2 != null && typeof pattern != "undefined") {
        return fails(data2, pattern, root, path);
      }
    };
  }
  function Required(pattern) {
    return function _Required(data2, root, path) {
      if (data2 == null || typeof data2 == "undefined") {
        return error("data is required", data2, pattern || "any value", path);
      } else if (typeof pattern != "undefined") {
        return fails(data2, pattern, root, path);
      } else {
        return false;
      }
    };
  }
  function Recommended(pattern) {
    return function _Recommended(data2, root, path) {
      if (data2 == null || typeof data2 == "undefined") {
        console.warn("data does not contain recommended value", data2, pattern, path);
        return false;
      } else {
        return fails(data2, pattern, root, path);
      }
    };
  }
  function oneOf(...patterns) {
    return function _oneOf(data2, root, path) {
      for (let pattern of patterns) {
        if (!fails(data2, pattern, root, path)) {
          return false;
        }
      }
      return error("data does not match oneOf patterns", data2, patterns, path);
    };
  }
  function anyOf(...patterns) {
    return function _anyOf(data2, root, path) {
      if (!Array.isArray(data2)) {
        return error("data is not an array", data2, "anyOf", path);
      }
      for (let value of data2) {
        if (oneOf(...patterns)(value)) {
          return error("data does not match anyOf patterns", value, patterns, path);
        }
      }
      return false;
    };
  }
  function allOf(...patterns) {
    return function _allOf(data2, root, path) {
      let problems = [];
      for (let pattern of patterns) {
        problems = problems.concat(fails(data2, pattern, root, path));
      }
      problems = problems.filter(Boolean);
      if (problems.length) {
        return error("data does not match all given patterns", data2, patterns, path, problems);
      }
    };
  }
  function validURL(data2, root, path) {
    try {
      if (data2 instanceof URL) {
        data2 = data2.href;
      }
      let url3 = new URL(data2);
      if (url3.href != data2) {
        if (!(url3.href + "/" == data2 || url3.href == data2 + "/")) {
          return error("data is not a valid url", data2, "validURL", path);
        }
      }
    } catch (e) {
      return error("data is not a valid url", data2, "validURL", path);
    }
  }
  function validEmail(data2, root, path) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data2)) {
      return error("data is not a valid email", data2, "validEmail", path);
    }
  }
  function instanceOf(constructor) {
    return function _instanceOf(data2, root, path) {
      if (!(data2 instanceof constructor)) {
        return error("data is not an instanceof pattern", data2, constructor, path);
      }
    };
  }
  function not(pattern) {
    return function _not(data2, root, path) {
      if (!fails(data2, pattern, root, path)) {
        return error("data matches pattern, when required not to", data2, pattern, path);
      }
    };
  }
  function fails(data2, pattern, root, path = "") {
    if (!root) {
      root = data2;
    }
    let problems = [];
    if (pattern === Boolean) {
      if (typeof data2 != "boolean" && !(data2 instanceof Boolean)) {
        problems.push(error("data is not a boolean", data2, pattern, path));
      }
    } else if (pattern === Number) {
      if (typeof data2 != "number" && !(data2 instanceof Number)) {
        problems.push(error("data is not a number", data2, pattern, path));
      }
    } else if (pattern === String) {
      if (typeof data2 != "string" && !(data2 instanceof String)) {
        problems.push(error("data is not a string", data2, pattern, path));
      }
      if (data2 == "") {
        problems.push(error("data is an empty string, which is not allowed", data2, pattern, path));
      }
    } else if (pattern instanceof RegExp) {
      if (Array.isArray(data2)) {
        let index = data2.findIndex((element, index2) => fails(element, pattern, root, path + "[" + index2 + "]"));
        if (index > -1) {
          problems.push(error("data[" + index + "] does not match pattern", data2[index], pattern, path + "[" + index + "]"));
        }
      } else if (typeof data2 == "undefined") {
        problems.push(error("data is undefined, should match pattern", data2, pattern, path));
      } else if (!pattern.test(data2)) {
        problems.push(error("data does not match pattern", data2, pattern, path));
      }
    } else if (pattern instanceof Function) {
      let problem = pattern(data2, root, path);
      if (problem) {
        if (Array.isArray(problem)) {
          problems = problems.concat(problem);
        } else {
          problems.push(problem);
        }
      }
    } else if (Array.isArray(pattern)) {
      if (!Array.isArray(data2)) {
        problems.push(error("data is not an array", data2, [], path));
      }
      for (let p2 of pattern) {
        for (let index of data2.keys()) {
          let problem = fails(data2[index], p2, root, path + "[" + index + "]");
          if (Array.isArray(problem)) {
            problems = problems.concat(problem);
          } else if (problem) {
            problems.push(problem);
          }
        }
      }
    } else if (pattern && typeof pattern == "object") {
      if (Array.isArray(data2)) {
        let index = data2.findIndex((element, index2) => fails(element, pattern, root, path + "[" + index2 + "]"));
        if (index > -1) {
          problems.push(error("data[" + index + "] does not match pattern", data2[index], pattern, path + "[" + index + "]"));
        }
      } else if (!data2 || typeof data2 != "object") {
        problems.push(error("data is not an object, pattern is", data2, pattern, path));
      } else {
        if (data2 instanceof URLSearchParams) {
          data2 = Object.fromEntries(data2);
        }
        if (pattern instanceof Function) {
          let result = fails(data2, pattern, root, path);
          if (result) {
            problems = problems.concat(result);
          }
        } else {
          for (const [wKey, wVal] of Object.entries(pattern)) {
            let result = fails(data2[wKey], wVal, root, path + "." + wKey);
            if (result) {
              problems = problems.concat(result);
            }
          }
        }
      }
    } else {
      if (pattern != data2) {
        problems.push(error("data and pattern are not equal", data2, pattern, path));
      }
    }
    if (problems.length) {
      return problems;
    }
    return false;
  }
  function error(message, found, expected, path, problems) {
    let result = {
      message,
      found,
      expected,
      path
    };
    if (problems) {
      result.problems = problems;
    }
    return result;
  }

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
      return error("data must be an array which includes", data, options);
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
    "client_secret_post",
    "client_secret_basic",
    "client_secret_jwt",
    "private_key_jwt"
  ];

  // src/oidc.discovery.mjs
  async function oidcDiscovery(options = {}) {
    assert(options, {
      client: Optional(instanceOf(client().constructor)),
      issuer: Required(validURL)
    });
    const defaultOptions = {
      client: client().with(thrower()).with(jsonmw()),
      requireDynamicRegistration: false
    };
    options = Object.assign({}, defaultOptions, options);
    const TestSucceeded = false;
    function MustUseHTTPS(url3) {
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
    const response3 = await options.client.get(
      // https://openid.net/specs/openid-connect-discovery-1_0.html#ProviderConfigurationRequest
      // note: this allows path components in the options.issuer url
      url(options.issuer, ".well-known/openid-configuration")
    );
    const openid_config = response3.body;
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
      client: Optional(instanceOf(client().constructor)),
      registration_endpoint: validURL,
      client_info: openid_client_metadata
    });
    const defaultOptions = {
      client: client().with(thrower()).with(jsonmw())
    };
    options = Object.assign({}, defaultOptions, options);
    let response3 = await options.client.post(options.registration_endpoint, {
      body: options.client_info
    });
    let info = response3.body;
    if (!info.client_id || !info.client_secret) {
      throw metroError("metro.oidc: Error: dynamic registration of client failed, no client_id or client_secret returned", response3);
    }
    options.client_info = Object.assign(options.client_info, info);
    return options.client_info;
  }

  // ../metro-oauth2/node_modules/@muze-nl/metro/src/metro.mjs
  var metroURL2 = "https://metro.muze.nl/details/";
  var symbols2 = {
    isProxy: Symbol("isProxy"),
    source: Symbol("source")
  };
  var Client2 = class _Client {
    #options = {
      url: typeof window != "undefined" ? window.location : "https://localhost"
    };
    #verbs = ["get", "post", "put", "delete", "patch", "head", "options", "query"];
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
          this.#options.url = "" + option;
        } else if (option instanceof _Client) {
          Object.assign(this.#options, option.#options);
        } else if (option instanceof Function) {
          this.#addMiddlewares([option]);
        } else if (option && typeof option == "object") {
          for (let param in option) {
            if (param == "middlewares") {
              this.#addMiddlewares(option[param]);
            } else if (typeof option[param] == "function") {
              this.#options[param] = option[param](this.#options[param], this.#options);
            } else {
              this.#options[param] = option[param];
            }
          }
        }
      }
      if (this.#options.verbs) {
        this.#verbs = this.#options.verbs;
        delete this.#options.verbs;
      }
      for (const verb of this.#verbs) {
        this[verb] = async function(...options2) {
          return this.fetch(request2(
            this.#options,
            ...options2,
            { method: verb.toUpperCase() }
          ));
        };
      }
      Object.freeze(this);
    }
    #addMiddlewares(middlewares) {
      if (typeof middlewares == "function") {
        middlewares = [middlewares];
      }
      let index = middlewares.findIndex((m) => typeof m != "function");
      if (index >= 0) {
        throw metroError2("metro.client: middlewares must be a function or an array of functions " + metroURL2 + "client/invalid-middlewares-value/", middlewares[index]);
      }
      if (!Array.isArray(this.#options.middlewares)) {
        this.#options.middlewares = [];
      }
      this.#options.middlewares = this.#options.middlewares.concat(middlewares);
    }
    /**
     * Mimics the standard browser fetch method, but uses any middleware installed through
     * the constructor.
     * @param {Request|string|Object} - Required. The URL or Request object, accepts all types that are accepted by metro.request
     * @param {Object} - Optional. Any object that is accepted by metro.request
     * @return {Promise<Response|*>} - The metro.response to this request, or any other result as changed by any included middleware.
     */
    fetch(req, options) {
      req = request2(req, options);
      if (!req.url) {
        throw metroError2("metro.client." + req.method.toLowerCase() + ": Missing url parameter " + metroURL2 + "client/missing-url-param/", req);
      }
      if (!options) {
        options = {};
      }
      if (!(typeof options === "object") || Array.isArray(options) || options instanceof String) {
        throw metroError2("metro.client.fetch: Options is not an object");
      }
      const metrofetch = async function browserFetch(req2) {
        if (req2[symbols2.isProxy]) {
          req2 = req2[symbols2.source];
        }
        const res = await fetch(req2);
        return response2(res);
      };
      let middlewares = [metrofetch].concat(this.#options?.middlewares?.slice() || []);
      options = Object.assign({}, this.#options, options);
      let next;
      for (let middleware of middlewares) {
        next = /* @__PURE__ */ function(next2, middleware2) {
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
        }(next, middleware);
      }
      return next(req);
    }
    with(...options) {
      return new _Client(this, ...options);
    }
  };
  function client2(...options) {
    return new Client2(...options);
  }
  function bodyProxy2(body, r) {
    let source = r.body;
    if (!source) {
      if (body === null) {
        source = new ReadableStream();
      } else if (body instanceof ReadableStream) {
        source = body;
      } else if (body instanceof Blob) {
        source = body.stream();
      } else {
        source = new ReadableStream({
          start(controller) {
            let chunk;
            switch (typeof body) {
              case "object":
                if (typeof body.toString == "function") {
                  chunk = body.toString();
                } else if (body instanceof FormData) {
                  chunk = new URLSearchParams(body).toString();
                } else if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) {
                  chunk = body;
                } else {
                  throw metroError2("Cannot convert body to ReadableStream", body);
                }
                break;
              case "string":
              case "number":
              case "boolean":
                chunk = body;
                break;
              default:
                throw metroError2("Cannot convert body to ReadableStream", body);
                break;
            }
            controller.enqueue(chunk);
            controller.close();
          }
        });
      }
    }
    return new Proxy(source, {
      get(target, prop, receiver) {
        switch (prop) {
          case symbols2.isProxy:
            return true;
            break;
          case symbols2.source:
            return body;
            break;
          case "toString":
            return function() {
              return "" + body;
            };
            break;
        }
        if (typeof body == "object") {
          if (prop in body) {
            if (typeof body[prop] == "function") {
              return function(...args) {
                return body[prop].apply(body, args);
              };
            }
            return body[prop];
          }
        }
        if (prop in target && prop != "toString") {
          if (typeof target[prop] == "function") {
            return function(...args) {
              return target[prop].apply(target, args);
            };
          }
          return target[prop];
        }
      },
      has(target, prop) {
        return prop in body;
      },
      ownKeys(target) {
        if (typeof body == "object") {
          return Reflect.ownKeys(body);
        } else {
          return Reflect.ownKeys(target);
        }
      },
      getOwnPropertyDescriptor(target, prop) {
        return Object.getOwnPropertyDescriptor(body, prop);
      }
    });
  }
  function getRequestParams2(req, current) {
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
      if (typeof req[prop] == "function") {
        req[prop](params[prop], params);
      } else if (typeof req[prop] != "undefined") {
        if (prop == "url") {
          params.url = url2(params.url, req.url);
        } else if (prop == "headers") {
          params.headers = new Headers(current.headers);
          if (!(req.headers instanceof Headers)) {
            req.headers = new Headers(req.headers);
          }
          for (let [key, value] of req.headers.entries()) {
            params.headers.set(key, value);
          }
        } else {
          params[prop] = req[prop];
        }
      }
    }
    return params;
  }
  function request2(...options) {
    let requestParams = {
      url: typeof window != "undefined" ? window.location : "https://localhost/",
      duplex: "half"
      // required when setting body to ReadableStream, just set it here by default already
    };
    for (let option of options) {
      if (typeof option == "string" || option instanceof URL || option instanceof URLSearchParams) {
        requestParams.url = url2(requestParams.url, option);
      } else if (option && (option instanceof FormData || option instanceof ReadableStream || option instanceof Blob || option instanceof ArrayBuffer || option instanceof DataView)) {
        requestParams.body = option;
      } else if (option && typeof option == "object") {
        Object.assign(requestParams, getRequestParams2(option, requestParams));
      }
    }
    let body = requestParams.body;
    if (body) {
      if (typeof body == "object" && !(body instanceof String) && !(body instanceof ReadableStream) && !(body instanceof Blob) && !(body instanceof ArrayBuffer) && !(body instanceof DataView) && !(body instanceof FormData) && !(body instanceof URLSearchParams) && (typeof TypedArray == "undefined" || !(body instanceof TypedArray))) {
        requestParams.body = JSON.stringify(body);
      }
    }
    let r = new Request(requestParams.url, requestParams);
    Object.freeze(r);
    return new Proxy(r, {
      get(target, prop, receiver) {
        switch (prop) {
          case symbols2.source:
            return target;
            break;
          case symbols2.isProxy:
            return true;
            break;
          case "with":
            return function(...options2) {
              if (body) {
                options2.unshift({ body });
              }
              return request2(target, ...options2);
            };
            break;
          case "toString":
          case "toJSON":
            return function() {
              return target[prop].apply(target);
            };
            break;
          case "blob":
          case "text":
          case "json":
            return function() {
              return target[prop].apply(target);
            };
            break;
          case "body":
            if (!body) {
              body = target.body;
            }
            if (body) {
              if (body[symbols2.isProxy]) {
                return body;
              }
              return bodyProxy2(body, target);
            }
            break;
        }
        return target[prop];
      }
    });
  }
  function getResponseParams2(res, current) {
    let params = current || {};
    if (!params.url && current.url) {
      params.url = current.url;
    }
    for (let prop of ["status", "statusText", "headers", "body", "url", "type", "redirected"]) {
      if (typeof res[prop] == "function") {
        res[prop](params[prop], params);
      } else if (typeof res[prop] != "undefined") {
        if (prop == "url") {
          params.url = new URL(res.url, params.url || "https://localhost/");
        } else {
          params[prop] = res[prop];
        }
      }
    }
    return params;
  }
  function response2(...options) {
    let responseParams = {};
    for (let option of options) {
      if (typeof option == "string") {
        responseParams.body = option;
      } else if (option instanceof Response) {
        Object.assign(responseParams, getResponseParams2(option, responseParams));
      } else if (option && typeof option == "object") {
        if (option instanceof FormData || option instanceof Blob || option instanceof ArrayBuffer || option instanceof DataView || option instanceof ReadableStream || option instanceof URLSearchParams || option instanceof String || typeof TypedArray != "undefined" && option instanceof TypedArray) {
          responseParams.body = option;
        } else {
          Object.assign(responseParams, getResponseParams2(option, responseParams));
        }
      }
    }
    let r = new Response(responseParams.body, responseParams);
    Object.freeze(r);
    return new Proxy(r, {
      get(target, prop, receiver) {
        switch (prop) {
          case symbols2.isProxy:
            return true;
            break;
          case symbols2.source:
            return target;
            break;
          case "with":
            return function(...options2) {
              return response2(target, ...options2);
            };
            break;
          case "body":
            if (responseParams.body) {
              if (responseParams.body[symbols2.isProxy]) {
                return responseParams.body;
              }
              return bodyProxy2(responseParams.body, target);
            } else {
              return bodyProxy2("", target);
            }
            break;
          case "ok":
            return target.status >= 200 && target.status < 400;
            break;
          case "headers":
            return target.headers;
            break;
          default:
            if (prop in responseParams && prop != "toString") {
              return responseParams[prop];
            }
            if (prop in target && prop != "toString") {
              if (typeof target[prop] == "function") {
                return function(...args) {
                  return target[prop].apply(target, args);
                };
              }
              return target[prop];
            }
            break;
        }
        return void 0;
      }
    });
  }
  function appendSearchParams2(url3, params) {
    if (typeof params == "function") {
      params(url3.searchParams, url3);
    } else {
      params = new URLSearchParams(params);
      params.forEach((value, key) => {
        url3.searchParams.append(key, value);
      });
    }
  }
  function url2(...options) {
    let validParams = [
      "hash",
      "host",
      "hostname",
      "href",
      "password",
      "pathname",
      "port",
      "protocol",
      "username",
      "search",
      "searchParams"
    ];
    let u = new URL("https://localhost/");
    for (let option of options) {
      if (typeof option == "string" || option instanceof String) {
        u = new URL(option, u);
      } else if (option instanceof URL || typeof Location != "undefined" && option instanceof Location) {
        u = new URL(option);
      } else if (option instanceof URLSearchParams) {
        appendSearchParams2(u, option);
      } else if (option && typeof option == "object") {
        for (let param in option) {
          if (param == "search") {
            if (typeof option.search == "function") {
              option.search(u.search, u);
            } else {
              u.search = new URLSearchParams(option.search);
            }
          } else if (param == "searchParams") {
            appendSearchParams2(u, option.searchParams);
          } else {
            if (!validParams.includes(param)) {
              throw metroError2("metro.url: unknown url parameter " + metroURL2 + "url/unknown-param-name/", param);
            }
            if (typeof option[param] == "function") {
              option[param](u[param], u);
            } else if (typeof option[param] == "string" || option[param] instanceof String || typeof option[param] == "number" || option[param] instanceof Number || typeof option[param] == "boolean" || option[param] instanceof Boolean) {
              u[param] = "" + option[param];
            } else if (typeof option[param] == "object" && option[param].toString) {
              u[param] = option[param].toString();
            } else {
              throw metroError2("metro.url: unsupported value for " + param + " " + metroURL2 + "url/unsupported-param-value/", options[param]);
            }
          }
        }
      } else {
        throw metroError2("metro.url: unsupported option value " + metroURL2 + "url/unsupported-option-value/", option);
      }
    }
    Object.freeze(u);
    return new Proxy(u, {
      get(target, prop, receiver) {
        switch (prop) {
          case symbols2.isProxy:
            return true;
            break;
          case symbols2.source:
            return target;
            break;
          case "with":
            return function(...options2) {
              return url2(target, ...options2);
            };
            break;
          case "toString":
          case "toJSON":
            return function() {
              return target[prop]();
            };
            break;
        }
        return target[prop];
      }
    });
  }
  function formdata(...options) {
    var params = new FormData();
    for (let option of options) {
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
        throw new metroError2("metro.formdata: unknown option type, only FormData or Object supported", option);
      }
    }
    Object.freeze(params);
    return new Proxy(params, {
      get: (target, prop, receiver) => {
        switch (prop) {
          case symbols2.isProxy:
            return true;
            break;
          case symbols2.source:
            return target;
            break;
          case "with":
            return function(...options2) {
              return formdata(target, ...options2);
            };
            break;
        }
        return target[prop];
      }
    });
  }
  var metroConsole2 = {
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
  function metroError2(message, ...details) {
    metroConsole2.error(message, ...details);
    return new Error(message, ...details);
  }

  // ../metro-oauth2/node_modules/@muze-nl/assert/src/assert.mjs
  globalThis.assertEnabled = false;
  var assert2 = (source, test) => {
    if (globalThis.assertEnabled) {
      let problems = fails2(source, test);
      if (problems) {
        throw new assertError("Assertions failed", problems, source);
      }
    }
  };
  var Required2 = (pattern) => (data2) => fails2(data2, pattern);
  function validURL2(data2) {
    try {
      if (data2 instanceof URL) {
        data2 = data2.href;
      }
      let url3 = new URL(data2);
      if (url3.href != data2) {
        return error2("data is not a valid url", data2, "validURL");
      }
    } catch (e) {
      return error2("data is not a valid url", data2, "validURL");
    }
    return false;
  }
  function fails2(data2, pattern, root) {
    if (!root) {
      root = data2;
    }
    let problems = [];
    if (pattern === Boolean) {
      if (typeof data2 != "boolean") {
        problems.push(error2("data is not a boolean", data2, pattern));
      }
    } else if (pattern === Number) {
      if (typeof data2 != "number") {
        problems.push(error2("data is not a number", data2, pattern));
      }
    } else if (pattern instanceof RegExp) {
      if (Array.isArray(data2)) {
        let index = data2.findIndex((element) => fails2(element, pattern, root));
        if (index > -1) {
          problems.push(error2("data[" + index + "] does not match pattern", data2[index], pattern));
        }
      } else if (!pattern.test(data2)) {
        problems.push(error2("data does not match pattern", data2, pattern));
      }
    } else if (pattern instanceof Function) {
      if (pattern(data2, root)) {
        problems.push(error2("data does not match function", data2, pattern));
      }
    } else if (Array.isArray(pattern)) {
      if (!Array.isArray(data2)) {
        problems.push(error2("data is not an array", data2, []));
      }
      for (p of pattern) {
        let problem = fails2(data2, p, root);
        if (Array.isArray(problem)) {
          problems.concat(problem);
        } else if (problem) {
          problems.push(problem);
        }
      }
    } else if (pattern && typeof pattern == "object") {
      if (Array.isArray(data2)) {
        let index = data2.findIndex((element) => fails2(element, pattern, root));
        if (index > -1) {
          problems.push(error2("data[" + index + "] does not match pattern", data2[index], pattern));
        }
      } else if (!data2 || typeof data2 != "object") {
        problems.push(error2("data is not an object, pattern is", data2, pattern));
      } else {
        if (data2 instanceof URLSearchParams) {
          data2 = Object.fromEntries(data2);
        }
        let p2 = problems[problems.length - 1];
        for (const [wKey, wVal] of Object.entries(pattern)) {
          let result = fails2(data2[wKey], wVal, root);
          if (result) {
            if (!p2 || typeof p2 == "string") {
              p2 = {};
              problems.push(error2(p2, data2[wKey], wVal));
            }
            p2[wKey] = result.problems;
          }
        }
      }
    } else {
      if (pattern != data2) {
        problems.push(error2("data and pattern are not equal", data2, pattern));
      }
    }
    if (problems.length) {
      return problems;
    }
    return false;
  }
  var assertError = class extends Error {
    constructor(message, problems, ...details) {
      super(message);
      this.problems = problems;
      this.details = details;
    }
  };
  function error2(message, found, expected) {
    return {
      message,
      found,
      expected
    };
  }

  // ../metro-oauth2/src/tokenstore.mjs
  function tokenStore(site) {
    let localState, localTokens;
    if (typeof localStorage !== "undefined") {
      localState = {
        get: () => localStorage.getItem("metro/state:" + site),
        set: (value) => localStorage.setItem("metro/state:" + site, value),
        has: () => localStorage.getItem("metro/state:" + site) !== null
      };
      localTokens = {
        get: (name) => localStorage.getItem(site + ":" + name),
        set: (name, value) => localStorage.setItem(site + ":" + name, value),
        has: (name) => localStorage.getItem(site + ":" + name) !== null
      };
    } else {
      let stateMap = /* @__PURE__ */ new Map();
      localState = {
        get: () => stateMap.get("metro/state:" + site),
        set: (value) => stateMap.set("metro/state:" + site, value),
        has: () => stateMap.has("metro/state:" + site)
      };
      localTokens = /* @__PURE__ */ new Map();
    }
    return {
      state: localState,
      tokens: localTokens
    };
  }

  // ../metro-oauth2/src/oauth2.mjs
  function mwOAuth2(options) {
    const defaultOptions = {
      client: client2(),
      force_authorization: false,
      site: "default",
      oauth2_configuration: {
        authorization_endpoint: "/authorize",
        token_endpoint: "/token",
        redirect_uri: globalThis.document?.location.href,
        grant_type: "authorization_code",
        code_verifier: security.generateCodeVerifier(64)
      },
      callbacks: {
        authorize: (url3) => document.location = url3
      }
    };
    assert2(options, {});
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
    assert2(options, {
      oauth2_configuration: {
        client_id: Required2(),
        grant_type: "authorization_code",
        authorization_endpoint: Required2(),
        token_endpoint: Required2(),
        redirect_uri: Required2(validURL2)
      }
    });
    for (let option in oauth2) {
      switch (option) {
        case "access_token":
        case "authorization_code":
        case "refresh_token":
          options.tokens.set(option, oauth2[option]);
          break;
      }
    }
    return async function(req, next) {
      if (options.force_authorization) {
        return oauth2authorized(req, next);
      }
      let res;
      try {
        res = await next(req);
        if (res.ok) {
          return res;
        }
      } catch (err) {
        switch (res.status) {
          case 400:
          case 401:
            return oauth2authorized(req, next);
            break;
        }
        throw err;
      }
      return res;
    };
    async function oauth2authorized(req, next) {
      getTokensFromLocation();
      if (!options.tokens.has("access_token")) {
        try {
          let token = await fetchAccessToken();
          if (!token) {
            return response2("false");
          }
        } catch (e) {
          console.log("caught", e);
          throw e;
        }
        return oauth2authorized(req, next);
      } else if (isExpired(req)) {
        let token = await fetchRefreshToken();
        if (!token) {
          return response2("false");
        }
        return oauth2authorized(req, next);
      } else {
        let accessToken = options.tokens.get("access_token");
        req = request2(req, {
          headers: {
            Authorization: accessToken.type + " " + accessToken.value
          }
        });
        return next(req);
      }
    }
    function getTokensFromLocation() {
      if (typeof window !== "undefined" && window?.location) {
        let url3 = url2(window.location);
        let code, state, params;
        if (url3.searchParams.has("code")) {
          params = url3.searchParams;
          url3 = url3.with({ search: "" });
          history.pushState({}, "", url3.href);
        } else if (url3.hash) {
          let query = url3.hash.substr(1);
          params = new URLSearchParams("?" + query);
          url3 = url3.with({ hash: "" });
          history.pushState({}, "", url3.href);
        }
        if (params) {
          code = params.get("code");
          state = params.get("state");
          let storedState = options.state.get("metro/state");
          if (!state || state !== storedState) {
            return;
          }
          if (code) {
            options.tokens.set("authorization_code", code);
          }
        }
      }
    }
    async function fetchAccessToken() {
      if (oauth2.grant_type === "authorization_code" && !options.tokens.has("authorization_code")) {
        let authReqURL = getAuthorizationCodeURL();
        if (!options.callbacks.authorize || typeof options.callbacks.authorize !== "function") {
          throw metroError2("oauth2mw: oauth2 with grant_type:authorization_code requires a callback function in client options.options.callbacks.authorize");
        }
        let token = await options.callbacks.authorize(authReqURL);
        if (token) {
          options.tokens.set("authorization_code", token);
        } else {
          return response2(false);
        }
      }
      let tokenReq = getAccessTokenRequest();
      let response3 = await options.client.post(tokenReq);
      if (!response3.ok) {
        throw metroError2("OAuth2mw: fetch access_token: " + response3.status + ": " + response3.statusText, { cause: tokenReq });
      }
      let data2 = await response3.json();
      options.tokens.set("access_token", {
        value: data2.access_token,
        expires: getExpires(data2.expires_in),
        type: data2.token_type,
        scope: data2.scope
      });
      if (data2.refresh_token) {
        let token = {
          value: data2.refresh_token
        };
        options.tokens.set("refresh_token", token);
      }
      return data2;
    }
    async function fetchRefreshToken() {
      let refreshTokenReq = getAccessTokenRequest("refresh_token");
      let response3 = await options.client.post(refreshTokenReq);
      if (!response3.ok) {
        throw metroError2("OAuth2mw: refresh access_token: " + response3.status + ": " + response3.statusText, { cause: refreshTokenReq });
      }
      let data2 = await response3.json();
      options.tokens.set("access_token", {
        value: data2.access_token,
        expires: getExpires(data2.expires_in),
        type: data2.token_type,
        scope: data2.scope
      });
      if (data2.refresh_token) {
        let token = {
          value: data2.refresh_token
        };
        options.tokens.set("refresh_token", token);
      }
      return data2;
    }
    function getAuthorizationCodeURL() {
      if (!oauth2.authorize_endpoint) {
        throw metroError2("oauth2mw: Missing options.endpoints.authorize url");
      }
      let url3 = url2(oauth2.authorize_endpoint, { hash: "" });
      assert2(oauth2, {
        client_id: /.+/,
        redirect_uri: /.+/,
        scope: /.*/
      });
      let search = {
        response_type: "code",
        // implicit flow uses 'token' here, but is not considered safe, so not supported
        client_id: oauth2.client_id,
        client_secret: oauth2.client_secret,
        redirect_uri: oauth2.redirect_uri,
        state: oauth2.state || security.createState(40)
        // OAuth2.1 RFC says optional, but its a good idea to always add/check it
      };
      options.state.set(search.state);
      if (oauth2.code_verifier) {
        delete search.client_secret;
        search.code_challenge = security.generateCodeChallenge(oauth2.code_verifier);
        search.code_challenge_method = "S256";
      }
      if (oauth2.scope) {
        search.scope = oauth2.scope;
      }
      return url2(url3, { search });
    }
    function getAccessTokenRequest(grant_type = null) {
      assert2(oauth2, {
        client_id: /.+/,
        redirect_uri: /.+/
      });
      if (!oauth2.token_endpoint) {
        throw metroError2("oauth2mw: Missing options.endpoints.token url");
      }
      let url3 = url2(oauth2.token_endpoint, { hash: "" });
      let params = {
        grant_type: grant_type || oauth2.grant_type,
        client_id: oauth2.client_id
      };
      if (oauth2.code_verifier) {
        params.code_verifier = oauth2.code_verifier;
      } else {
        params.client_secret = oauth2.client_secret;
      }
      if (oauth2.scope) {
        params.scope = oauth2.scope;
      }
      switch (oauth2.grant_type) {
        case "authorization_code":
          params.redirect_uri = oauth2.redirect_uri;
          params.code = options.tokens.get("authorization_code");
          break;
        case "client_credentials":
          break;
        case "refresh_token":
          params.refresh_token = oauth2.refresh_token;
          break;
        default:
          throw new Error("Unknown grant_type: ".oauth2.grant_type);
          break;
      }
      return request2(url3, { method: "POST" }, formdata(params));
    }
    function isExpired(req) {
      if (req.oauth2 && req.options.tokens && req.options.tokens.has("access_token")) {
        let now = /* @__PURE__ */ new Date();
        let token = req.options.tokens.get("access_token");
        return now.getTime() > token.expires.getTime();
      }
      return false;
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
  }
  var security = {
    /**
     * returns a PKCE code_verifier, as a hex encoded string
     */
    generateCodeVerifier: function(size = 64) {
      const code_verifier = new Uint8Array(size);
      globalThis.crypto.getRandomValues(code_verifier);
      return code_verifier.toString("hex");
    },
    /**
     * Returns a PKCE code_challenge derived from a code_verifier
     */
    generateCodeChallenge: async function(code_verifier) {
      const b64encoded = security.base64url_encode(code_verifier);
      const encoder = new TextEncoder();
      const data2 = encoder.encode(b64encoded);
      return await globalThis.crypto.subtle.digest("SHA-256", data2);
    },
    /**
     * Base64url encoding, which handles UTF-8 input strings correctly.
     */
    base64url_encode: function(buffer) {
      const byteString = Array.from(new Uint8Array(buffer), (b) => String.fromCharCode(b)).join("");
      return btoa(byteString).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    },
    /**
     * Creates and stores a random state to use in the authorization code URL
     */
    createState: function(length) {
      const validChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
      let randomState = "";
      let counter = 0;
      while (counter < length) {
        randomState += validChars.charAt(Math.floor(Math.random() * validChars.length));
        counter++;
      }
      return randomState;
    }
  };

  // src/oidcmw.mjs
  function oidcmw(options = {}) {
    const defaultOptions = {
      client: client(),
      force_authorization: false
    };
    options = Object.assign({}, defaultOptions, options);
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
          issuer: options.issuer
        });
      }
      if (!options.client_info?.client_id) {
        assert(options.client_info?.client_name, Required());
        if (!options.openid_configuration.registration_endpoint) {
          throw metroError("metro.oidcmw: Error: issuer " + options.issuer + " does not support dynamic client registration, but you haven't specified a client_id");
        }
        options.client_info = await register({
          registration_endpoint: options.openid_configuration.registration_endpoint,
          client_info: options.client_info
        });
      }
      const oauth2Options = Object.assign(
        {
          site: options.issuer,
          client: options.client,
          force_authorization: true,
          oauth2_configuration: {
            client_id: options.client_info.client_id,
            client_secret: options.client_info.client_secret,
            grant_type: "authorization_code",
            authorization_endpoint: options.openid_configuration.authorization_endpoint,
            token_endpoint: options.openid_configuration.token_endpoint
          }
        }
        //...
      );
      const oauth2client = options.client.with(options.issuer).with(mwOAuth2(oauth2Options));
      res = await oauth2client.fetch(req);
      return res;
    };
  }

  // src/browser.mjs
  var oidc = {
    discover: oidcDiscovery,
    register,
    oidcmw
  };
  globalThis.oidc = oidc;
})();
//# sourceMappingURL=browser-dev.js.map
