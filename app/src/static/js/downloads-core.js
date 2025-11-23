var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {
      get: all[name],
      enumerable: true,
      configurable: true,
      set: (newValue) => all[name] = () => newValue
    });
};
var __esm = (fn, res) => () => (fn && (res = fn(fn = 0)), res);

// node_modules/@capacitor/core/dist/index.js
class WebPlugin {
  constructor() {
    this.listeners = {};
    this.retainedEventArguments = {};
    this.windowListeners = {};
  }
  addListener(eventName, listenerFunc) {
    let firstListener = false;
    const listeners = this.listeners[eventName];
    if (!listeners) {
      this.listeners[eventName] = [];
      firstListener = true;
    }
    this.listeners[eventName].push(listenerFunc);
    const windowListener = this.windowListeners[eventName];
    if (windowListener && !windowListener.registered) {
      this.addWindowListener(windowListener);
    }
    if (firstListener) {
      this.sendRetainedArgumentsForEvent(eventName);
    }
    const remove = async () => this.removeListener(eventName, listenerFunc);
    const p = Promise.resolve({ remove });
    return p;
  }
  async removeAllListeners() {
    this.listeners = {};
    for (const listener in this.windowListeners) {
      this.removeWindowListener(this.windowListeners[listener]);
    }
    this.windowListeners = {};
  }
  notifyListeners(eventName, data, retainUntilConsumed) {
    const listeners = this.listeners[eventName];
    if (!listeners) {
      if (retainUntilConsumed) {
        let args = this.retainedEventArguments[eventName];
        if (!args) {
          args = [];
        }
        args.push(data);
        this.retainedEventArguments[eventName] = args;
      }
      return;
    }
    listeners.forEach((listener) => listener(data));
  }
  hasListeners(eventName) {
    var _a;
    return !!((_a = this.listeners[eventName]) === null || _a === undefined ? undefined : _a.length);
  }
  registerWindowListener(windowEventName, pluginEventName) {
    this.windowListeners[pluginEventName] = {
      registered: false,
      windowEventName,
      pluginEventName,
      handler: (event) => {
        this.notifyListeners(pluginEventName, event);
      }
    };
  }
  unimplemented(msg = "not implemented") {
    return new Capacitor.Exception(msg, ExceptionCode.Unimplemented);
  }
  unavailable(msg = "not available") {
    return new Capacitor.Exception(msg, ExceptionCode.Unavailable);
  }
  async removeListener(eventName, listenerFunc) {
    const listeners = this.listeners[eventName];
    if (!listeners) {
      return;
    }
    const index = listeners.indexOf(listenerFunc);
    this.listeners[eventName].splice(index, 1);
    if (!this.listeners[eventName].length) {
      this.removeWindowListener(this.windowListeners[eventName]);
    }
  }
  addWindowListener(handle) {
    window.addEventListener(handle.windowEventName, handle.handler);
    handle.registered = true;
  }
  removeWindowListener(handle) {
    if (!handle) {
      return;
    }
    window.removeEventListener(handle.windowEventName, handle.handler);
    handle.registered = false;
  }
  sendRetainedArgumentsForEvent(eventName) {
    const args = this.retainedEventArguments[eventName];
    if (!args) {
      return;
    }
    delete this.retainedEventArguments[eventName];
    args.forEach((arg) => {
      this.notifyListeners(eventName, arg);
    });
  }
}
var ExceptionCode, CapacitorException, getPlatformId = (win) => {
  var _a, _b;
  if (win === null || win === undefined ? undefined : win.androidBridge) {
    return "android";
  } else if ((_b = (_a = win === null || win === undefined ? undefined : win.webkit) === null || _a === undefined ? undefined : _a.messageHandlers) === null || _b === undefined ? undefined : _b.bridge) {
    return "ios";
  } else {
    return "web";
  }
}, createCapacitor = (win) => {
  const capCustomPlatform = win.CapacitorCustomPlatform || null;
  const cap = win.Capacitor || {};
  const Plugins = cap.Plugins = cap.Plugins || {};
  const getPlatform = () => {
    return capCustomPlatform !== null ? capCustomPlatform.name : getPlatformId(win);
  };
  const isNativePlatform = () => getPlatform() !== "web";
  const isPluginAvailable = (pluginName) => {
    const plugin = registeredPlugins.get(pluginName);
    if (plugin === null || plugin === undefined ? undefined : plugin.platforms.has(getPlatform())) {
      return true;
    }
    if (getPluginHeader(pluginName)) {
      return true;
    }
    return false;
  };
  const getPluginHeader = (pluginName) => {
    var _a;
    return (_a = cap.PluginHeaders) === null || _a === undefined ? undefined : _a.find((h) => h.name === pluginName);
  };
  const handleError = (err) => win.console.error(err);
  const registeredPlugins = new Map;
  const registerPlugin = (pluginName, jsImplementations = {}) => {
    const registeredPlugin = registeredPlugins.get(pluginName);
    if (registeredPlugin) {
      console.warn(`Capacitor plugin "${pluginName}" already registered. Cannot register plugins twice.`);
      return registeredPlugin.proxy;
    }
    const platform = getPlatform();
    const pluginHeader = getPluginHeader(pluginName);
    let jsImplementation;
    const loadPluginImplementation = async () => {
      if (!jsImplementation && platform in jsImplementations) {
        jsImplementation = typeof jsImplementations[platform] === "function" ? jsImplementation = await jsImplementations[platform]() : jsImplementation = jsImplementations[platform];
      } else if (capCustomPlatform !== null && !jsImplementation && "web" in jsImplementations) {
        jsImplementation = typeof jsImplementations["web"] === "function" ? jsImplementation = await jsImplementations["web"]() : jsImplementation = jsImplementations["web"];
      }
      return jsImplementation;
    };
    const createPluginMethod = (impl, prop) => {
      var _a, _b;
      if (pluginHeader) {
        const methodHeader = pluginHeader === null || pluginHeader === undefined ? undefined : pluginHeader.methods.find((m) => prop === m.name);
        if (methodHeader) {
          if (methodHeader.rtype === "promise") {
            return (options) => cap.nativePromise(pluginName, prop.toString(), options);
          } else {
            return (options, callback) => cap.nativeCallback(pluginName, prop.toString(), options, callback);
          }
        } else if (impl) {
          return (_a = impl[prop]) === null || _a === undefined ? undefined : _a.bind(impl);
        }
      } else if (impl) {
        return (_b = impl[prop]) === null || _b === undefined ? undefined : _b.bind(impl);
      } else {
        throw new CapacitorException(`"${pluginName}" plugin is not implemented on ${platform}`, ExceptionCode.Unimplemented);
      }
    };
    const createPluginMethodWrapper = (prop) => {
      let remove;
      const wrapper = (...args) => {
        const p = loadPluginImplementation().then((impl) => {
          const fn = createPluginMethod(impl, prop);
          if (fn) {
            const p2 = fn(...args);
            remove = p2 === null || p2 === undefined ? undefined : p2.remove;
            return p2;
          } else {
            throw new CapacitorException(`"${pluginName}.${prop}()" is not implemented on ${platform}`, ExceptionCode.Unimplemented);
          }
        });
        if (prop === "addListener") {
          p.remove = async () => remove();
        }
        return p;
      };
      wrapper.toString = () => `${prop.toString()}() { [capacitor code] }`;
      Object.defineProperty(wrapper, "name", {
        value: prop,
        writable: false,
        configurable: false
      });
      return wrapper;
    };
    const addListener = createPluginMethodWrapper("addListener");
    const removeListener = createPluginMethodWrapper("removeListener");
    const addListenerNative = (eventName, callback) => {
      const call = addListener({ eventName }, callback);
      const remove = async () => {
        const callbackId = await call;
        removeListener({
          eventName,
          callbackId
        }, callback);
      };
      const p = new Promise((resolve) => call.then(() => resolve({ remove })));
      p.remove = async () => {
        console.warn(`Using addListener() without 'await' is deprecated.`);
        await remove();
      };
      return p;
    };
    const proxy = new Proxy({}, {
      get(_, prop) {
        switch (prop) {
          case "$$typeof":
            return;
          case "toJSON":
            return () => ({});
          case "addListener":
            return pluginHeader ? addListenerNative : addListener;
          case "removeListener":
            return removeListener;
          default:
            return createPluginMethodWrapper(prop);
        }
      }
    });
    Plugins[pluginName] = proxy;
    registeredPlugins.set(pluginName, {
      name: pluginName,
      proxy,
      platforms: new Set([...Object.keys(jsImplementations), ...pluginHeader ? [platform] : []])
    });
    return proxy;
  };
  if (!cap.convertFileSrc) {
    cap.convertFileSrc = (filePath) => filePath;
  }
  cap.getPlatform = getPlatform;
  cap.handleError = handleError;
  cap.isNativePlatform = isNativePlatform;
  cap.isPluginAvailable = isPluginAvailable;
  cap.registerPlugin = registerPlugin;
  cap.Exception = CapacitorException;
  cap.DEBUG = !!cap.DEBUG;
  cap.isLoggingEnabled = !!cap.isLoggingEnabled;
  return cap;
}, initCapacitorGlobal = (win) => win.Capacitor = createCapacitor(win), Capacitor, registerPlugin, encode = (str) => encodeURIComponent(str).replace(/%(2[346B]|5E|60|7C)/g, decodeURIComponent).replace(/[()]/g, escape), decode = (str) => str.replace(/(%[\dA-F]{2})+/gi, decodeURIComponent), CapacitorCookiesPluginWeb, CapacitorCookies, readBlobAsBase64 = async (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader;
  reader.onload = () => {
    const base64String = reader.result;
    resolve(base64String.indexOf(",") >= 0 ? base64String.split(",")[1] : base64String);
  };
  reader.onerror = (error) => reject(error);
  reader.readAsDataURL(blob);
}), normalizeHttpHeaders = (headers = {}) => {
  const originalKeys = Object.keys(headers);
  const loweredKeys = Object.keys(headers).map((k) => k.toLocaleLowerCase());
  const normalized = loweredKeys.reduce((acc, key, index) => {
    acc[key] = headers[originalKeys[index]];
    return acc;
  }, {});
  return normalized;
}, buildUrlParams = (params, shouldEncode = true) => {
  if (!params)
    return null;
  const output = Object.entries(params).reduce((accumulator, entry) => {
    const [key, value] = entry;
    let encodedValue;
    let item;
    if (Array.isArray(value)) {
      item = "";
      value.forEach((str) => {
        encodedValue = shouldEncode ? encodeURIComponent(str) : str;
        item += `${key}=${encodedValue}&`;
      });
      item.slice(0, -1);
    } else {
      encodedValue = shouldEncode ? encodeURIComponent(value) : value;
      item = `${key}=${encodedValue}`;
    }
    return `${accumulator}&${item}`;
  }, "");
  return output.substr(1);
}, buildRequestInit = (options, extra = {}) => {
  const output = Object.assign({ method: options.method || "GET", headers: options.headers }, extra);
  const headers = normalizeHttpHeaders(options.headers);
  const type = headers["content-type"] || "";
  if (typeof options.data === "string") {
    output.body = options.data;
  } else if (type.includes("application/x-www-form-urlencoded")) {
    const params = new URLSearchParams;
    for (const [key, value] of Object.entries(options.data || {})) {
      params.set(key, value);
    }
    output.body = params.toString();
  } else if (type.includes("multipart/form-data") || options.data instanceof FormData) {
    const form = new FormData;
    if (options.data instanceof FormData) {
      options.data.forEach((value, key) => {
        form.append(key, value);
      });
    } else {
      for (const key of Object.keys(options.data)) {
        form.append(key, options.data[key]);
      }
    }
    output.body = form;
    const headers2 = new Headers(output.headers);
    headers2.delete("content-type");
    output.headers = headers2;
  } else if (type.includes("application/json") || typeof options.data === "object") {
    output.body = JSON.stringify(options.data);
  }
  return output;
}, CapacitorHttpPluginWeb, CapacitorHttp;
var init_dist = __esm(() => {
  /*! Capacitor: https://capacitorjs.com/ - MIT License */
  (function(ExceptionCode2) {
    ExceptionCode2["Unimplemented"] = "UNIMPLEMENTED";
    ExceptionCode2["Unavailable"] = "UNAVAILABLE";
  })(ExceptionCode || (ExceptionCode = {}));
  CapacitorException = class CapacitorException extends Error {
    constructor(message, code, data) {
      super(message);
      this.message = message;
      this.code = code;
      this.data = data;
    }
  };
  Capacitor = /* @__PURE__ */ initCapacitorGlobal(typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : {});
  registerPlugin = Capacitor.registerPlugin;
  CapacitorCookiesPluginWeb = class CapacitorCookiesPluginWeb extends WebPlugin {
    async getCookies() {
      const cookies = document.cookie;
      const cookieMap = {};
      cookies.split(";").forEach((cookie) => {
        if (cookie.length <= 0)
          return;
        let [key, value] = cookie.replace(/=/, "CAP_COOKIE").split("CAP_COOKIE");
        key = decode(key).trim();
        value = decode(value).trim();
        cookieMap[key] = value;
      });
      return cookieMap;
    }
    async setCookie(options) {
      try {
        const encodedKey = encode(options.key);
        const encodedValue = encode(options.value);
        const expires = `; expires=${(options.expires || "").replace("expires=", "")}`;
        const path = (options.path || "/").replace("path=", "");
        const domain = options.url != null && options.url.length > 0 ? `domain=${options.url}` : "";
        document.cookie = `${encodedKey}=${encodedValue || ""}${expires}; path=${path}; ${domain};`;
      } catch (error) {
        return Promise.reject(error);
      }
    }
    async deleteCookie(options) {
      try {
        document.cookie = `${options.key}=; Max-Age=0`;
      } catch (error) {
        return Promise.reject(error);
      }
    }
    async clearCookies() {
      try {
        const cookies = document.cookie.split(";") || [];
        for (const cookie of cookies) {
          document.cookie = cookie.replace(/^ +/, "").replace(/=.*/, `=;expires=${new Date().toUTCString()};path=/`);
        }
      } catch (error) {
        return Promise.reject(error);
      }
    }
    async clearAllCookies() {
      try {
        await this.clearCookies();
      } catch (error) {
        return Promise.reject(error);
      }
    }
  };
  CapacitorCookies = registerPlugin("CapacitorCookies", {
    web: () => new CapacitorCookiesPluginWeb
  });
  CapacitorHttpPluginWeb = class CapacitorHttpPluginWeb extends WebPlugin {
    async request(options) {
      const requestInit = buildRequestInit(options, options.webFetchExtra);
      const urlParams = buildUrlParams(options.params, options.shouldEncodeUrlParams);
      const url = urlParams ? `${options.url}?${urlParams}` : options.url;
      const response = await fetch(url, requestInit);
      const contentType = response.headers.get("content-type") || "";
      let { responseType = "text" } = response.ok ? options : {};
      if (contentType.includes("application/json")) {
        responseType = "json";
      }
      let data;
      let blob;
      switch (responseType) {
        case "arraybuffer":
        case "blob":
          blob = await response.blob();
          data = await readBlobAsBase64(blob);
          break;
        case "json":
          data = await response.json();
          break;
        case "document":
        case "text":
        default:
          data = await response.text();
      }
      const headers = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });
      return {
        data,
        headers,
        status: response.status,
        url: response.url
      };
    }
    async get(options) {
      return this.request(Object.assign(Object.assign({}, options), { method: "GET" }));
    }
    async post(options) {
      return this.request(Object.assign(Object.assign({}, options), { method: "POST" }));
    }
    async put(options) {
      return this.request(Object.assign(Object.assign({}, options), { method: "PUT" }));
    }
    async patch(options) {
      return this.request(Object.assign(Object.assign({}, options), { method: "PATCH" }));
    }
    async delete(options) {
      return this.request(Object.assign(Object.assign({}, options), { method: "DELETE" }));
    }
  };
  CapacitorHttp = registerPlugin("CapacitorHttp", {
    web: () => new CapacitorHttpPluginWeb
  });
});

