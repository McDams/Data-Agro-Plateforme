import { useState, useEffect } from "react";
import api from "@/utils/api";
import { Bell, CheckCircle, AlertTriangle, XCircle, Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export default function AdminAlerts() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    const url = filter === "all" ? "/admin/alerts" : `/admin/alerts?severity=${filter}`;
    setLoading(true);
    api.get(url).then(r => setAlerts(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, [filter]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-medium text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>
          Alertes — Vue admin
        </h1>
        <p className="text-sm text-muted-foreground">Toutes les alertes de la plateforme</p>
      </div>

      <div className="flex gap-2 border-b border-border pb-2">
        {[
          { v: "all", l: "Toutes" }, { v: "critical", l: "Critiques" },
          { v: "warning", l: "Avertissements" }, { v: "info", l: "Informations" },
        ].map(f => (
          <button key={f.v} onClick={() => setFilter(f.v)}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${filter === f.v ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`}>
            {f.l}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-14" />)}</div>
          ) : alerts.length === 0 ? (
            <div className="py-16 text-center">
              <CheckCircle size={40} className="text-primary mx-auto mb-3" />
              <p className="text-muted-foreground">Aucune alerte</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground">Titre</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground">Message</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground">Sévérité</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground">Date</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.map(a => (
                    <tr key={a.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-3 px-4 font-medium max-w-[180px] truncate">{a.title}</td>
                      <td className="py-3 px-4 text-muted-foreground max-w-[220px] truncate">{a.message}</td>
                      <td className="py-3 px-4">
                        <Badge variant="outline" className={cn("text-xs",
                          a.severity === "critical" ? "text-destructive border-destructive/30" :
                            a.severity === "warning" ? "text-amber-600 border-amber-300" : "text-muted-foreground")}>
                          {a.severity === "critical" ? "Critique" : a.severity === "warning" ? "Avertissement" : "Info"}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground text-xs">
                        {new Date(a.created_at).toLocaleDateString("fr-FR")}
                      </td>
                      <td className="py-3 px-4">
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
