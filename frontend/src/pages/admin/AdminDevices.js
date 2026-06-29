import { useState, useEffect } from "react";
import api from "@/utils/api";
import { Cpu, Wifi, WifiOff, AlertTriangle, Battery } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export default function AdminDevices() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    const url = filter === "all" ? "/admin/devices" : `/admin/devices?status=${filter}`;
    setLoading(true);
    api.get(url).then(r => setDevices(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, [filter]);

  const counts = {
    all: devices.length,
    online: devices.filter(d => d.status === "online").length,
    offline: devices.filter(d => d.status === "offline").length,
    warning: devices.filter(d => d.status === "warning").length,
  };

  const statusIcon = s => s === "online" ? <Wifi size={12} /> : s === "warning" ? <AlertTriangle size={12} /> : <WifiOff size={12} />;
  const statusStyle = s => ({
    online: "border-green-300 text-green-600 bg-green-50 dark:bg-green-900/20",
    warning: "border-amber-300 text-amber-600 bg-amber-50 dark:bg-amber-900/20",
    offline: "border-border text-muted-foreground",
  }[s] || "border-border");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-medium text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>
          Appareils — Vue admin
        </h1>
        <p className="text-sm text-muted-foreground">Supervision globale des capteurs IoT</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { l: "Total", v: devices.length, k: "all" },
          { l: "En ligne", v: counts.online, k: "online" },
          { l: "Hors ligne", v: counts.offline, k: "offline" },
          { l: "Avertissement", v: counts.warning, k: "warning" },
        ].map(s => (
          <Card key={s.k} className={cn("cursor-pointer transition-colors", filter === s.k && "ring-2 ring-primary")}
            onClick={() => setFilter(s.k)}>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-semibold text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>{s.v}</p>
              <p className="text-xs text-muted-foreground">{s.l}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12" />)}</div>
          ) : devices.length === 0 ? (
            <div className="py-16 text-center">
              <Cpu size={40} className="text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">Aucun appareil trouvé</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground">Appareil</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground">Type</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground">Statut</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-muted-foreground">Batterie</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground">Dernière sync</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground">Firmware</th>
                  </tr>
                </thead>
                <tbody>
                  {devices.map(d => (
                    <tr key={d.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-3 px-4">
                        <p className="font-medium">{d.name}</p>
                        <p className="text-xs text-muted-foreground">{d.device_uid}</p>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">{d.device_type}</td>
                      <td className="py-3 px-4">
                        <Badge variant="outline" className={cn("text-xs gap-1", statusStyle(d.status))}>
                          {statusIcon(d.status)}
                          {d.status === "online" ? "En ligne" : d.status === "offline" ? "Hors ligne" : "Avertissement"}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Battery size={12} className="text-muted-foreground" />
                          <span className={cn("text-xs font-medium",
                            (d.battery_level || 0) > 50 ? "text-primary" :
                              (d.battery_level || 0) > 20 ? "text-amber-500" : "text-destructive")}>
                            {d.battery_level ?? "—"}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground text-xs">
                        {d.last_sync ? new Date(d.last_sync).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "Jamais"}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">v{d.firmware_version || "—"}</td>
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
