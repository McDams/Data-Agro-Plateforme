import { useState, useEffect } from "react";
import api from "@/utils/api";
import { Tractor, MapPin, Cpu, User } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export default function AdminFarms() {
  const [farms, setFarms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/admin/farms").then(r => setFarms(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-medium text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>
          Exploitations — Vue admin
        </h1>
        <p className="text-sm text-muted-foreground">Toutes les exploitations enregistrées sur la plateforme</p>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-14" />)}</div>
          ) : farms.length === 0 ? (
            <div className="py-16 text-center">
              <Tractor size={40} className="text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">Aucune exploitation enregistrée</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground">Exploitation</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground">Propriétaire</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground">Localisation</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-muted-foreground">Parcelles</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-muted-foreground">Appareils</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground">Surface</th>
                  </tr>
                </thead>
                <tbody>
                  {farms.map(f => (
                    <tr key={f.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-3 px-4 font-medium">{f.name}</td>
                      <td className="py-3 px-4">
                        <div>
                          <p className="text-sm">{f.owner_name}</p>
                          <p className="text-xs text-muted-foreground">{f.owner_email}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        <div className="flex items-center gap-1"><MapPin size={12} />{f.location}</div>
                      </td>
                      <td className="py-3 px-4 text-center">{f.plots_count || 0}</td>
                      <td className="py-3 px-4 text-center">{f.devices_count || 0}</td>
                      <td className="py-3 px-4 text-right text-muted-foreground">
                        {f.total_area ? `${f.total_area} ha` : "—"}
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
