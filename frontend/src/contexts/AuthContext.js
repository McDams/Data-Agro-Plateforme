import { createContext, useContext, useState, useEffect } from "react";
import api from "@/utils/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = loading, null = unauthenticated

  useEffect(() => {
    api.get("/auth/me")
      .then((r) => setUser(r.data))
      .catch(() => setUser(null));
  }, []);

  const login = (userData) => setUser(userData);
  const logout = async () => {
    try { await api.post("/auth/logout"); } catch {}
    setUser(null);
  };
  const updateUser = (data) => setUser((u) => ({ ...u, ...data }));

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser, loading: user === undefined }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
