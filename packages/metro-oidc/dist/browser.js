(() => {
  // node_modules/@muze-nl/metro/src/metro.mjs
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
          return this.#fetch(request(
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
    #fetch(req) {
      if (!req.url) {
        throw metroError("metro.client." + r.method.toLowerCase() + ": Missing url parameter " + metroURL + "client/missing-url-param/", req);
      }
      let metrofetch = async (req2) => {
        if (req2[symbols.isProxy]) {
          req2 = req2[symbols.source];
        }
        return response(await fetch(req2));
      };
      let middlewares = [metrofetch].concat(this.#options?.middlewares?.slice() || []);
      let options = this.#options;
      let next;
      for (let middleware of middlewares) {
        next = /* @__PURE__ */ function(next2, middleware2) {
          return async function(req2) {
            let res;
            let tracers = Object.values(_Client.tracers);
            for (let tracer of tracers) {
              if (tracer.request) {
                tracer.request.call(tracer, req2);
              }
            }
            res = await middleware2(req2, next2);
            for (let tracer of tracers) {
              if (tracer.response) {
                tracer.response.call(tracer, res);
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
  function bodyProxy(body, r2) {
    let source = r2.body;
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
        return Reflect.ownKeys(body);
      },
      getOwnPropertyDescriptor(target, prop) {
        return Object.getOwnPropertyDescriptor(body, prop);
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
    let r2 = new Request(requestParams.url, requestParams);
    Object.freeze(r2);
    return new Proxy(r2, {
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
    let r2 = new Response(responseParams.body, responseParams);
    Object.freeze(r2);
    return new Proxy(r2, {
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

  // node_modules/@muze-nl/metro/src/mw/json.mjs
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

  // node_modules/@muze-nl/metro/src/mw/thrower.mjs
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

  // node_modules/@muze-nl/assert/src/assert.mjs
  globalThis.assertEnabled = false;
  var assert = (source, test) => {
    if (globalThis.assertEnabled) {
      let problems = fails(source, test);
      if (problems) {
        throw new assertError("Assertions failed", problems, source);
      }
    }
  };
  var Optional = (pattern) => (data2, root, path) => {
    if (data2 == null || typeof data2 == "undefined") {
      return false;
    } else {
      return fails(data2, pattern, root, path);
    }
  };
  var Required = (pattern) => (data2, root, path) => {
    if (data2 == null || typeof data2 == "undefined") {
      return error("data is required", data2, pattern || "any value", path);
    } else if (typeof pattern != "undefined") {
      return fails(data2, pattern, root, path);
    } else {
      return false;
    }
  };
  var Recommended = (pattern) => (data2, root, path) => {
    if (data2 == null || typeof data2 == "undefined") {
      console.warn("data does not contain recommended value", data2, pattern, path);
      return false;
    } else {
      return fails(data2, pattern, root, path);
    }
  };
  var oneOf = (...patterns) => (data2, root, path) => {
    for (let pattern of patterns) {
      if (!fails(data2, pattern, root, path)) {
        return false;
      }
    }
    return error("data does not match oneOf patterns", data2, patterns, path);
  };
  var anyOf = (...patterns) => (data2, root, path) => {
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
  function validURL(data2, root, path) {
    try {
      if (data2 instanceof URL) {
        data2 = data2.href;
      }
      let url2 = new URL(data2);
      if (url2.href != data2) {
        if (url2.href + "/" == data2 || url2.href == data2 + "/") {
          return false;
        }
        return error("data is not a valid url", data2, "validURL", path);
      }
    } catch (e) {
      return error("data is not a valid url", data2, "validURL", path);
    }
    return false;
  }
  function validEmail(data2, root, path) {
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data2)) {
      return false;
    }
    return error("data is not a valid email", data2, "validEmail", path);
  }
  var instanceOf = (constructor) => (data2, root, path) => !(data2 instanceof constructor) ? error("data is not an instanceof pattern", data2, constructor, path) : false;
  var not = (pattern) => (data2, root, path) => {
    let problems = fails(data2, pattern, root, path);
    if (!problems) {
      return error("data matches pattern, when required not to", data2, pattern, path);
    }
    return false;
  };
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
      for (let p of pattern) {
        for (let index of data2.keys()) {
          let problem = fails(data2[index], p, root, path + "[" + index + "]");
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
  var assertError = class extends Error {
    constructor(message, problems, ...details) {
      super(message);
      this.problems = problems;
      this.details = details;
    }
  };
  function error(message, found, expected, path) {
    return {
      message,
      found,
      expected,
      path
    };
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
    const defaultOptions = {
      client: client().with(thrower()).with(jsonmw()),
      requireDynamicRegistration: false
    };
    options = Object.assign({}, defaultOptions, options);
    assert(options, {
      client: Required(instanceOf(client().constructor)),
      issuer: Required(validURL)
    });
    const openid_provider_metadata = {
      issuer: Required(options.issuer),
      authorization_endpoint: Required(validURL),
      token_endpoint: Required(validURL),
      userinfo_endpoint: Recommended(validURL),
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
    const response2 = await options.client.get(
      // https://openid.net/specs/openid-connect-discovery-1_0.html#ProviderConfigurationRequest
      // note: this allows path components in the options.issuer url
      url(options.issuer, ".well-known/openid-configuration")
    );
    assert(response2.body, openid_provider_metadata);
    assert(response2.body.issuer, options.issuer);
    return response2.body;
  }

  // src/oidc.register.mjs
  async function register(options) {
    const defaultOptions = {
      client: client().with(thrower()).with(jsonmw())
    };
    options = Object.assign({}, defaultOptions, options);
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
      client: instanceOf(client().constructor),
      registration_endpoint: validURL,
      client_info: openid_client_metadata
    });
    let response2 = await options.client.post(options.registration_endpoint, {
      body: options.client_info
    });
    let info = response2.body;
    if (!info.client_id || !info.client_secret) {
      throw metroError("metro.oidc: Error: dynamic registration of client failed, no client_id or client_secret returned", response2);
    }
    options.client_info = Object.assign(options.client_info, info);
    return options.client_info;
  }

  // src/browser.mjs
  window.oidc = {
    discover: oidcDiscovery,
    register
  };
})();
