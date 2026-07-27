// @ts-nocheck
import { precacheAndRoute } from "workbox-precaching";

// eslint-disable-next-line no-restricted-globals
self.__WB_MANIFEST = [];
precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
