import type { PropsWithChildren } from "react";
import type { Role } from "../api";
import { useAuth } from "../auth/AuthContext";

export function RoleGuard({ roles, children }: PropsWithChildren<{ roles: Role[] }>) {
  const { session } = useAuth();
  if (!session || !roles.includes(session.role)) return <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900">You do not have access to this view.</div>;
  return <>{children}</>;
}
