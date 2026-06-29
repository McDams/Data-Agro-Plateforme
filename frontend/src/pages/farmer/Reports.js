import { useState, useEffect } from "react";
import api from "@/utils/api";
import { FileText, Download, BarChart2, Bell, Cpu, Leaf } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const REPORT_TYPES = [
  { id: "overview", icon: BarChart2, title: "Rapport complet", desc: "Aperçu général : exploitations, parcelles, appareils et données." },
  { id: "alerts", icon: Bell, title: "Rapport alertes", desc: "Résumé de toutes les alertes sur la période." },
  { id: "predictions", icon: Leaf, title: "Rapport prédictions", desc: "Résumé des prédictions et recommandations." },
  { id: "devices", icon: Cpu, title: "Rapport appareils", desc: "État et performances de vos capteurs connectés." },
];

export default function Reports() {
  const [stats, setStats] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [devices, setDevices] = useState([]);
  const [generating, setGenerating] = useState(null);
  const [period, setPeriod] = useState("7d");

  useEffect(() => {
    Promise.all([
      api.get("/dashboard/stats").then(r => r.data),
      api.get("/alerts?limit=100").then(r => r.data),
      api.get("/predictions?limit=50").then(r => r.data),
      api.get("/devices").then(r => r.data),
    ]).then(([s, a, p, d]) => { setStats(s); setAlerts(a); setPredictions(p); setDevices(d); })
      .catch(() => {});
  }, []);

  const generateReport = async (type) => {
    setGenerating(type);
    await new Promise(r => setTimeout(r, 1200));
    const content = buildReport(type);
    downloadReport(content, `datagro-rapport-${type}.txt`);
    setGenerating(null);
    toast.success("Rapport téléchargé");
  };

  const buildReport = (type) => {
    const date = new Date().toLocaleDateString("fr-FR", { dateStyle: "full" });
    let lines = [
      "=== RAPPORT AGRIFLOW ===",
      `Généré le: ${date}`,
      `Période: ${period === "7d" ? "7 derniers jours" : period === "30d" ? "30 derniers jours" : "Tout"}`,
      "",
    ];

    if (type === "overview" || type === "all") {
      lines.push("--- STATISTIQUES GÉNÉRALES ---");
      if (stats) {
        lines.push(`Exploitations: ${stats.farms}`);
        lines.push(`Parcelles: ${stats.plots}`);
        lines.push(`Appareils total: ${stats.total_devices}`);
        lines.push(`Appareils en ligne: ${stats.online_devices}`);
        if (stats.avg_moisture) lines.push(`Humidité moy.: ${stats.avg_moisture}%`);
        if (stats.avg_temperature) lines.push(`Température moy.: ${stats.avg_temperature}°C`);
      }
    }
    if (type === "alerts" || type === "all") {
      lines.push("", "--- ALERTES ---");
      lines.push(`Total alertes: ${alerts.length}`);
      lines.push(`Alertes critiques: ${alerts.filter(a => a.severity === "critical").length}`);
      lines.push(`Alertes résolues: ${alerts.filter(a => a.is_resolved).length}`);
      alerts.slice(0, 10).forEach(a => {
        lines.push(`[${a.severity.toUpperCase()}] ${a.title} — ${new Date(a.created_at).toLocaleDateString("fr-FR")}`);
      });
    }
    if (type === "predictions") {
      lines.push("", "--- PRÉDICTIONS ---");
      predictions.forEach(p => {
        lines.push(`${p.target_variable} — ${p.plot_name} — Risque: ${p.risk_level}`);
        lines.push(`  Action: ${p.recommended_action}`);
      });
    }
    if (type === "devices") {
      lines.push("", "--- APPAREILS ---");
      devices.forEach(d => {
        lines.push(`${d.name} (${d.device_uid}) — ${d.status.toUpperCase()} — Batterie: ${d.battery_level}%`);
      });
    }

    return lines.join("\n");
  };

  const downloadReport = (content, filename) => {
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const exportAllCSV = () => {
    if (!alerts.length && !predictions.length && !devices.length) {
      toast.error("Aucune donnée à exporter"); return;
    }
    const rows = [
      ["Type", "Titre/Nom", "Date", "Statut/Valeur"],
      ...alerts.map(a => ["Alerte", a.title, new Date(a.created_at).toLocaleDateString("fr-FR"), a.severity]),
      ...predictions.map(p => ["Prédiction", p.target_variable, new Date(p.created_at).toLocaleDateString("fr-FR"), p.risk_level]),
      ...devices.map(d => ["Appareil", d.name, d.last_sync ? new Date(d.last_sync).toLocaleDateString("fr-FR") : "—", d.status]),
    ];
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "datagro-export-complet.csv"; a.click();
    URL.revokeObjectURL(url);
    toast.success("Export CSV téléchargé");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-medium text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>Rapports</h1>
          <p className="text-sm text-muted-foreground">Générez et exportez vos rapports</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={period} onChange={e => setPeriod(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm">
            <option value="7d">7 derniers jours</option>
            <option value="30d">30 derniers jours</option>
            <option value="all">Toute la période</option>
          </select>
          <Button variant="outline" onClick={exportAllCSV} className="gap-2" data-testid="export-all-csv">
            <Download size={14} /> Export CSV complet
          </Button>
        </div>
      </div>

      {/* Stats summary */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Exploitations", value: stats.farms },
            { label: "Parcelles", value: stats.plots },
            { label: "Appareils", value: stats.total_devices },
            { label: "Alertes actives", value: stats.active_alerts },
          ].map(s => (
            <Card key={s.label}>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-semibold text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Report types */}
      <div className="grid md:grid-cols-2 gap-4">
        {REPORT_TYPES.map((rt) => (
          <Card key={rt.id} className="hover:-translate-y-0.5 transition-transform duration-150">
            <CardContent className="p-5 flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <rt.icon size={20} className="text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground mb-1" style={{ fontFamily: "Outfit, sans-serif" }}>
                  {rt.title}
                </h3>
                <p className="text-sm text-muted-foreground mb-3">{rt.desc}</p>
                <Button size="sm" onClick={() => generateReport(rt.id)}
                  disabled={generating === rt.id}
                  data-testid={`generate-report-${rt.id}`}
                  className="gap-2">
                  {generating === rt.id ? (
                    <><Download size={12} className="animate-bounce" /> Génération...</>
                  ) : (
                    <><Download size={12} /> Générer</>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent alerts summary */}
      {alerts.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Résumé des alertes récentes</CardTitle>
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
                  {alerts.slice(0, 8).map(a => (
                    <tr key={a.id} className="border-b border-border/50">
                      <td className="py-2 px-3 font-medium">{a.title}</td>
                      <td className="py-2 px-3">
                        <Badge variant="outline" className="text-xs">
                          {a.severity === "critical" ? "Critique" : a.severity === "warning" ? "Avertissement" : "Info"}
                        </Badge>
                      </td>
                      <td className="py-2 px-3 text-muted-foreground text-xs">
                        {new Date(a.created_at).toLocaleDateString("fr-FR")}
                      </td>
                      <td className="py-2 px-3">
                        <Badge variant="outline" className={`text-xs ${a.is_resolved ? "text-green-600" : "text-amber-600"}`}>
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
