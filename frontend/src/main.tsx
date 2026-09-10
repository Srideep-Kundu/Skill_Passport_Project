import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { GoogleOAuthProvider } from "@react-oauth/google";
import "./styles.css";
import { App } from "./App";
import { AuthProvider } from "./auth/AuthContext";
import "./localization/i18n";
import { LocalizationProvider } from "./localization/LocalizationProvider";

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={googleClientId}>
      <AuthProvider>
        <LocalizationProvider>
          <App />
        </LocalizationProvider>
      </AuthProvider>
    </GoogleOAuthProvider>
  </StrictMode>
);
