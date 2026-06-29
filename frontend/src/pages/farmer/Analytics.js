import { useState, useEffect } from "react";
import api from "@/utils/api";
import { BarChart2, Filter, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend
} from "recharts";
import { toast } from "sonner";

const METRICS = [
  { key: "soil_moisture", label: "Humidité sol (%)", color: "hsl(var(--primary))" },
  { key: "air_temperature", label: "Temp. air (°C)", color: "#f59e0b" },
  { key: "soil_temperature", label: "Temp. sol (°C)", color: "#ef4444" },
  { key: "air_humidity", label: "Humidité air (%)", color: "#3b82f6" },
  { key: "soil_nitrogen", label: "Azote N (mg/kg)", color: "#8b5cf6" },
  { key: "soil_phosphorus", label: "Phosphore P (mg/kg)", color: "#06b6d4" },
  { key: "soil_potassium", label: "Potassium K (mg/kg)", color: "#10b981" },
  { key: "ph", label: "pH", color: "#f97316" },
];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-lg text-xs space-y-1">
      <p className="text-muted-foreground font-medium">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color }} className="font-semibold">
          {p.name}: {typeof p.value === "number" ? p.value.toFixed(1) : p.value}
        </p>
      ))}
    </div>
  );
};

export default function Analytics() {
  const [farms, setFarms] = useState([]);
  const [plots, setPlots] = useState([]);
  const [devices, setDevices] = useState([]);
  const [readings, setReadings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedFarm, setSelectedFarm] = useState("all");
  const [selectedPlot, setSelectedPlot] = useState("all");
  const [selectedDevice, setSelectedDevice] = useState("all");
  const [hours, setHours] = useState(24);
  const [selectedMetrics, setSelectedMetrics] = useState(["soil_moisture", "air_temperature"]);
  const [chartType, setChartType] = useState("line");

  useEffect(() => {
    Promise.all([
      api.get("/farms").then(r => r.data),
      api.get("/plots").then(r => r.data),
      api.get("/devices").then(r => r.data),
    ]).then(([f, p, d]) => { setFarms(f); setPlots(p); setDevices(d); });
  }, []);

  const loadReadings = () => {
    setLoading(true);
    let url = `/readings?limit=500&hours=${hours}`;
    if (selectedDevice !== "all") url += `&device_id=${selectedDevice}`;
    else if (selectedPlot !== "all") url += `&plot_id=${selectedPlot}`;
    api.get(url).then(r => setReadings(r.data)).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { loadReadings(); }, [selectedDevice, selectedPlot, hours]);

  const filteredPlots = selectedFarm === "all" ? plots : plots.filter(p => p.farm_id === selectedFarm);
  const filteredDevices = selectedPlot === "all" ? devices : devices.filter(d => d.plot_id === selectedPlot);

  // Build chart data
  const chartData = (() => {
    if (!readings.length) return [];
    const grouped = {};
    [...readings].reverse().forEach(r => {
      const d = new Date(r.timestamp);
      const key = hours <= 24
        ? `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
        : d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit" });
      if (!grouped[key]) {
        grouped[key] = { time: key };
        METRICS.forEach(m => { grouped[key][`_${m.key}_vals`] = []; });
      }
      METRICS.forEach(m => { if (r[m.key] != null) grouped[key][`_${m.key}_vals`].push(r[m.key]); });
    });
    return Object.values(grouped).map(g => {
      const entry = { time: g.time };
      METRICS.forEach(m => {
        const vals = g[`_${m.key}_vals`];
        entry[m.key] = vals?.length ? +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2) : null;
      });
      return entry;
    }).slice(-30);
  })();

  const toggleMetric = (key) => {
    setSelectedMetrics(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const exportCSV = () => {
    if (!readings.length) { toast.error("Aucune donnée à exporter"); return; }
    const headers = ["timestamp", ...METRICS.map(m => m.key)];
    const rows = readings.map(r =>
      [r.timestamp, ...METRICS.map(m => r[m.key] ?? "")].join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "datagro-donnees.csv"; a.click();
    URL.revokeObjectURL(url);
    toast.success("Export CSV téléchargé");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-medium text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>Analytiques</h1>
          <p className="text-sm text-muted-foreground">Visualisez vos données capteur</p>
        </div>
        <Button variant="outline" onClick={exportCSV} className="gap-2" data-testid="export-csv-button">
          <Download size={14} /> Exporter CSV
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-center">
            <Filter size={14} className="text-muted-foreground" />
            <select value={selectedFarm} onChange={e => { setSelectedFarm(e.target.value); setSelectedPlot("all"); setSelectedDevice("all"); }}
              className="h-8 rounded-md border border-input bg-background px-2 text-sm">
              <option value="all">Toutes les exploitations</option>
              {farms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            <select value={selectedPlot} onChange={e => { setSelectedPlot(e.target.value); setSelectedDevice("all"); }}
              className="h-8 rounded-md border border-input bg-background px-2 text-sm">
              <option value="all">Toutes les parcelles</option>
              {filteredPlots.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select value={selectedDevice} onChange={e => setSelectedDevice(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-sm">
              <option value="all">Tous les appareils</option>
              {filteredDevices.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <select value={hours} onChange={e => setHours(parseInt(e.target.value))}
              className="h-8 rounded-md border border-input bg-background px-2 text-sm">
              <option value={6}>6 heures</option>
              <option value={24}>24 heures</option>
              <option value={48}>48 heures</option>
              <option value={168}>7 jours</option>
              <option value={720}>30 jours</option>
            </select>
            <div className="flex border border-border rounded-md overflow-hidden">
              {["line", "area", "bar"].map(t => (
                <button key={t} onClick={() => setChartType(t)}
                  className={`px-3 py-1 text-xs font-medium transition-colors ${chartType === t ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
                  {t === "line" ? "Ligne" : t === "area" ? "Aire" : "Barre"}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metric selector */}
      <div className="flex flex-wrap gap-2">
        {METRICS.map(m => (
          <button key={m.key} onClick={() => toggleMetric(m.key)} data-testid={`metric-${m.key}`}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
              selectedMetrics.includes(m.key)
                ? "text-white border-transparent"
                : "border-border text-muted-foreground hover:bg-muted"}`}
            style={selectedMetrics.includes(m.key) ? { backgroundColor: m.color, borderColor: m.color } : {}}>
            {m.label}
          </button>
        ))}
      </div>

      {/* Chart */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <BarChart2 size={16} className="text-primary" />
            Évolution des données — {hours === 168 ? "7 jours" : hours === 720 ? "30 jours" : `${hours}h`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-72 w-full" />
          ) : chartData.length === 0 ? (
            <div className="h-72 flex items-center justify-center">
              <div className="text-center">
                <BarChart2 size={40} className="text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Aucune donnée disponible</p>
                <p className="text-xs text-muted-foreground mt-1">Simulez des lectures sur vos appareils</p>
              </div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              {chartType === "bar" ? (
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  {METRICS.filter(m => selectedMetrics.includes(m.key)).map(m => (
                    <Bar key={m.key} dataKey={m.key} name={m.label} fill={m.color} opacity={0.8} />
                  ))}
                </BarChart>
              ) : chartType === "area" ? (
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  {METRICS.filter(m => selectedMetrics.includes(m.key)).map(m => (
                    <Area key={m.key} type="monotone" dataKey={m.key} name={m.label}
                      stroke={m.color} fill={m.color} fillOpacity={0.1} strokeWidth={2} dot={false} connectNulls />
                  ))}
                </AreaChart>
              ) : (
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  {METRICS.filter(m => selectedMetrics.includes(m.key)).map(m => (
                    <Line key={m.key} type="monotone" dataKey={m.key} name={m.label}
                      stroke={m.color} strokeWidth={2} dot={false} connectNulls />
                  ))}
                </LineChart>
              )}
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Raw data table */}
      {readings.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Données brutes ({readings.length} enregistrements)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 font-semibold text-muted-foreground">Horodatage</th>
                    {METRICS.filter(m => selectedMetrics.includes(m.key)).map(m => (
                      <th key={m.key} className="text-right py-2 px-3 font-semibold text-muted-foreground">{m.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {readings.slice(0, 20).map(r => (
                    <tr key={r.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-2 px-3 text-muted-foreground">
                        {new Date(r.timestamp).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                      </td>
                      {METRICS.filter(m => selectedMetrics.includes(m.key)).map(m => (
                        <td key={m.key} className="py-2 px-3 text-right font-medium">
                          {r[m.key] != null ? r[m.key].toFixed(1) : "—"}
                        </td>
                      ))}
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
