import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, setCsrfToken } from "./api";

interface AuthState {
  email: string | null;
  loading: boolean;
  needsSetup: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState>(null as unknown as AuthState);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);

  useEffect(() => {
    api
      .get<{ email: string; csrfToken: string }>("/api/v1/auth/me")
      .then((me) => {
        setEmail(me.email);
        setCsrfToken(me.csrfToken);
      })
      .catch(() => {
        setEmail(null);
        // Probe whether initial setup is still required.
        api
          .post("/api/v1/auth/setup", { token: "__probe__" })
          .catch((err: { code?: string }) => {
            if (err.code === "setup_token_invalid" || err.code === "invalid_email") setNeedsSetup(true);
          });
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (mail: string, password: string) => {
    const res = await api.post<{ email: string; csrfToken: string }>("/api/v1/auth/login", {
      email: mail,
      password
    });
    setEmail(res.email);
    setCsrfToken(res.csrfToken);
  }, []);

  const logout = useCallback(async () => {
    await api.post("/api/v1/auth/logout");
    setEmail(null);
    setCsrfToken(null);
  }, []);

  return (
    <AuthContext.Provider value={{ email, loading, needsSetup, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
