/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-afac4cd2'], (function (workbox) { 'use strict';

  self.skipWaiting();
  workbox.clientsClaim();
  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "registerSW.js",
    "revision": "402b66900e731ca748771b6fc5e7a068"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "b8a1bc018e089accb2a188fb8abbb6c1"
  }, {
    "url": "pwa-512x512.png",
    "revision": "b8a1bc018e089accb2a188fb8abbb6c1"
  }, {
    "url": "pwa-192x192.png",
    "revision": "784dcd987ad42e9b7a7965e7c0953085"
  }, {
    "url": "index.html",
    "revision": "61972c328aac14c70c19e2df6fb43ae7"
  }, {
    "url": "icon.svg",
    "revision": "cc2d9bb362bcc55fecbda21f230ba85f"
  }, {
    "url": "apple-touch-icon.png",
    "revision": "6612ea81c87427fce456f0176dbcfc8f"
  }, {
    "url": "icons/icon-96x96.png",
    "revision": "ae7e1fdcb2dee04fb06540e8a6f24227"
  }, {
    "url": "icons/icon-72x72.png",
    "revision": "cc79910ea209b39e1dff5b7e99fa84ec"
  }, {
    "url": "icons/icon-512x512.png",
    "revision": "b8a1bc018e089accb2a188fb8abbb6c1"
  }, {
    "url": "icons/icon-48x48.png",
    "revision": "ed7ee04ac9a9d37f7b2f4a2fe28847b2"
  }, {
    "url": "icons/icon-192x192.png",
    "revision": "784dcd987ad42e9b7a7965e7c0953085"
  }, {
    "url": "icons/icon-144x144.png",
    "revision": "795af6df18128e049d7006b545171a87"
  }, {
    "url": "assets/ZYgJexA7.js",
    "revision": null
  }, {
    "url": "assets/QY361coL.js",
    "revision": null
  }, {
    "url": "assets/DVIgfeOZ.js",
    "revision": null
  }, {
    "url": "assets/DPWdpxjC.css",
    "revision": null
  }, {
    "url": "assets/CzvDLtZp.js",
    "revision": null
  }, {
    "url": "assets/Cvnlv_Qg.js",
    "revision": null
  }, {
    "url": "assets/BqJCIp4t.js",
    "revision": null
  }, {
    "url": "assets/B3_pqYZC.js",
    "revision": null
  }, {
    "url": "apple-touch-icon.png",
    "revision": "6612ea81c87427fce456f0176dbcfc8f"
  }, {
    "url": "icon.svg",
    "revision": "cc2d9bb362bcc55fecbda21f230ba85f"
  }, {
    "url": "pwa-192x192.png",
    "revision": "784dcd987ad42e9b7a7965e7c0953085"
  }, {
    "url": "pwa-512x512.png",
    "revision": "b8a1bc018e089accb2a188fb8abbb6c1"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "b8a1bc018e089accb2a188fb8abbb6c1"
  }, {
    "url": "manifest.webmanifest",
    "revision": "35d8c494c4e812c101f226d8afe72173"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("index.html"), {
    denylist: [/^\/api\//, /\.apk$/i, /\.exe$/i]
  }));
  workbox.registerRoute(/^https:\/\/fonts\.googleapis\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "google-fonts-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 10,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');
  workbox.registerRoute(/^https:\/\/fonts\.gstatic\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "gstatic-fonts-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 10,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');

}));
