(() => {
  // node_modules/@muze-nl/oldm/src/oldm.mjs
  function oldm(options) {
    return new Context(options);
  }
  var rdfType = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
  var prefixes = {
    rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
    solid: "http://www.w3.org/ns/solid/terms#",
    schema: "http://schema.org/",
    vcard: "http://www.w3.org/2006/vcard/ns#"
  };
  var Context = class {
    constructor(options) {
      this.prefixes = { ...prefixes, ...options?.prefixes };
      if (!this.prefixes["xsd"]) {
        this.prefixes["xsd"] = "http://www.w3.org/2001/XMLSchema#";
      }
      this.parser = options?.parser;
      this.writer = options?.writer;
      this.sources = /* @__PURE__ */ Object.create(null);
      this.separator = options?.separator ?? "$";
    }
    parse(input, url, type) {
      const { quads, prefixes: prefixes2 } = this.parser(input, url, type);
      if (prefixes2) {
        for (let prefix in prefixes2) {
          let prefixURL = prefixes2[prefix];
          if (prefixURL.match(/^http(s?):\/\/$/i)) {
            prefixURL += url.substring(prefixURL.length);
          } else
            try {
              prefixURL = new URL(prefixes2[prefix], url).href;
            } catch (err) {
              console.error("Could not parse prefix", prefixes2[prefix], err.message);
            }
          if (!this.prefixes[prefix]) {
            this.prefixes[prefix] = prefixURL;
          }
        }
      }
      this.sources[url] = new Graph(quads, url, type, prefixes2, this);
      return this.sources[url];
    }
    setType(literal, shortType) {
      if (!shortType) {
        return literal;
      }
      if (typeof literal == "string") {
        literal = new String(literal);
      } else if (typeof result == "number") {
        literal = new Number(literal);
      }
      if (typeof literal !== "object") {
        throw new Error("cannot set type on ", literal, shortType);
      }
      literal.type = shortType;
      return literal;
    }
    getType(literal) {
      if (literal && typeof literal == "object") {
        return literal.type;
      }
      return null;
    }
  };
  var Graph = class {
    #blankNodes = /* @__PURE__ */ Object.create(null);
    constructor(quads, url, mimetype, prefixes2, context) {
      this.mimetype = mimetype;
      this.url = url;
      this.prefixes = prefixes2;
      this.context = context;
      this.subjects = /* @__PURE__ */ Object.create(null);
      for (let quad of quads) {
        let subject;
        if (quad.subject.termType == "BlankNode") {
          let shortPred = this.shortURI(quad.predicate.id, ":");
          let shortObj;
          switch (shortPred) {
            case "rdf:first":
              subject = this.addCollection(quad.subject.id);
              shortObj = this.shortURI(quad.object.id, ":");
              if (shortObj != "rdf:nil") {
                const value = this.getValue(quad.object);
                if (value) {
                  subject.push(value);
                }
              }
              continue;
            case "rdf:rest":
              this.#blankNodes[quad.object.id] = this.#blankNodes[quad.subject.id];
              continue;
            default:
              subject = this.addBlankNode(quad.subject.id);
              break;
          }
        } else {
          subject = this.addNamedNode(quad.subject.id);
        }
        subject.addPredicate(quad.predicate.id, quad.object);
      }
      if (this.subjects[url]) {
        this.primary = this.subjects[url];
      } else {
        this.primary = null;
      }
      Object.defineProperty(this, "data", {
        get() {
          return Object.values(this.subjects);
        }
      });
    }
    addNamedNode(uri) {
      let absURI = new URL(uri, this.url).href;
      if (!this.subjects[absURI]) {
        this.subjects[absURI] = new NamedNode(absURI, this);
      }
      return this.subjects[absURI];
    }
    addBlankNode(id) {
      if (!this.#blankNodes[id]) {
        this.#blankNodes[id] = new BlankNode(this);
      }
      return this.#blankNodes[id];
    }
    addCollection(id) {
      if (!this.#blankNodes[id]) {
        this.#blankNodes[id] = new Collection(this);
      }
      return this.#blankNodes[id];
    }
    write() {
      return this.context.writer(this);
    }
    get(shortID) {
      return this.subjects[this.fullURI(shortID)];
    }
    fullURI(shortURI, separator = null) {
      if (!separator) {
        separator = this.context.separator;
      }
      const [prefix, path] = shortURI.split(separator);
      if (path) {
        return this.prefixes[prefix] + path;
      }
      return shortURI;
    }
    shortURI(fullURI, separator = null) {
      if (!separator) {
        separator = this.context.separator;
      }
      for (let prefix in this.context.prefixes) {
        if (fullURI.startsWith(this.context.prefixes[prefix])) {
          return prefix + separator + fullURI.substring(this.context.prefixes[prefix].length);
        }
      }
      if (this.url && fullURI.startsWith(this.url)) {
        return fullURI.substring(this.url.length);
      }
      return fullURI;
    }
    /**
     * This sets the type of a literal, usually one of the xsd types
     */
    setType(literal, type) {
      const shortType = this.shortURI(type);
      return this.context.setType(literal, shortType);
    }
    /**
     * This returns the type of a literal, or null
     */
    getType(literal) {
      return this.context.getType(literal);
    }
    setLanguage(literal, language) {
      if (typeof literal == "string") {
        literal = new String(literal);
      } else if (typeof result == "number") {
        literal = new Number(literal);
      }
      if (typeof literal !== "object") {
        throw new Error("cannot set language on ", literal);
      }
      literal.language = language;
      return literal;
    }
    getValue(object) {
      let result2;
      if (object.termType == "Literal") {
        result2 = object.value;
        let datatype = object.datatype?.id;
        if (datatype) {
          result2 = this.setType(result2, datatype);
        }
        let language = object.language;
        if (language) {
          result2 = this.setLanguage(result2, language);
        }
      } else if (object.termType == "BlankNode") {
        result2 = this.addBlankNode(object.id);
      } else {
        result2 = this.addNamedNode(object.id);
      }
      return result2;
    }
  };
  var BlankNode = class {
    constructor(graph) {
      Object.defineProperty(this, "graph", {
        value: graph,
        writable: false,
        enumerable: false
      });
    }
    addPredicate(predicate, object) {
      if (predicate.id) {
        predicate = predicate.id;
      }
      if (predicate == rdfType) {
        let type = this.graph.shortURI(object.id);
        this.addType(type);
      } else {
        const value = this.graph.getValue(object);
        predicate = this.graph.shortURI(predicate);
        if (!this[predicate]) {
          this[predicate] = value;
        } else if (Array.isArray(this[predicate])) {
          this[predicate].push(value);
        } else {
          this[predicate] = [this[predicate], value];
        }
      }
    }
    /**
     * Adds a rdfType value, stored in this.a
     * Subjects can have more than one type (or class), unlike literals
     * The type value can be any URI, xsdTypes are unexpected here
     */
    addType(type) {
      if (!this.a) {
        this.a = type;
      } else {
        if (!Array.isArray(this.a)) {
          this.a = [this.a];
        }
        this.a.push(type);
      }
    }
  };
  var NamedNode = class extends BlankNode {
    constructor(id, graph) {
      super(graph);
      Object.defineProperty(this, "id", {
        value: id,
        writable: false,
        enumerable: true
      });
    }
  };
  var Collection = class extends Array {
    constructor(id, graph) {
      super();
      Object.defineProperty(this, "graph", {
        value: graph,
        writable: false,
        enumerable: false
      });
    }
  };

  // src/oldmmw.mjs
  function oldmmw(options) {
    options = Object.assign({
      contentType: "text/turtle",
      prefixes: {
        "ldp": "http://www.w3.org/ns/ldp#",
        "rdf": "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
        "dct": "http://purl.org/dc/terms/",
        "stat": "http://www.w3.org/ns/posix/stat#",
        "turtle": "http://www.w3.org/ns/iana/media-types/text/turtle#",
        "schem": "https://schema.org/",
        "solid": "http://www.w3.org/ns/solid/terms#",
        "acl": "http://www.w3.org/ns/auth/acl#",
        "pims": "http://www.w3.org/ns/pim/space#",
        "vcard": "http://www.w3.org/2006/vcard/ns#",
        "foaf": "http://xmlns.com/foaf/0.1/"
      },
      parser: oldm.n3Parser,
      writer: oldm.n3Writer
    }, options);
    if (!options.prefixes["ldp"]) {
      options.prefixes["ldp"] = "http://www.w3.org/ns/ldp#";
    }
    const context = oldm(options);
    return async function oldmmw2(req, next) {
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
          if (isLinkedData(req.headers.get("Content-Type"))) {
            req = req.with({
              body: await context.writer(req.data)
            });
          }
        }
      }
      let res = await next(req);
    };
  }

  // src/index.mjs
  globalThis.oldmmw = oldmmw;
  var src_default = oldmmw;
})();
//# sourceMappingURL=browser.js.map
