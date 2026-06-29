import axios from "axios";

const BASE = process.env.REACT_APP_BACKEND_URL;

const api = axios.create({
  baseURL: `${BASE}/api`,
  withCredentials: true,
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const url = err.config?.url || "";
    // Ne pas déclencher le refresh pour les endpoints d'authentification
    const isAuthUrl = url.includes("/auth/");
    if (err.response?.status === 401 && !err.config._retry && !isAuthUrl) {
      err.config._retry = true;
      try {
        await axios.post(`${BASE}/api/auth/refresh`, {}, { withCredentials: true });
        return api.request(err.config);
      } catch {
        // Only redirect if on a protected page
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
