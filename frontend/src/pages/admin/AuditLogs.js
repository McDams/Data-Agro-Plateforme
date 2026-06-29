import { useState, useEffect } from "react";
import api from "@/utils/api";
import { ScrollText, User, Clock, Activity } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/admin/audit-logs").then(r => setLogs(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-medium text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>
          Journal d'audit
        </h1>
        <p className="text-sm text-muted-foreground">Historique des actions sur la plateforme</p>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-3">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-12" />)}</div>
          ) : logs.length === 0 ? (
            <div className="py-16 text-center">
              <ScrollText size={40} className="text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">Aucune entrée dans le journal</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground">Action</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground">Ressource</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground">Utilisateur</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(l => (
                    <tr key={l.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-3 px-4">
                        <Badge variant="secondary" className="text-xs">{l.action}</Badge>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {l.resource_type} {l.resource_id && <span className="text-xs opacity-60">#{l.resource_id.slice(-6)}</span>}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground text-xs">{l.user_id?.slice(-8) || "—"}</td>
                      <td className="py-3 px-4 text-muted-foreground text-xs">
                        {new Date(l.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
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