// node_modules/@capacitor/filesystem/dist/esm/definitions.js
var Directory, Encoding;
var init_definitions = __esm(() => {
  (function(Directory2) {
    Directory2["Documents"] = "DOCUMENTS";
    Directory2["Data"] = "DATA";
    Directory2["Library"] = "LIBRARY";
    Directory2["Cache"] = "CACHE";
    Directory2["External"] = "EXTERNAL";
    Directory2["ExternalStorage"] = "EXTERNAL_STORAGE";
    Directory2["ExternalCache"] = "EXTERNAL_CACHE";
    Directory2["LibraryNoCloud"] = "LIBRARY_NO_CLOUD";
    Directory2["Temporary"] = "TEMPORARY";
  })(Directory || (Directory = {}));
  (function(Encoding2) {
    Encoding2["UTF8"] = "utf8";
    Encoding2["ASCII"] = "ascii";
    Encoding2["UTF16"] = "utf16";
  })(Encoding || (Encoding = {}));
});

// node_modules/@capacitor/filesystem/dist/esm/web.js
var exports_web = {};
__export(exports_web, {
  FilesystemWeb: () => FilesystemWeb
});
function resolve(path) {
  const posix = path.split("/").filter((item) => item !== ".");
  const newPosix = [];
  posix.forEach((item) => {
    if (item === ".." && newPosix.length > 0 && newPosix[newPosix.length - 1] !== "..") {
      newPosix.pop();
    } else {
      newPosix.push(item);
    }
  });
  return newPosix.join("/");
}
function isPathParent(parent, children) {
  parent = resolve(parent);
  children = resolve(children);
  const pathsA = parent.split("/");
  const pathsB = children.split("/");
  return parent !== children && pathsA.every((value, index) => value === pathsB[index]);
}
var FilesystemWeb;
var init_web = __esm(() => {
  init_dist();
  init_definitions();
  FilesystemWeb = class FilesystemWeb extends WebPlugin {
    constructor() {
      super(...arguments);
      this.DB_VERSION = 1;
      this.DB_NAME = "Disc";
      this._writeCmds = ["add", "put", "delete"];
      this.downloadFile = async (options) => {
        var _a, _b;
        const requestInit = buildRequestInit(options, options.webFetchExtra);
        const response = await fetch(options.url, requestInit);
        let blob;
        if (!options.progress)
          blob = await response.blob();
        else if (!(response === null || response === undefined ? undefined : response.body))
          blob = new Blob;
        else {
          const reader = response.body.getReader();
          let bytes = 0;
          const chunks = [];
          const contentType = response.headers.get("content-type");
          const contentLength = parseInt(response.headers.get("content-length") || "0", 10);
          while (true) {
            const { done, value } = await reader.read();
            if (done)
              break;
            chunks.push(value);
            bytes += (value === null || value === undefined ? undefined : value.length) || 0;
            const status = {
              url: options.url,
              bytes,
              contentLength
            };
            this.notifyListeners("progress", status);
          }
          const allChunks = new Uint8Array(bytes);
          let position = 0;
          for (const chunk of chunks) {
            if (typeof chunk === "undefined")
              continue;
            allChunks.set(chunk, position);
            position += chunk.length;
          }
          blob = new Blob([allChunks.buffer], { type: contentType || undefined });
        }
        const result = await this.writeFile({
          path: options.path,
          directory: (_a = options.directory) !== null && _a !== undefined ? _a : undefined,
          recursive: (_b = options.recursive) !== null && _b !== undefined ? _b : false,
          data: blob
        });
        return { path: result.uri, blob };
      };
    }
    readFileInChunks(_options, _callback) {
      throw this.unavailable("Method not implemented.");
    }
    async initDb() {
      if (this._db !== undefined) {
        return this._db;
      }
      if (!("indexedDB" in window)) {
        throw this.unavailable("This browser doesn't support IndexedDB");
      }
      return new Promise((resolve2, reject) => {
        const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);
        request.onupgradeneeded = FilesystemWeb.doUpgrade;
        request.onsuccess = () => {
          this._db = request.result;
          resolve2(request.result);
        };
        request.onerror = () => reject(request.error);
        request.onblocked = () => {
          console.warn("db blocked");
        };
      });
    }
    static doUpgrade(event) {
      const eventTarget = event.target;
      const db = eventTarget.result;
      switch (event.oldVersion) {
        case 0:
        case 1:
        default: {
          if (db.objectStoreNames.contains("FileStorage")) {
            db.deleteObjectStore("FileStorage");
          }
          const store = db.createObjectStore("FileStorage", { keyPath: "path" });
          store.createIndex("by_folder", "folder");
        }
      }
    }
    async dbRequest(cmd, args) {
      const readFlag = this._writeCmds.indexOf(cmd) !== -1 ? "readwrite" : "readonly";
      return this.initDb().then((conn) => {
        return new Promise((resolve2, reject) => {
          const tx = conn.transaction(["FileStorage"], readFlag);
          const store = tx.objectStore("FileStorage");
          const req = store[cmd](...args);
          req.onsuccess = () => resolve2(req.result);
          req.onerror = () => reject(req.error);
        });
      });
    }
    async dbIndexRequest(indexName, cmd, args) {
      const readFlag = this._writeCmds.indexOf(cmd) !== -1 ? "readwrite" : "readonly";
      return this.initDb().then((conn) => {
        return new Promise((resolve2, reject) => {
          const tx = conn.transaction(["FileStorage"], readFlag);
          const store = tx.objectStore("FileStorage");
          const index = store.index(indexName);
          const req = index[cmd](...args);
          req.onsuccess = () => resolve2(req.result);
          req.onerror = () => reject(req.error);
        });
      });
    }
    getPath(directory, uriPath) {
      const cleanedUriPath = uriPath !== undefined ? uriPath.replace(/^[/]+|[/]+$/g, "") : "";
      let fsPath = "";
      if (directory !== undefined)
        fsPath += "/" + directory;
      if (uriPath !== "")
        fsPath += "/" + cleanedUriPath;
      return fsPath;
    }
    async clear() {
      const conn = await this.initDb();
      const tx = conn.transaction(["FileStorage"], "readwrite");
      const store = tx.objectStore("FileStorage");
      store.clear();
    }
    async readFile(options) {
      const path = this.getPath(options.directory, options.path);
      const entry = await this.dbRequest("get", [path]);
      if (entry === undefined)
        throw Error("File does not exist.");
      return { data: entry.content ? entry.content : "" };
    }
    async writeFile(options) {
      const path = this.getPath(options.directory, options.path);
      let data = options.data;
      const encoding = options.encoding;
      const doRecursive = options.recursive;
      const occupiedEntry = await this.dbRequest("get", [path]);
      if (occupiedEntry && occupiedEntry.type === "directory")
        throw Error("The supplied path is a directory.");
      const parentPath = path.substr(0, path.lastIndexOf("/"));
      const parentEntry = await this.dbRequest("get", [parentPath]);
      if (parentEntry === undefined) {
        const subDirIndex = parentPath.indexOf("/", 1);
        if (subDirIndex !== -1) {
          const parentArgPath = parentPath.substr(subDirIndex);
          await this.mkdir({
            path: parentArgPath,
            directory: options.directory,
            recursive: doRecursive
          });
        }
      }
      if (!encoding && !(data instanceof Blob)) {
        data = data.indexOf(",") >= 0 ? data.split(",")[1] : data;
        if (!this.isBase64String(data))
          throw Error("The supplied data is not valid base64 content.");
      }
      const now = Date.now();
      const pathObj = {
        path,
        folder: parentPath,
        type: "file",
        size: data instanceof Blob ? data.size : data.length,
        ctime: now,
        mtime: now,
        content: data
      };
      await this.dbRequest("put", [pathObj]);
      return {
        uri: pathObj.path
      };
    }
    async appendFile(options) {
      const path = this.getPath(options.directory, options.path);
      let data = options.data;
      const encoding = options.encoding;
      const parentPath = path.substr(0, path.lastIndexOf("/"));
      const now = Date.now();
      let ctime = now;
      const occupiedEntry = await this.dbRequest("get", [path]);
      if (occupiedEntry && occupiedEntry.type === "directory")
        throw Error("The supplied path is a directory.");
      const parentEntry = await this.dbRequest("get", [parentPath]);
      if (parentEntry === undefined) {
        const subDirIndex = parentPath.indexOf("/", 1);
        if (subDirIndex !== -1) {
          const parentArgPath = parentPath.substr(subDirIndex);
          await this.mkdir({
            path: parentArgPath,
            directory: options.directory,
            recursive: true
          });
        }
      }
      if (!encoding && !this.isBase64String(data))
        throw Error("The supplied data is not valid base64 content.");
      if (occupiedEntry !== undefined) {
        if (occupiedEntry.content instanceof Blob) {
          throw Error("The occupied entry contains a Blob object which cannot be appended to.");
        }
        if (occupiedEntry.content !== undefined && !encoding) {
          data = btoa(atob(occupiedEntry.content) + atob(data));
        } else {
          data = occupiedEntry.content + data;
        }
        ctime = occupiedEntry.ctime;
      }
      const pathObj = {
        path,
        folder: parentPath,
        type: "file",
        size: data.length,
        ctime,
        mtime: now,
        content: data
      };
      await this.dbRequest("put", [pathObj]);
    }
    async deleteFile(options) {
      const path = this.getPath(options.directory, options.path);
      const entry = await this.dbRequest("get", [path]);
      if (entry === undefined)
        throw Error("File does not exist.");
      const entries = await this.dbIndexRequest("by_folder", "getAllKeys", [IDBKeyRange.only(path)]);
      if (entries.length !== 0)
        throw Error("Folder is not empty.");
      await this.dbRequest("delete", [path]);
    }
    async mkdir(options) {
      const path = this.getPath(options.directory, options.path);
      const doRecursive = options.recursive;
      const parentPath = path.substr(0, path.lastIndexOf("/"));
      const depth = (path.match(/\//g) || []).length;
      const parentEntry = await this.dbRequest("get", [parentPath]);
      const occupiedEntry = await this.dbRequest("get", [path]);
      if (depth === 1)
        throw Error("Cannot create Root directory");
      if (occupiedEntry !== undefined)
        throw Error("Current directory does already exist.");
      if (!doRecursive && depth !== 2 && parentEntry === undefined)
        throw Error("Parent directory must exist");
      if (doRecursive && depth !== 2 && parentEntry === undefined) {
        const parentArgPath = parentPath.substr(parentPath.indexOf("/", 1));
        await this.mkdir({
          path: parentArgPath,
          directory: options.directory,
          recursive: doRecursive
        });
      }
      const now = Date.now();
      const pathObj = {
        path,
        folder: parentPath,
        type: "directory",
        size: 0,
        ctime: now,
        mtime: now
      };
      await this.dbRequest("put", [pathObj]);
    }
    async rmdir(options) {
      const { path, directory, recursive } = options;
      const fullPath = this.getPath(directory, path);
      const entry = await this.dbRequest("get", [fullPath]);
      if (entry === undefined)
        throw Error("Folder does not exist.");
      if (entry.type !== "directory")
        throw Error("Requested path is not a directory");
      const readDirResult = await this.readdir({ path, directory });
      if (readDirResult.files.length !== 0 && !recursive)
        throw Error("Folder is not empty");
      for (const entry2 of readDirResult.files) {
        const entryPath = `${path}/${entry2.name}`;
        const entryObj = await this.stat({ path: entryPath, directory });
        if (entryObj.type === "file") {
          await this.deleteFile({ path: entryPath, directory });
        } else {
          await this.rmdir({ path: entryPath, directory, recursive });
        }
      }
      await this.dbRequest("delete", [fullPath]);
    }
    async readdir(options) {
      const path = this.getPath(options.directory, options.path);
      const entry = await this.dbRequest("get", [path]);
      if (options.path !== "" && entry === undefined)
        throw Error("Folder does not exist.");
      const entries = await this.dbIndexRequest("by_folder", "getAllKeys", [IDBKeyRange.only(path)]);
      const files = await Promise.all(entries.map(async (e) => {
        let subEntry = await this.dbRequest("get", [e]);
        if (subEntry === undefined) {
          subEntry = await this.dbRequest("get", [e + "/"]);
        }
        return {
          name: e.substring(path.length + 1),
          type: subEntry.type,
          size: subEntry.size,
          ctime: subEntry.ctime,
          mtime: subEntry.mtime,
          uri: subEntry.path
        };
      }));
      return { files };
    }
    async getUri(options) {
      const path = this.getPath(options.directory, options.path);
      let entry = await this.dbRequest("get", [path]);
      if (entry === undefined) {
        entry = await this.dbRequest("get", [path + "/"]);
      }
      return {
        uri: (entry === null || entry === undefined ? undefined : entry.path) || path
      };
    }
    async stat(options) {
      const path = this.getPath(options.directory, options.path);
      let entry = await this.dbRequest("get", [path]);
      if (entry === undefined) {
        entry = await this.dbRequest("get", [path + "/"]);
      }
      if (entry === undefined)
        throw Error("Entry does not exist.");
      return {
        name: entry.path.substring(path.length + 1),
        type: entry.type,
        size: entry.size,
        ctime: entry.ctime,
        mtime: entry.mtime,
        uri: entry.path
      };
    }
    async rename(options) {
      await this._copy(options, true);
      return;
    }
    async copy(options) {
      return this._copy(options, false);
    }
    async requestPermissions() {
      return { publicStorage: "granted" };
    }
    async checkPermissions() {
      return { publicStorage: "granted" };
    }
    async _copy(options, doRename = false) {
      let { toDirectory } = options;
      const { to, from, directory: fromDirectory } = options;
      if (!to || !from) {
        throw Error("Both to and from must be provided");
      }
      if (!toDirectory) {
        toDirectory = fromDirectory;
      }
      const fromPath = this.getPath(fromDirectory, from);
      const toPath = this.getPath(toDirectory, to);
      if (fromPath === toPath) {
        return {
          uri: toPath
        };
      }
      if (isPathParent(fromPath, toPath)) {
        throw Error("To path cannot contain the from path");
      }
      let toObj;
      try {
        toObj = await this.stat({
          path: to,
          directory: toDirectory
        });
      } catch (e) {
        const toPathComponents = to.split("/");
        toPathComponents.pop();
        const toPath2 = toPathComponents.join("/");
        if (toPathComponents.length > 0) {
          const toParentDirectory = await this.stat({
            path: toPath2,
            directory: toDirectory
          });
          if (toParentDirectory.type !== "directory") {
            throw new Error("Parent directory of the to path is a file");
          }
        }
      }
      if (toObj && toObj.type === "directory") {
        throw new Error("Cannot overwrite a directory with a file");
      }
      const fromObj = await this.stat({
        path: from,
        directory: fromDirectory
      });
      const updateTime = async (path, ctime2, mtime) => {
        const fullPath = this.getPath(toDirectory, path);
        const entry = await this.dbRequest("get", [fullPath]);
        entry.ctime = ctime2;
        entry.mtime = mtime;
        await this.dbRequest("put", [entry]);
      };
      const ctime = fromObj.ctime ? fromObj.ctime : Date.now();
      switch (fromObj.type) {
        case "file": {
          const file = await this.readFile({
            path: from,
            directory: fromDirectory
          });
          if (doRename) {
            await this.deleteFile({
              path: from,
              directory: fromDirectory
            });
          }
          let encoding;
          if (!(file.data instanceof Blob) && !this.isBase64String(file.data)) {
            encoding = Encoding.UTF8;
          }
          const writeResult = await this.writeFile({
            path: to,
            directory: toDirectory,
            data: file.data,
            encoding
          });
          if (doRename) {
            await updateTime(to, ctime, fromObj.mtime);
          }
          return writeResult;
        }
        case "directory": {
          if (toObj) {
            throw Error("Cannot move a directory over an existing object");
          }
          try {
            await this.mkdir({
              path: to,
              directory: toDirectory,
              recursive: false
            });
            if (doRename) {
              await updateTime(to, ctime, fromObj.mtime);
            }
          } catch (e) {}
          const contents = (await this.readdir({
            path: from,
            directory: fromDirectory
          })).files;
          for (const filename of contents) {
            await this._copy({
              from: `${from}/${filename.name}`,
              to: `${to}/${filename.name}`,
              directory: fromDirectory,
              toDirectory
            }, doRename);
          }
          if (doRename) {
            await this.rmdir({
              path: from,
              directory: fromDirectory
            });
          }
        }
      }
      return {
        uri: toPath
      };
    }
    isBase64String(str) {
      try {
        return btoa(atob(str)) == str;
      } catch (err) {
        return false;
      }
    }
  };
  FilesystemWeb._debug = true;
});

// node_modules/@capacitor/filesystem/dist/esm/index.js
init_dist();

// node_modules/@capacitor/synapse/dist/synapse.mjs
function s(t) {
  t.CapacitorUtils.Synapse = new Proxy({}, {
    get(e, n) {
      return new Proxy({}, {
        get(w, o) {
          return (c, p, r) => {
            const i = t.Capacitor.Plugins[n];
            if (i === undefined) {
              r(new Error(`Capacitor plugin ${n} not found`));
              return;
            }
            if (typeof i[o] != "function") {
              r(new Error(`Method ${o} not found in Capacitor plugin ${n}`));
              return;
            }
            (async () => {
              try {
                const a = await i[o](c);
                p(a);
              } catch (a) {
                r(a);
              }
            })();
          };
        }
      });
    }
  });
}
function u(t) {
  t.CapacitorUtils.Synapse = new Proxy({}, {
    get(e, n) {
      return t.cordova.plugins[n];
    }
  });
}
function f(t = false) {
  typeof window > "u" || (window.CapacitorUtils = window.CapacitorUtils || {}, window.Capacitor !== undefined && !t ? s(window) : window.cordova !== undefined && u(window));
}

// node_modules/@capacitor/filesystem/dist/esm/index.js
init_definitions();
var Filesystem = registerPlugin("Filesystem", {
  web: () => Promise.resolve().then(() => (init_web(), exports_web)).then((m) => new m.FilesystemWeb)
});
f();

// src/client/downloads-core.ts
init_dist();
(function() {
  if (window.__zentrioDownloadsCoreInitialized)
    return;
  window.__zentrioDownloadsCoreInitialized = true;
  let rootHandle = null;
  let worker = null;
  const isNative = Capacitor.isNativePlatform();
  const IDB_NAME = "zentrio_downloads_db";
  const IDB_STORE_HANDLES = "handles";
  const IDB_STORE_ITEMS = "items";
  function openDb() {
    return new Promise((resolve2, reject) => {
      const req = indexedDB.open(IDB_NAME, 2);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(IDB_STORE_ITEMS)) {
          db.createObjectStore(IDB_STORE_ITEMS, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(IDB_STORE_HANDLES)) {
          db.createObjectStore(IDB_STORE_HANDLES);
        }
      };
      req.onsuccess = () => resolve2(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  async function saveRootHandle(handle) {
    try {
      console.log("[ZDM-Core] Saving root handle to DB...");
      const db = await openDb();
      return new Promise((resolve2, reject) => {
        const tx = db.transaction(IDB_STORE_HANDLES, "readwrite");
        tx.objectStore(IDB_STORE_HANDLES).put(handle, "root");
        tx.oncomplete = () => {
          console.log("[ZDM-Core] Root handle saved successfully");
          resolve2();
        };
        tx.onerror = () => {
          console.error("[ZDM-Core] Root handle save failed", tx.error);
          reject(tx.error);
        };
      });
    } catch (e) {
      console.error("[ZDM-Core] DB Handle Save Error", e);
    }
  }
  async function loadRootHandle() {
    try {
      const db = await openDb();
      return new Promise((resolve2, reject) => {
        const tx = db.transaction(IDB_STORE_HANDLES, "readonly");
        const req = tx.objectStore(IDB_STORE_HANDLES).get("root");
        req.onsuccess = () => resolve2(req.result);
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.error("[ZDM-Core] DB Handle Load Error", e);
      return null;
    }
  }
  async function saveItem(item) {
    try {
      const db = await openDb();
      return new Promise((resolve2, reject) => {
        const tx = db.transaction(IDB_STORE_ITEMS, "readwrite");
        tx.objectStore(IDB_STORE_ITEMS).put(item);
        tx.oncomplete = () => resolve2();
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      console.error("[ZDM-Core] DB Save Item Error", e);
    }
  }
  async function getItem(id) {
    try {
      const db = await openDb();
      return new Promise((resolve2, reject) => {
        const tx = db.transaction(IDB_STORE_ITEMS, "readonly");
        const req = tx.objectStore(IDB_STORE_ITEMS).get(id);
        req.onsuccess = () => resolve2(req.result);
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      return null;
    }
  }
  async function getAllItems() {
    try {
      const db = await openDb();
      return new Promise((resolve2, reject) => {
        const tx = db.transaction(IDB_STORE_ITEMS, "readonly");
        const req = tx.objectStore(IDB_STORE_ITEMS).getAll();
        req.onsuccess = () => resolve2(req.result || []);
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      return [];
    }
  }
  function broadcast(msg) {
    window.postMessage(msg, "*");
    const frames = document.querySelectorAll("iframe");
    frames.forEach((f2) => {
      try {
        f2.contentWindow?.postMessage(msg, "*");
      } catch (_) {}
    });
  }
  async function startNativeDownload(item, url) {
    console.log("[ZDM-Core] Starting Native Download", item.id);
    try {
      const fileName = item.fileName || item.title.replace(/[^a-z0-9]/gi, "_") + ".mp4";
      const path = `Zentrio/${fileName}`;
      const result = await Filesystem.downloadFile({
        path,
        directory: Directory.Documents,
        url,
        recursive: true,
        progress: true
      });
      item.status = "completed";
      item.progress = 100;
      item.path = result.path;
      await saveItem(item);
      broadcast({
        type: "zentrio-download-complete",
        id: item.id,
        size: 0,
        fileName
      });
    } catch (e) {
      console.error("[ZDM-Core] Native download failed", e);
      item.status = "failed";
      item.error = e.message;
      await saveItem(item);
      broadcast({
        type: "zentrio-download-failed",
        id: item.id,
        error: e.message
      });
    }
  }
  function initWorker() {
    if (worker)
      return;
    try {
      worker = new Worker("/static/js/download-worker.js");
      worker.onmessage = handleWorkerMessage;
      worker.onerror = (e) => {
        console.error("[ZDM-Core] Worker error:", e.message, e.filename, e.lineno);
      };
      console.log("[ZDM-Core] Worker initialized");
    } catch (e) {
      console.error("[ZDM-Core] Failed to initialize worker", e);
    }
  }
  async function handleWorkerMessage(e) {
    const msg = e.data;
    if (!msg || !msg.type)
      return;
    if (msg.id) {
      const item = await getItem(msg.id);
      if (item) {
        let changed = false;
        if (msg.type === "progress") {
          item.status = "downloading";
          item.progress = msg.progress;
          item.bytesReceived = msg.bytesReceived;
          item.size = msg.size;
          item.eta = msg.eta;
          changed = true;
        } else if (msg.type === "complete") {
          item.status = "completed";
          item.progress = 100;
          item.size = msg.size;
          item.fileName = msg.fileName;
          item.completedAt = Date.now();
          changed = true;
        } else if (msg.type === "error") {
          item.status = "failed";
          item.error = msg.error;
          changed = true;
        } else if (msg.type === "cancelled") {
          item.status = "failed";
          item.error = "Cancelled by user";
          changed = true;
        } else if (msg.type === "started") {
          item.status = "downloading";
          item.fileName = msg.fileName;
          item.size = msg.size;
          changed = true;
        }
        if (changed) {
          await saveItem(item);
        }
      }
    }
    const typeMap = {
      progress: "zentrio-download-progress",
      complete: "zentrio-download-complete",
      error: "zentrio-download-failed",
      cancelled: "zentrio-download-cancelled",
      started: "zentrio-download-started"
    };
    if (typeMap[msg.type]) {
      broadcast({
        type: typeMap[msg.type],
        ...msg
      });
    }
  }
  async function handleDownloadRequest(data) {
    console.log("[ZDM-Core] Handling download request", data);
    if (!isNative) {
      if (!rootHandle) {
        broadcast({ type: "zentrio-download-error", id: data.id, error: "No download folder selected" });
        return;
      }
      try {
        const mode = "readwrite";
        if (await rootHandle.queryPermission({ mode }) !== "granted") {
          if (await rootHandle.requestPermission({ mode }) !== "granted") {
            throw new Error("Permission denied");
          }
        }
      } catch (e) {
        console.warn("[ZDM-Core] Permission check failed", e);
        broadcast({ type: "zentrio-download-error", id: data.id, error: "Permission required" });
        return;
      }
    }
    const item = {
      id: data.id,
      href: data.href,
      title: data.title,
      episodeInfo: data.episodeInfo,
      fileName: data.fileName,
      poster: data.poster,
      duration: data.duration,
      url: data.url,
      createdAt: Date.now(),
      status: "initiated",
      progress: 0
    };
    await saveItem(item);
    broadcast({ type: "zentrio-download-init", id: item.id, payload: item });
    if (isNative) {
      startNativeDownload(item, data.url);
    } else {
      if (!worker)
        initWorker();
      try {
        worker?.postMessage({
          type: "start",
          payload: {
            item,
            url: data.url,
            rootHandle,
            resume: false
          }
        });
      } catch (e) {
        console.error("[ZDM-Core] Failed to post message to worker", e);
        broadcast({ type: "zentrio-download-error", id: data.id, error: "Worker communication failed" });
      }
    }
  }
  function setupDomBridge() {
    const bridgeId = "zentrio-comm-bridge";
    function attachObserver(el) {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === "attributes" && mutation.attributeName === "data-message") {
            const raw = el.getAttribute("data-message");
            if (raw) {
              try {
                const data = JSON.parse(raw);
                handleMessage(data, null);
              } catch (e) {
                console.error("[ZDM-Core] Bridge parse error", e);
              }
            }
          }
        });
      });
      observer.observe(el, { attributes: true });
      return observer;
    }
    function ensureBridge() {
      let bridge2 = document.getElementById(bridgeId);
      if (!bridge2) {
        bridge2 = document.createElement("div");
        bridge2.id = bridgeId;
        bridge2.style.display = "none";
        document.documentElement.appendChild(bridge2);
        attachObserver(bridge2);
      }
      return bridge2;
    }
    const bridge = ensureBridge();
    if (bridge && !bridge._zdmObserved) {
      attachObserver(bridge);
      bridge._zdmObserved = true;
    }
    const parentObserver = new MutationObserver((mutations) => {
      if (!document.getElementById(bridgeId)) {
        ensureBridge();
      }
    });
    parentObserver.observe(document.documentElement, { childList: true });
  }
  const processedMessageIds = new Set;
  async function handleMessage(data, source) {
    try {
      if (!data || typeof data !== "object")
        return;
      if (data.id && (data.type === "zentrio-download-request" || data.type === "zentrio-download-cancel")) {
        const key = `${data.type}:${data.id}`;
        if (processedMessageIds.has(key)) {
          return;
        }
        processedMessageIds.add(key);
        setTimeout(() => processedMessageIds.delete(key), 5000);
      }
      switch (data.type) {
        case "zentrio-download-list-request":
          const allItems = await getAllItems();
          const listMsg = { type: "zentrio-download-list", items: allItems };
          if (source)
            source.postMessage(listMsg, "*");
          else
            broadcast(listMsg);
          break;
        case "zentrio-download-request":
          handleDownloadRequest(data);
          break;
        case "zentrio-download-cancel":
          if (isNative) {} else {
            if (worker)
              worker.postMessage({ type: "cancel", id: data.id });
          }
          break;
        case "zentrio-download-delete":
          const delItem = await getItem(data.id);
          if (delItem) {
            try {
              const db = await openDb();
              const tx = db.transaction(IDB_STORE_ITEMS, "readwrite");
              tx.objectStore(IDB_STORE_ITEMS).delete(data.id);
              broadcast({ type: "zentrio-download-deleted", id: data.id });
            } catch (e) {
              console.error("Delete failed", e);
            }
          }
          break;
        case "zentrio-download-retry":
          const item = await getItem(data.id);
          if (item && item.url) {
            handleDownloadRequest({
              id: item.id,
              href: item.href,
              title: item.title,
              episodeInfo: item.episodeInfo,
              url: item.url
            });
          }
          break;
        case "zentrio-download-root-set":
          if (data.handle) {
            rootHandle = data.handle;
            await saveRootHandle(rootHandle);
            broadcast({ type: "zentrio-download-root-handle", handle: rootHandle });
          }
          break;
        case "zentrio-download-root-request":
          if (isNative) {
            broadcast({ type: "zentrio-download-root-handle", handle: { name: "Device Storage" } });
          } else if (rootHandle) {
            if (source) {
              source.postMessage({ type: "zentrio-download-root-handle", handle: rootHandle }, "*");
            } else {
              broadcast({ type: "zentrio-download-root-handle", handle: rootHandle });
            }
          }
          break;
      }
    } catch (err) {
      console.error("[ZDM-Core] Message listener error:", err);
    }
  }
  window.addEventListener("message", (e) => handleMessage(e.data, e.source), true);
  window.addEventListener("zentrio-message", (e) => handleMessage(e.detail, null));
  async function init() {
    console.log("[ZDM-Core] Initializing v3 (Hybrid)...", window.location.href);
    if (!isNative) {
      rootHandle = await loadRootHandle();
      if (rootHandle) {
        console.log("[ZDM-Core] Loaded root handle:", rootHandle.name);
      }
      initWorker();
    } else {
      console.log("[ZDM-Core] Running in Native mode");
    }
    window.__zentrioDownloads = {
      setRoot: async (h) => {
        rootHandle = h;
        await saveRootHandle(h);
      },
      worker
    };
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      init();
      setupDomBridge();
    });
  } else {
    init();
    setupDomBridge();
  }
})();
