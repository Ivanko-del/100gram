import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      // We call registerSW() ourselves in main.tsx (with immediate: true),
      // so the plugin shouldn't also inject its own bare registration -
      // that default has no reload-on-update logic and is how an already
      // installed PWA gets stuck running stale code indefinitely.
      injectRegister: false,
      includeAssets: ["icons/favicon-32.png", "icons/apple-touch-icon.png"],
      manifest: {
        id: "/",
        name: "100 ГРАМ",
        short_name: "100 ГРАМ",
        description: "Месенджер з власною валютою ГРАМ — чати в реальному часі, перекази та преміум",
        lang: "uk",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#0e1621",
        theme_color: "#17212b",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // Precache the built app shell only. Firebase Auth/Firestore calls
        // go straight to the network so accounts, chats and the wallet are
        // never served stale - only static assets are cached for offline use.
        globPatterns: ["**/*.{js,css,html,svg,png,ico}"],
        navigateFallback: "/index.html",
        // A new service worker otherwise sits "waiting" until every open
        // tab/instance of the PWA is fully closed - which for a home-screen
        // app that's just backgrounded can be never. These make the new
        // version take over immediately instead.
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  server: {
    port: 5173,
  },
});
