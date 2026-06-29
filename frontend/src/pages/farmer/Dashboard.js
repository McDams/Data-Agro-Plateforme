import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import api from "@/utils/api";
import { Link } from "react-router-dom";
import {
  Cpu, Bell, Droplets, Thermometer, TrendingDown, TrendingUp, Minus,
  AlertTriangle, CheckCircle, WifiOff, Leaf, BarChart2, ArrowRight
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Area, AreaChart
} from "recharts";
import { cn } from "@/lib/utils";

const severityColor = {
  critical: "text-destructive bg-destructive/10 border-destructive/20",
  warning: "text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-900/20 dark:border-amber-800",
  info: "text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-900/20",
  low: "text-primary bg-primary/10 border-primary/20",
};

const riskColor = {
  critical: "text-destructive", high: "text-orange-500",
  medium: "text-amber-500", low: "text-primary",
};

function KpiCard({ title, value, unit, icon: Icon, trend, color = "primary", loading, testid }) {
  if (loading) return (
    <Card><CardContent className="p-5"><Skeleton className="h-16 w-full" /></CardContent></Card>
  );
  return (
    <Card data-testid={testid} className="hover:-translate-y-0.5 transition-transform duration-150">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">{title}</p>
            <p className="text-2xl font-semibold text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>
              {value ?? "—"}
              {unit && <span className="text-base font-normal text-muted-foreground ml-1">{unit}</span>}
            </p>
          </div>
          <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center",
            color === "primary" ? "bg-primary/10" : color === "warning" ? "bg-amber-100 dark:bg-amber-900/30"
              : color === "danger" ? "bg-destructive/10" : "bg-muted")}>
            <Icon size={18} className={cn(
              color === "primary" ? "text-primary" : color === "warning" ? "text-amber-600 dark:text-amber-400"
                : color === "danger" ? "text-destructive" : "text-muted-foreground")} />
          </div>
        </div>
        {trend !== undefined && (
          <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
            {trend > 0 ? <TrendingUp size={12} className="text-primary" /> :
              trend < 0 ? <TrendingDown size={12} className="text-destructive" /> :
                <Minus size={12} />}
            <span>{trend > 0 ? "+" : ""}{trend}% cette semaine</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border rounded-lg p-3 shadow-lg text-xs">
        <p className="text-muted-foreground mb-1">{label}</p>
        {payload.map((p) => (
          <p key={p.name} style={{ color: p.color }} className="font-medium">
            {p.name}: {p.value?.toFixed(1)} {p.unit || ""}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [readings, setReadings] = useState([]);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get("/dashboard/stats").then(r => r.data),
      api.get("/alerts?is_resolved=false&limit=5").then(r => r.data),
      api.get("/predictions?limit=3").then(r => r.data),
      api.get("/readings?limit=48&hours=48").then(r => r.data),
      api.get("/devices").then(r => r.data),
    ]).then(([s, a, p, r, d]) => {
      setStats(s); setAlerts(a); setPredictions(p); setReadings(r); setDevices(d);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  // Build chart data from readings
  const chartData = (() => {
    if (!readings.length) return [];
    const grouped = {};
    readings.slice(0, 24).reverse().forEach((r) => {
      const t = new Date(r.timestamp);
      const key = `${t.getHours()}:00`;
      if (!grouped[key]) grouped[key] = { time: key, moisture: [], temp: [], humidity: [] };
      if (r.soil_moisture != null) grouped[key].moisture.push(r.soil_moisture);
      if (r.air_temperature != null) grouped[key].temp.push(r.air_temperature);
      if (r.air_humidity != null) grouped[key].humidity.push(r.air_humidity);
    });
    return Object.values(grouped).map((g) => ({
      time: g.time,
      moisture: g.moisture.length ? +(g.moisture.reduce((a, b) => a + b, 0) / g.moisture.length).toFixed(1) : null,
      temp: g.temp.length ? +(g.temp.reduce((a, b) => a + b, 0) / g.temp.length).toFixed(1) : null,
      humidity: g.humidity.length ? +(g.humidity.reduce((a, b) => a + b, 0) / g.humidity.length).toFixed(1) : null,
    })).slice(-12);
  })();

  const hasData = stats && (stats.total_devices > 0 || stats.farms > 0);

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>
            Bonjour, {user?.first_name}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        {stats?.active_alerts > 0 && (
          <Link to="/alertes">
            <Badge variant="destructive" className="gap-1">
              <Bell size={12} /> {stats.active_alerts} alerte{stats.active_alerts > 1 ? "s" : ""} active{stats.active_alerts > 1 ? "s" : ""}
            </Badge>
          </Link>
        )}
      </div>

      {/* KPI Cards */}
      <div data-testid="dashboard-stats-cards" className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <KpiCard title="Appareils connectés" value={stats?.total_devices ?? 0} icon={Cpu} loading={loading} testid="kpi-total-devices" />
        <KpiCard title="En ligne" value={stats?.online_devices ?? 0} icon={CheckCircle} color="primary" loading={loading} testid="kpi-online-devices" />
        <KpiCard title="Humidité moy." value={stats?.avg_moisture} unit="%" icon={Droplets} color="primary" loading={loading} testid="kpi-avg-moisture" />
        <KpiCard title="Température moy." value={stats?.avg_temperature} unit="°C" icon={Thermometer} color="warning" loading={loading} testid="kpi-avg-temp" />
        <KpiCard title="NPK moyen" value={stats?.avg_npk} unit="mg/kg" icon={Leaf} loading={loading} testid="kpi-avg-npk" />
        <KpiCard title="Exploitations" value={stats?.farms ?? 0} icon={BarChart2} loading={loading} testid="kpi-farms" />
        <KpiCard title="Parcelles" value={stats?.plots ?? 0} icon={BarChart2} loading={loading} testid="kpi-plots" />
        <KpiCard title="Alertes actives" value={stats?.active_alerts ?? 0} icon={Bell}
          color={stats?.active_alerts > 0 ? "danger" : "primary"} loading={loading} testid="kpi-alerts" />
      </div>

      {/* Empty state */}
      {!loading && !hasData && (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <Leaf size={40} className="text-muted-foreground mx-auto mb-4" />
            <h3 className="font-medium text-foreground mb-2" style={{ fontFamily: "Outfit, sans-serif" }}>
              Aucune donnée pour le moment
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Créez une exploitation et ajoutez des appareils pour commencer à visualiser vos données.
            </p>
            <Button asChild size="sm">
              <Link to="/exploitations">Créer une exploitation <ArrowRight size={14} className="ml-1" /></Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Charts */}
      {!loading && chartData.length > 0 && (
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <Droplets size={16} className="text-blue-500" /> Humidité du sol — 24h
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="mGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="time" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} unit="%" />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="moisture" name="Humidité" unit="%"
                    stroke="hsl(var(--primary))" fill="url(#mGrad)" strokeWidth={2} dot={false} connectNulls />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <Thermometer size={16} className="text-amber-500" /> Température — 24h
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="time" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} unit="°C" />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="temp" name="Température" unit="°C"
                    stroke="#f59e0b" strokeWidth={2} dot={false} connectNulls />
                  <Line type="monotone" dataKey="humidity" name="Humidité air" unit="%"
                    stroke="#3b82f6" strokeWidth={2} dot={false} connectNulls strokeDasharray="4 2" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Alerts + Predictions */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Recent Alerts */}
        <Card>
          <CardHeader className="pb-3 flex-row items-center justify-between">
            <CardTitle className="text-base font-medium">Alertes récentes</CardTitle>
            <Button variant="ghost" size="sm" asChild className="text-xs">
              <Link to="/alertes">Voir tout <ArrowRight size={12} className="ml-1" /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2"><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
            ) : alerts.length === 0 ? (
              <div className="text-center py-6">
                <CheckCircle size={24} className="text-primary mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Aucune alerte active</p>
              </div>
            ) : (
              <div data-testid="dashboard-alerts-summary" className="space-y-2">
                {alerts.map((a) => (
                  <div key={a.id}
                    className={cn("flex items-start gap-3 p-3 rounded-lg border text-sm", severityColor[a.severity])}>
                    <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="font-medium leading-tight">{a.title}</p>
                      <p className="text-xs opacity-75 truncate mt-0.5">{a.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Predictions */}
        <Card>
          <CardHeader className="pb-3 flex-row items-center justify-between">
            <CardTitle className="text-base font-medium">Dernières prédictions</CardTitle>
            <Button variant="ghost" size="sm" asChild className="text-xs">
              <Link to="/predictions">Voir tout <ArrowRight size={12} className="ml-1" /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2"><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
            ) : predictions.length === 0 ? (
              <div className="text-center py-6">
                <Leaf size={24} className="text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  Aucune prédiction — ajoutez des données capteur
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {predictions.map((p) => (
                  <div key={p.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border border-border">
                    <div className={cn("w-2 h-2 rounded-full mt-1.5 shrink-0",
                      p.risk_level === "critical" ? "bg-destructive" :
                        p.risk_level === "high" ? "bg-orange-500" :
                          p.risk_level === "medium" ? "bg-amber-500" : "bg-primary")} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-foreground truncate">{p.target_variable}</p>
                        <span className={cn("text-xs font-semibold", riskColor[p.risk_level])}>
                          {p.risk_level === "low" ? "Faible" : p.risk_level === "medium" ? "Moyen" :
                            p.risk_level === "high" ? "Élevé" : "Critique"}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{p.recommended_action}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Device status */}
      {!loading && devices.length > 0 && (
        <Card>
          <CardHeader className="pb-3 flex-row items-center justify-between">
            <CardTitle className="text-base font-medium">État des appareils</CardTitle>
            <Button variant="ghost" size="sm" asChild className="text-xs">
              <Link to="/appareils">Gérer <ArrowRight size={12} className="ml-1" /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">Appareil</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">Type</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">Statut</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold text-muted-foreground">Batterie</th>
                  </tr>
                </thead>
                <tbody>
                  {devices.slice(0, 5).map((d) => (
                    <tr key={d.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-2.5 px-3 font-medium text-foreground">{d.name}</td>
                      <td className="py-2.5 px-3 text-muted-foreground">{d.device_type}</td>
                      <td className="py-2.5 px-3">
                        <Badge variant="outline" className={cn("text-xs",
                          d.status === "online" ? "border-green-500/30 text-green-600 bg-green-50 dark:bg-green-900/20" :
                            d.status === "warning" ? "border-amber-500/30 text-amber-600 bg-amber-50 dark:bg-amber-900/20" :
                              "border-border text-muted-foreground")}>
                          {d.status === "online" ? "En ligne" : d.status === "offline" ? "Hors ligne" : "Avertissement"}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <span className={cn("text-xs font-medium",
                          d.battery_level > 50 ? "text-primary" : d.battery_level > 20 ? "text-amber-500" : "text-destructive")}>
                          {d.battery_level ?? "—"}%
                        </span>
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
