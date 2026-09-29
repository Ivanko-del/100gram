import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { ChatLockProvider } from "./context/ChatLockContext";
import { applyPrefs } from "./utils/prefs";
import "./styles/index.css";

document.documentElement.dataset.theme = localStorage.getItem("stogram_theme") ?? "dark";
applyPrefs();

// `immediate: true` checks for a new service worker on load; combined with
// skipWaiting/clientsClaim (vite.config.ts) the new version takes over and
// reloads automatically instead of an already-installed PWA getting stuck
// running old cached code until someone fully force-closes it.
registerSW({ immediate: true });

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ChatLockProvider>
          <App />
        </ChatLockProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
