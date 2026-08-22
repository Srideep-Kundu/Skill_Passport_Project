import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { PropsWithChildren } from "react";
import type { AuthSession, Role } from "../api";

export interface StoredSession extends AuthSession {
  email: string;
}

interface AuthContextValue {
  session: StoredSession | null;
  setSession: (session: AuthSession, email: string) => void;
  signOut: () => void;
  hasRole: (...roles: Role[]) => boolean;
  justLoggedIn: boolean;
  completePostLoginTransition: () => void;
}

const storageKey = "skill-passport.session";
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function readSession(): StoredSession | null {
  try {
    const value = sessionStorage.getItem(storageKey);
    if (!value) return null;
    const parsed: unknown = JSON.parse(value);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "access_token" in parsed &&
      typeof parsed.access_token === "string" &&
      "role" in parsed &&
      ["student", "recruiter", "admin", "academician", "institution"].includes(String(parsed.role)) &&
      "email" in parsed &&
      typeof parsed.email === "string"
    ) {
      return parsed as StoredSession;
    }
  } catch {
    sessionStorage.removeItem(storageKey);
  }
  return null;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, updateSession] = useState<StoredSession | null>(readSession);
  const [justLoggedIn, setJustLoggedIn] = useState<boolean>(false);

  const setSession = useCallback((next: AuthSession, email: string) => {
    const stored = { ...next, email };
    sessionStorage.setItem(storageKey, JSON.stringify(stored));
    updateSession(stored);
    setJustLoggedIn(true);
  }, []);

  const completePostLoginTransition = useCallback(() => {
    setJustLoggedIn(false);
  }, []);

  const signOut = useCallback(() => {
    sessionStorage.removeItem(storageKey);
    updateSession(null);
    setJustLoggedIn(false);
  }, []);

  // Automatically reset session and return to clean login screen if token expires/invalidates
  useState(() => {
    if (typeof window === "undefined") return;
    const handleUnauthorized = () => {
      sessionStorage.removeItem(storageKey);
      updateSession(null);
      setJustLoggedIn(false);
    };
    window.addEventListener("skill-passport:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("skill-passport:unauthorized", handleUnauthorized);
  });

  const value = useMemo(
    () => ({
      session,
      setSession,
      signOut,
      hasRole: (...roles: Role[]) => session !== null && roles.includes(session.role),
      justLoggedIn,
      completePostLoginTransition,
    }),
    [session, setSession, signOut, justLoggedIn, completePostLoginTransition],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider");
  return value;
}
