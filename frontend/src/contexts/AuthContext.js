import { createContext, useContext, useState, useEffect } from "react";
import api, { tokenStore } from "@/utils/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = loading, null = unauthenticated

  useEffect(() => {
    api.get("/auth/me")
      .then((r) => setUser(r.data))
      .catch(() => {
        tokenStore.clear();
        setUser(null);
      });
  }, []);

  const login = (userData) => {
    if (userData.access_token) {
      tokenStore.set(userData.access_token);
    }
    if (userData.refresh_token) {
      tokenStore.setRefresh(userData.refresh_token);
    }
    const { access_token, refresh_token, ...userOnly } = userData;
    setUser(userOnly);
  };

  const logout = async () => {
    try { await api.post("/auth/logout"); } catch {}
    tokenStore.clear();
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
