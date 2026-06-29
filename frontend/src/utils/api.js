import axios from "axios";

const BASE = process.env.REACT_APP_BACKEND_URL;

const TOKEN_KEY = "datagro_access_token";
const REFRESH_KEY = "datagro_refresh_token";

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(REFRESH_KEY); },
  setRefresh: (t) => localStorage.setItem(REFRESH_KEY, t),
  getRefresh: () => localStorage.getItem(REFRESH_KEY),
};

const api = axios.create({
  baseURL: `${BASE}/api`,
  withCredentials: true,
});

// Request interceptor: attach Bearer token if available
api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) {
    config.headers = config.headers || {};
    config.headers["Authorization"] = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: handle 401 → refresh → retry
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const url = err.config?.url || "";
    const isAuthUrl = url.includes("/auth/");
    if (err.response?.status === 401 && !err.config._retry && !isAuthUrl) {
      err.config._retry = true;
      try {
        const refreshToken = tokenStore.getRefresh();
        const headers = refreshToken ? { "X-Refresh-Token": refreshToken } : {};
        const { data } = await axios.post(
          `${BASE}/api/auth/refresh`,
          {},
          { withCredentials: true, headers }
        );
        if (data.access_token) {
          tokenStore.set(data.access_token);
        }
        // Retry original request with new token
        err.config.headers = err.config.headers || {};
        err.config.headers["Authorization"] = `Bearer ${tokenStore.get()}`;
        return api.request(err.config);
      } catch {
        tokenStore.clear();
        const publicPaths = ["/", "/connexion", "/inscription", "/mot-de-passe-oublie", "/reinitialiser-mot-de-passe"];
        if (!publicPaths.includes(window.location.pathname)) {
          window.location.href = "/connexion";
        }
      }
    }
    return Promise.reject(err);
  }
);

export function formatError(detail) {
  if (!detail) return "Une erreur est survenue.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((e) => e?.msg || JSON.stringify(e)).join(". ");
  return String(detail);
}

export default api;
