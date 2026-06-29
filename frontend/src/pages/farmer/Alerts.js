import { useState, useEffect } from "react";
import api, { formatError } from "@/utils/api";
import { Bell, CheckCircle, AlertTriangle, XCircle, Filter, Trash2, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ALERTS } from "@/constants/testIds";

const SEV = {
  critical: { icon: XCircle, label: "Critique", style: "border-destructive/30 bg-destructive/5 text-destructive" },
  warning: { icon: AlertTriangle, label: "Avertissement", style: "border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400" },
  info: { icon: Bell, label: "Information", style: "border-blue-300 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400" },
};

export default function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("active"); // active, resolved, all
  const [severity, setSeverity] = useState("all");

  const load = () => {
    setLoading(true);
    let url = "/alerts?limit=100";
    if (filter === "active") url += "&is_resolved=false";
    if (filter === "resolved") url += "&is_resolved=true";
    if (severity !== "all") url += `&severity=${severity}`;
    api.get(url).then(r => setAlerts(r.data)).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filter, severity]);

  const resolve = async (id) => {
    try {
      await api.put(`/alerts/${id}/resolve`);
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, is_resolved: true, is_read: true } : a));
      toast.success("Alerte résolue");
    } catch (err) { toast.error(formatError(err.response?.data?.detail)); }
  };

  const markRead = async (id) => {
    try {
      await api.put(`/alerts/${id}/read`);
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, is_read: true } : a));
    } catch {}
  };

  const deleteAlert = async (id) => {
    try {
      await api.delete(`/alerts/${id}`);
      setAlerts(prev => prev.filter(a => a.id !== id));
      toast.success("Alerte supprimée");
    } catch {}
  };

  const resolveAll = async () => {
    const unresolved = alerts.filter(a => !a.is_resolved);
    await Promise.all(unresolved.map(a => api.put(`/alerts/${a.id}/resolve`).catch(() => {})));
    load();
    toast.success("Toutes les alertes résolues");
  };

  const counts = {
    all: alerts.length,
    critical: alerts.filter(a => a.severity === "critical").length,
    warning: alerts.filter(a => a.severity === "warning").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-medium text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>Alertes</h1>
          <p className="text-sm text-muted-foreground">Gérez les alertes de votre exploitation</p>
        </div>
        {alerts.filter(a => !a.is_resolved).length > 0 && (
          <Button variant="outline" onClick={resolveAll} data-testid="resolve-all-alerts" className="gap-2">
            <Check size={14} /> Tout résoudre
          </Button>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total", value: counts.all, color: "text-foreground" },
          { label: "Critiques", value: counts.critical, color: "text-destructive" },
          { label: "Avertissements", value: counts.warning, color: "text-amber-600" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4 text-center">
              <p className={cn("text-2xl font-semibold", s.color)} style={{ fontFamily: "Outfit, sans-serif" }}>{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <Filter size={14} className="text-muted-foreground" />
        <div className="flex border border-border rounded-md overflow-hidden">
          {[
            { v: "active", l: "Actives" },
            { v: "resolved", l: "Résolues" },
            { v: "all", l: "Toutes" },
          ].map(f => (
            <button key={f.v} onClick={() => setFilter(f.v)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${filter === f.v ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
              {f.l}
            </button>
          ))}
        </div>
        <div className="flex border border-border rounded-md overflow-hidden">
          {[
            { v: "all", l: "Toutes" },
            { v: "critical", l: "Critiques" },
            { v: "warning", l: "Avertissements" },
            { v: "info", l: "Infos" },
          ].map(f => (
            <button key={f.v} onClick={() => setSeverity(f.v)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${severity === f.v ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
              {f.l}
            </button>
          ))}
        </div>
      </div>

      {/* Alert list */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : alerts.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <CheckCircle size={40} className="text-primary mx-auto mb-4" />
            <h3 className="font-medium text-foreground mb-2">Aucune alerte</h3>
            <p className="text-sm text-muted-foreground">Tout va bien sur vos exploitations !</p>
          </CardContent>
        </Card>
      ) : (
        <div data-testid={ALERTS.list} className="space-y-3">
          {alerts.map((a) => {
            const cfg = SEV[a.severity] || SEV.info;
            const Icon = cfg.icon;
            return (
              <Card key={a.id} className={cn("border transition-opacity", cfg.style, a.is_resolved && "opacity-60")}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Icon size={16} className="shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div>
                          <p className="font-semibold text-sm leading-tight">{a.title}</p>
                          <p className="text-xs opacity-80 mt-0.5">{a.message}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Badge variant="outline" className={cn("text-xs", cfg.style)}>{cfg.label}</Badge>
                          {a.is_resolved && <Badge variant="outline" className="text-xs border-green-300 text-green-600">Résolu</Badge>}
                          {!a.is_read && <div className="w-2 h-2 rounded-full bg-primary" />}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 mt-3">
                        <p className="text-xs opacity-60">
                          {new Date(a.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                        </p>
                        {!a.is_resolved && (
                          <Button size="sm" variant="ghost" className="h-6 text-xs gap-1 px-2"
                            onClick={() => resolve(a.id)} data-testid={ALERTS.resolveButton}>
                            <Check size={11} /> Résoudre
                          </Button>
                        )}
                        {!a.is_read && (
                          <Button size="sm" variant="ghost" className="h-6 text-xs px-2"
                            onClick={() => markRead(a.id)}>
                            Marquer lue
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="h-6 text-xs px-2 opacity-60 hover:opacity-100"
                          onClick={() => deleteAlert(a.id)}>
                          <Trash2 size={11} />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
