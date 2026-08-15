import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { App } from "./App";
import { AuthProvider } from "./auth/AuthContext";

createRoot(document.getElementById("root")!).render(<StrictMode><AuthProvider><App /></AuthProvider></StrictMode>);
