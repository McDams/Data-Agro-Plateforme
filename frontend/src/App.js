import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import AppLayout from "@/components/layout/AppLayout";
import "@/App.css";

// Public pages
import Landing from "@/pages/Landing";
import Login from "@/pages/auth/Login";
import Register from "@/pages/auth/Register";
import ForgotPassword from "@/pages/auth/ForgotPassword";
import ResetPassword from "@/pages/auth/ResetPassword";

// Onboarding
import Onboarding from "@/pages/onboarding/Onboarding";

// Farmer pages
import Dashboard from "@/pages/farmer/Dashboard";
import Farms from "@/pages/farmer/Farms";
import Plots from "@/pages/farmer/Plots";
import Devices from "@/pages/farmer/Devices";
import Analytics from "@/pages/farmer/Analytics";
import Predictions from "@/pages/farmer/Predictions";
import Alerts from "@/pages/farmer/Alerts";
import Reports from "@/pages/farmer/Reports";
import Profile from "@/pages/farmer/Profile";

// Admin pages
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminUsers from "@/pages/admin/AdminUsers";
import AdminFarms from "@/pages/admin/AdminFarms";
import AdminDevices from "@/pages/admin/AdminDevices";
import AdminAlerts from "@/pages/admin/AdminAlerts";
import AuditLogs from "@/pages/admin/AuditLogs";
import SystemSettings from "@/pages/admin/SystemSettings";

import { Toaster } from "@/components/ui/sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";

function AuthGate({ children }) {
  const { loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="space-y-3 w-48 text-center">
        <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center mx-auto">
          <div className="w-5 h-5 rounded-md bg-primary animate-pulse" />
        </div>
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-3/4 mx-auto" />
        <p className="text-xs text-muted-foreground">Chargement...</p>
      </div>
    </div>
  );
  return children;
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<Landing />} />
      <Route path="/connexion" element={<Login />} />
      <Route path="/inscription" element={<Register />} />
      <Route path="/mot-de-passe-oublie" element={<ForgotPassword />} />
      <Route path="/reinitialiser-mot-de-passe" element={<ResetPassword />} />

      {/* Onboarding (authenticated farmer) */}
      <Route path="/onboarding" element={<Onboarding />} />

      {/* Farmer routes */}
      <Route element={<AppLayout requiredRole="farmer" />}>
        <Route path="/tableau-de-bord" element={<Dashboard />} />
        <Route path="/exploitations" element={<Farms />} />
        <Route path="/parcelles" element={<Plots />} />
        <Route path="/appareils" element={<Devices />} />
        <Route path="/analytiques" element={<Analytics />} />
        <Route path="/predictions" element={<Predictions />} />
        <Route path="/alertes" element={<Alerts />} />
        <Route path="/rapports" element={<Reports />} />
        <Route path="/parametres" element={<Profile />} />
      </Route>

      {/* Admin routes */}
      <Route element={<AppLayout requiredRole="admin" />}>
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/utilisateurs" element={<AdminUsers />} />
        <Route path="/admin/exploitations" element={<AdminFarms />} />
        <Route path="/admin/appareils" element={<AdminDevices />} />
        <Route path="/admin/alertes" element={<AdminAlerts />} />
        <Route path="/admin/audit" element={<AuditLogs />} />
        <Route path="/admin/systeme" element={<SystemSettings />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={
        <Navigate to={user ? (user.role === "admin" ? "/admin" : "/tableau-de-bord") : "/"} replace />
      } />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <AuthGate>
            <AppRoutes />
          </AuthGate>
          <Toaster position="top-right" richColors />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
