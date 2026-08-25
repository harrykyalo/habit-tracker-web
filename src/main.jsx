import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { registerSW } from "./registerServiceWorker";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// register service worker (sw.js in public/)
if ('serviceWorker' in navigator) {
  registerSW();
}
