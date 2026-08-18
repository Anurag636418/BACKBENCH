import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./App.css";
import { initAnalytics } from "./analytics";

initAnalytics();

createRoot(document.getElementById("root")!).render(
  <App />
);
