import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
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
      },
    }),
  ],
  server: {
    port: 5173,
  },
});
