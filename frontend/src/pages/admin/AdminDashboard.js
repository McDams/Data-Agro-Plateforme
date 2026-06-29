import { useState, useEffect } from "react";
import api from "@/utils/api";
import { Users, Tractor, Cpu, Bell, TrendingUp, Activity, Server } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell
} from "recharts";
import { cn } from "@/lib/utils";

function KpiCard({ title, value, icon: Icon, color = "default", loading }) {
  if (loading) return <Card><CardContent className="p-5"><Skeleton className="h-16" /></CardContent></Card>;
  const colors = {
    default: { bg: "bg-muted", text: "text-muted-foreground" },
    primary: { bg: "bg-primary/10", text: "text-primary" },
    warning: { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-600 dark:text-amber-400" },
    danger: { bg: "bg-destructive/10", text: "text-destructive" },
  };
  const c = colors[color] || colors.default;
  return (
    <Card>
      <CardContent className="p-5 flex items-center gap-4">
        <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", c.bg)}>
          <Icon size={20} className={c.text} />
        </div>
        <div>
          <p className="text-2xl font-semibold text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>{value ?? 0}</p>
          <p className="text-xs text-muted-foreground">{title}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get("/admin/stats").then(r => r.data),
      api.get("/admin/users?limit=5").then(r => r.data),
      api.get("/admin/alerts?limit=10").then(r => r.data),
    ]).then(([s, u, a]) => { setStats(s); setUsers(u); setAlerts(a); })
      .catch(() => {}).finally(() => setLoading(false));
  }, []);

  const deviceData = stats ? [
    { name: "En ligne", value: stats.online_devices, color: "hsl(var(--primary))" },
    { name: "Hors ligne", value: stats.total_devices - stats.online_devices, color: "hsl(var(--muted-foreground))" },
  ] : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-medium text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>
          Administration
        </h1>
        <p className="text-sm text-muted-foreground">Vue globale de la plateforme Dat'Agro</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard title="Agriculteurs" value={stats?.total_users} icon={Users} color="primary" loading={loading} />
        <KpiCard title="Actifs" value={stats?.active_users} icon={Activity} color="primary" loading={loading} />
        <KpiCard title="En attente" value={stats?.pending_users} icon={Users} color="warning" loading={loading} />
        <KpiCard title="Exploitations" value={stats?.total_farms} icon={Tractor} loading={loading} />
        <KpiCard title="Parcelles" value={stats?.total_plots} icon={TrendingUp} loading={loading} />
        <KpiCard title="Appareils total" value={stats?.total_devices} icon={Cpu} loading={loading} />
        <KpiCard title="Appareils en ligne" value={stats?.online_devices} icon={Server} color="primary" loading={loading} />
        <KpiCard title="Alertes critiques" value={stats?.critical_alerts} icon={Bell} color="danger" loading={loading} />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Device chart */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">État des appareils</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-40" /> : (
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={deviceData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} width={80} />
                  <Tooltip formatter={(v, n) => [v, n]} />
                  <Bar dataKey="value" radius={4}>
                    {deviceData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Recent users */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Nouveaux utilisateurs</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-40" /> : (
              <div className="space-y-3">
                {users.slice(0, 5).map(u => (
                  <div key={u.id} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-xs font-medium text-primary">{u.first_name?.[0]}{u.last_name?.[0]}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{u.first_name} {u.last_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                    </div>
                    <Badge variant="outline" className={cn("text-xs shrink-0",
                      u.status === "active" ? "border-green-300 text-green-600" :
                        u.status === "pending" ? "border-amber-300 text-amber-600" :
                          "border-border text-muted-foreground")}>
                      {u.status === "active" ? "Actif" : u.status === "pending" ? "En attente" : "Suspendu"}
                    </Badge>
                  </div>
                ))}
                {users.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">Aucun utilisateur enregistré</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent alerts */}
      {alerts.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Alertes système récentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">Titre</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">Sévérité</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">Date</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.map(a => (
                    <tr key={a.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-2.5 px-3 font-medium">{a.title}</td>
                      <td className="py-2.5 px-3">
                        <Badge variant="outline" className={cn("text-xs",
                          a.severity === "critical" ? "text-destructive border-destructive/30" :
                            a.severity === "warning" ? "text-amber-600 border-amber-300" : "text-muted-foreground")}>
                          {a.severity === "critical" ? "Critique" : a.severity === "warning" ? "Avertissement" : "Info"}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground text-xs">
                        {new Date(a.created_at).toLocaleDateString("fr-FR")}
                      </td>
                      <td className="py-2.5 px-3">
                        <Badge variant="outline" className={cn("text-xs",
                          a.is_resolved ? "text-green-600 border-green-300" : "text-amber-600 border-amber-300")}>
                          {a.is_resolved ? "Résolu" : "Actif"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
