/* global caches, self */

module.exports = hash => {
  var CURRENT_CACHES = {
    static: `static-cache-v-${hash}`
  };

  // self.addEventListener('install', function (evt) {
  //   if (evt.registerForeignFetch) {
  //     evt.registerForeignFetch({
  //       scopes: [self.registration.scope],
  //       origins: ['*']
  //     });
  //   }
  //   evt.waitUntil(
  //     caches.open(CURRENT_CACHES.static).then(function (cache) {
  //       return cache.addAll([
  //         'https://cdn.aframe.io/controllers/oculus-hands/v2/leftHand.json',
  //         'https://cdn.aframe.io/controllers/oculus-hands/v2/rightHand.json',
  //         'https://cdn.aframe.io/fonts/Exo2Bold.fnt',
  //         'https://cdn.aframe.io/fonts/Exo2Bold.png',
  //         'https://cdn.aframe.io/fonts/Roboto-msdf.json',
  //         'https://cdn.aframe.io/fonts/Roboto-msdf.png',
  //       ]);
  //     })
  //   );
  // });

  self.addEventListener('activate', function (evt) {
    // Delete all caches that aren't named in `CURRENT_CACHES`.
    // While there is only one cache in this example, the same logic will
    // handle the case where there are multiple versioned caches.
    var expectedCacheNames = Object.keys(CURRENT_CACHES).map(function (key) {
      return CURRENT_CACHES[key];
    });

    evt.waitUntil(
      caches.keys().then(function (cacheNames) {
        return Promise.all(
          cacheNames.map(function (cacheName) {
            if (expectedCacheNames.indexOf(cacheName) === -1) {
              // If this cache name isn't present in the array of "expected"
              // cache names, then delete it.
              console.log(`Deleting out-of-date cache "${cacheName}"`);
              return caches.delete(cacheName);
            }
          })
        );
      })
    );
  });

  function handleFetch (evt) {
    console.log(evt.type);
    console.log(`Handling fetch event for "${evt.request.url}"`);

    evt.respondWith(
      caches.open(CURRENT_CACHES.static).then(function (cache) {
        return cache.match(evt.request).then(function (res) {
          if (res) {
            // If there is an entry in the cache for `evt.request`, then `res`
            // will be defined, and we can just return it. Notice that only
            // `CURRENT_CACHES.static` resources are cached.
            console.log(`  Found response for "${evt.request.url}" in cache`);
            return res;
            // return {
            //   res,
            //   origin: evt.origin
            // };
          }

          // Otherwise, if there is no entry in the cache for `evt.request`,
          // `res` will be `undefined`, and we need to `fetch()` the resource.
          console.log(`  No response for "${evt.request.url}" found in cache and will fetch from network`);

          // We call `.clone()` on the request since we might use it in a call to `cache.put()` later on.
          // Both `fetch()` and `cache.put()` "consume" the request, so we need to make a copy
          // (https://fetch.spec.whatwg.org/#dom-request-clone).
          return fetch(evt.type === 'foreignfetch' ? evt.request : evt.request.clone()).then(function (res) {
            console.log(`    Response for "${evt.request.url}" fetched from network`);

            if (res.status < 400 &&
                evt.request.url &&
                evt.request.url.toLowerCase().indexOf('/sw.js') === -1) {
              // This avoids caching responses that we know are errors
              // (i.e., 4xx/5xx HTTP status codes).
              // Notice that for opaque filtered responses
              // (https://fetch.spec.whatwg.org/#concept-filtered-response-opaque),
              // we can't access to the response headers, so this check will
              // always fail and the resource won't be cached.
              //
              // (Reminder: cross-origin requests must serve CORS headers.)
              // We call `.clone()` on the response to save a copy of it to
              // the cache. By doing so, we get to keep the original response
              // object which we will return back to the controlled page.
              // (See https://fetch.spec.whatwg.org/#dom-response-clone for
              // more info.)
              console.log(`    Caching the response for "${evt.request.url}"`);
              cache.put(evt.request, res.clone());
            } else {
              console.log(`    Not caching the response for "${evt.request.url}"`,
                res.status < 400,
                evt.request.url);
            }

            // Return the original response object, which will be used to
            // fulfill the resource request.
            return res;
            // return {
            //   res,
            //   origin: evt.origin
            // };
          });
        }).catch(function (err) {
          // This `catch()` will handle exceptions that arise from the
          // `match()` or `fetch()` operations. Notice that an HTTP error
          // response (e.g., 404) will *not* trigger an exception. It will
          // return a normal response object that has the appropriate error
          // code set.
          console.error('  Error in fetch handler:', err);
          throw err;
        });
      })
    );
  }

  // self.addEventListener('foreignfetch', handleFetch);

  self.addEventListener('fetch', handleFetch);
};
