import { defaultCache } from "@serwist/next/worker";
import { installSerwist } from "@serwist/sw";

// FIX Safari iOS: "FetchEvent.respondWith TypeError: Load failed"
// Safari cannot handle streaming responses through service worker.
// Wrap ALL runtime cache matchers to exclude /api/media/ paths,
// so these requests bypass the SW entirely and go straight to the network.
const safariFixedCache = defaultCache.map((entry) => {
  const orig = entry.matcher;
  return {
    ...entry,
    matcher: (params) => {
      // Never intercept /api/media/ — streaming proxy breaks Safari SW
      const pathname = params.url?.pathname || "";
      if (pathname.startsWith("/api/media/")) return false;
      // Delegate to original matcher
      if (orig instanceof RegExp) return orig.test(params.url.href);
      if (typeof orig === "function") return orig(params);
      return false;
    },
  };
});

installSerwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: false, // Safari does not support navigation preload
  runtimeCaching: safariFixedCache,
});
