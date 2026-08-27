import { useState, useEffect, useCallback } from "react";
import { getCurrentUser, logoutUser } from "../lib/auth";

/**
 * React hook that exposes the current demo session.
 * Re-reads localStorage once on mount (client-side only).
 */
export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUser(getCurrentUser());
    setLoading(false);
  }, []);

  const logout = useCallback(() => {
    logoutUser();
    setUser(null);
  }, []);

  return { user, loading, logout };
}
