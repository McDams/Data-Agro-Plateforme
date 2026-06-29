import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { Server, Shield, Database, Globe, Moon, Sun } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

export default function SystemSettings() {
  const { theme, toggle } = useTheme();
  const { user } = useAuth();

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-medium text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>
          Paramètres système
        </h1>
        <p className="text-sm text-muted-foreground">Configuration de la plateforme AgriFlow</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Server size={16} className="text-primary" /> État du système
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { label: "API Backend", status: "Opérationnel", color: "border-green-300 text-green-600" },
            { label: "Base de données MongoDB", status: "Connectée", color: "border-green-300 text-green-600" },
            { label: "Moteur d'alertes", status: "Actif", color: "border-green-300 text-green-600" },
            { label: "Module prédictions", status: "Actif", color: "border-green-300 text-green-600" },
          ].map(item => (
            <div key={item.label} className="flex items-center justify-between py-1">
              <p className="text-sm text-foreground">{item.label}</p>
              <Badge variant="outline" className={`text-xs ${item.color}`}>{item.status}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Shield size={16} className="text-primary" /> Compte administrateur
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <span className="text-sm font-semibold text-primary">
                {user?.first_name?.[0]}{user?.last_name?.[0]}
              </span>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">{user?.first_name} {user?.last_name}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
            <Badge className="ml-auto text-xs">Admin</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Globe size={16} className="text-primary" /> Apparence
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              {theme === "dark" ? <Moon size={16} className="text-muted-foreground" /> : <Sun size={16} className="text-muted-foreground" />}
              <div>
                <p className="text-sm font-medium text-foreground">Mode sombre</p>
                <p className="text-xs text-muted-foreground">Thème actuel: {theme === "dark" ? "Sombre" : "Clair"}</p>
              </div>
            </div>
            <Switch checked={theme === "dark"} onCheckedChange={toggle} data-testid="admin-theme-toggle" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Database size={16} className="text-primary" /> À propos de la plateforme
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {[
            { l: "Version", v: "1.0.0" },
            { l: "Framework Backend", v: "FastAPI (Python)" },
            { l: "Framework Frontend", v: "React 19" },
            { l: "Base de données", v: "MongoDB" },
            { l: "Licence", v: "AgriFlow Platform © 2024" },
          ].map(({ l, v }) => (
            <div key={l} className="flex justify-between py-1 border-b border-border/50 last:border-0">
              <span className="text-muted-foreground">{l}</span>
              <span className="font-medium text-foreground">{v}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
