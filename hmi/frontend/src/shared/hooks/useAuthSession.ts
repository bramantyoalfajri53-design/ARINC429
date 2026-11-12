import { useCallback, useEffect, useState } from "react";
import { API_ENDPOINTS } from "../constants";
import { api } from "../services";

export function useAuthSession() {
  const [authed, setAuthed] = useState(false);
  const [loginError, setLoginError] = useState("");

  const checkSession = useCallback(async () => {
    try {
      await api(API_ENDPOINTS.auth.session);
      setAuthed(true);
    } catch {
      setAuthed(false);
    }
  }, []);

  useEffect(() => {
    void checkSession();
  }, [checkSession]);

  const login = useCallback(async (pin: string): Promise<boolean> => {
    setLoginError("");
    try {
      await api(API_ENDPOINTS.auth.login, { method: "POST", body: JSON.stringify({ pin }) });
      setAuthed(true);
      return true;
    } catch (err) {
      setLoginError((err as Error).message);
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    void api(API_ENDPOINTS.auth.logout, { method: "POST", body: "{}" });
    setAuthed(false);
  }, []);

  return { authed, loginError, login, logout };
}

