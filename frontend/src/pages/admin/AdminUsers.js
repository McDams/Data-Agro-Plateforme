import { useState, useEffect } from "react";
import api, { formatError } from "@/utils/api";
import { Search, UserCheck, UserX, ShieldCheck, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const STATUS = {
  active: { label: "Actif", color: "border-green-300 text-green-600 bg-green-50 dark:bg-green-900/20" },
  pending: { label: "En attente", color: "border-amber-300 text-amber-600 bg-amber-50 dark:bg-amber-900/20" },
  suspended: { label: "Suspendu", color: "border-destructive/30 text-destructive" },
};

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedUser, setSelectedUser] = useState(null);

  const load = () => {
    setLoading(true);
    let url = "/admin/users";
    const params = [];
    if (statusFilter !== "all") params.push(`status=${statusFilter}`);
    if (search) params.push(`search=${search}`);
    if (params.length) url += "?" + params.join("&");
    api.get(url).then(r => setUsers(r.data)).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [statusFilter]);

  const handleSearch = (e) => {
    e.preventDefault(); load();
  };

  const updateStatus = async (uid, status) => {
    try {
      await api.put(`/admin/users/${uid}/status`, { status });
      setUsers(prev => prev.map(u => u.id === uid ? { ...u, status } : u));
      if (selectedUser?.id === uid) setSelectedUser(u => ({ ...u, status }));
      toast.success("Statut mis à jour");
    } catch (err) { toast.error(formatError(err.response?.data?.detail)); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-medium text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>
          Gestion des utilisateurs
        </h1>
        <p className="text-sm text-muted-foreground">Gérez les comptes agriculteurs</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1 min-w-[200px]">
          <Input data-testid="admin-user-search" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher par nom ou email..." className="max-w-xs" />
          <Button type="submit" variant="outline" size="icon" className="shrink-0">
            <Search size={14} />
          </Button>
        </form>
        <div className="flex border border-border rounded-md overflow-hidden">
          {[
            { v: "all", l: "Tous" },
            { v: "active", l: "Actifs" },
            { v: "pending", l: "En attente" },
            { v: "suspended", l: "Suspendus" },
          ].map(f => (
            <button key={f.v} onClick={() => setStatusFilter(f.v)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${statusFilter === f.v ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
              {f.l}
            </button>
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-12" />)}</div>
          ) : users.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-muted-foreground">Aucun utilisateur trouvé</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="admin-users-table">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground">Utilisateur</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground">Contact</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground">Exploitation</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-muted-foreground">Fermes</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground">Statut</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => {
                    const st = STATUS[u.status] || STATUS.active;
                    return (
                      <tr key={u.id} className="border-b border-border/50 hover:bg-muted/30 cursor-pointer"
                        onClick={() => setSelectedUser(u)}>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                              <span className="text-xs font-medium text-primary">
                                {u.first_name?.[0]}{u.last_name?.[0]}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium">{u.first_name} {u.last_name}</p>
                              <p className="text-xs text-muted-foreground">{u.country}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">{u.email}</td>
                        <td className="py-3 px-4 text-muted-foreground">{u.farm_name || "—"}</td>
                        <td className="py-3 px-4 text-center">{u.farms_count || 0}</td>
                        <td className="py-3 px-4">
                          <Badge variant="outline" className={cn("text-xs", st.color)}>{st.label}</Badge>
                        </td>
                        <td className="py-3 px-4" onClick={e => e.stopPropagation()}>
                          <div className="flex gap-1">
                            {u.status !== "active" && (
                              <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-primary"
                                onClick={() => updateStatus(u.id, "active")} data-testid="activate-user-btn">
                                <UserCheck size={11} /> Activer
                              </Button>
                            )}
                            {u.status !== "suspended" && (
                              <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-destructive"
                                onClick={() => updateStatus(u.id, "suspended")} data-testid="suspend-user-btn">
                                <UserX size={11} /> Suspendre
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* User detail modal */}
      <Dialog open={!!selectedUser} onOpenChange={o => !o && setSelectedUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "Outfit, sans-serif" }}>
              {selectedUser?.first_name} {selectedUser?.last_name}
            </DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  { l: "Email", v: selectedUser.email },
                  { l: "Téléphone", v: selectedUser.phone || "—" },
                  { l: "Exploitation", v: selectedUser.farm_name || "—" },
                  { l: "Pays", v: selectedUser.country || "—" },
                  { l: "Exploitations", v: selectedUser.farms_count || 0 },
                  { l: "Appareils", v: selectedUser.devices_count || 0 },
                  { l: "Inscription", v: selectedUser.created_at ? new Date(selectedUser.created_at).toLocaleDateString("fr-FR") : "—" },
                  { l: "Statut", v: STATUS[selectedUser.status]?.label || selectedUser.status },
                ].map(({ l, v }) => (
                  <div key={l}>
                    <p className="text-xs text-muted-foreground">{l}</p>
                    <p className="font-medium text-foreground">{v}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 pt-2 border-t border-border">
                {selectedUser.status !== "active" && (
                  <Button size="sm" className="gap-1 flex-1"
                    onClick={() => updateStatus(selectedUser.id, "active")}>
                    <UserCheck size={13} /> Activer
                  </Button>
                )}
                {selectedUser.status !== "suspended" && (
                  <Button size="sm" variant="destructive" className="gap-1 flex-1"
                    onClick={() => updateStatus(selectedUser.id, "suspended")}>
                    <UserX size={13} /> Suspendre
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
