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
}

const storageKey = "skill-passport.session";
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function readSession(): StoredSession | null {
  try {
    const value = sessionStorage.getItem(storageKey);
    if (!value) return null;
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed === "object" && parsed !== null && "access_token" in parsed && typeof parsed.access_token === "string" && "role" in parsed && ["student", "recruiter", "admin"].includes(String(parsed.role)) && "email" in parsed && typeof parsed.email === "string") return parsed as StoredSession;
  } catch {
    sessionStorage.removeItem(storageKey);
  }
  return null;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, updateSession] = useState<StoredSession | null>(readSession);
  const setSession = useCallback((next: AuthSession, email: string) => {
    const stored = { ...next, email };
    sessionStorage.setItem(storageKey, JSON.stringify(stored));
    updateSession(stored);
  }, []);
  const signOut = useCallback(() => {
    sessionStorage.removeItem(storageKey);
    updateSession(null);
  }, []);
  const value = useMemo(() => ({ session, setSession, signOut, hasRole: (...roles: Role[]) => session !== null && roles.includes(session.role) }), [session, setSession, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider");
  return value;
}
