import { useState, useEffect } from "react";
import api, { formatError } from "@/utils/api";
import { Plus, Pencil, Trash2, MapPin, Wheat, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { FARMS } from "@/constants/testIds";

function FarmForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial || { name: "", location: "", description: "", total_area: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      const payload = { name: form.name, location: form.location,
        description: form.description || null,
        total_area: form.total_area ? parseFloat(form.total_area) : null };
      let data;
      if (initial?.id) {
        ({ data } = await api.put(`/farms/${initial.id}`, payload));
      } else {
        ({ data } = await api.post("/farms", payload));
      }
      onSave(data);
    } catch (err) { setError(formatError(err.response?.data?.detail)); }
    finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      <div className="space-y-1.5">
        <Label>Nom de l'exploitation *</Label>
        <Input data-testid="farm-form-name" value={form.name} onChange={set("name")} required placeholder="ex: Ferme des Chênes" />
      </div>
      <div className="space-y-1.5">
        <Label>Localisation *</Label>
        <Input data-testid="farm-form-location" value={form.location} onChange={set("location")} required placeholder="ex: Beauce, Eure-et-Loir" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Surface totale (ha)</Label>
          <Input type="number" step="0.1" value={form.total_area} onChange={set("total_area")} placeholder="ex: 45" />
        </div>
        <div className="space-y-1.5">
          <Label>Description</Label>
          <Input value={form.description} onChange={set("description")} placeholder="Optionnel" />
        </div>
      </div>
      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">Annuler</Button>
        <Button data-testid="farm-form-submit" type="submit" className="flex-1" disabled={loading}>
          {loading ? "Enregistrement..." : initial?.id ? "Mettre à jour" : "Créer"}
        </Button>
      </div>
    </form>
  );
}

export default function Farms() {
  const [farms, setFarms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editFarm, setEditFarm] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const load = () => {
    setLoading(true);
    api.get("/farms").then(r => setFarms(r.data)).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleSave = (farm) => {
    setFarms((prev) => {
      const idx = prev.findIndex(f => f.id === farm.id);
      if (idx >= 0) { const n = [...prev]; n[idx] = farm; return n; }
      return [...prev, farm];
    });
    setShowCreate(false); setEditFarm(null);
    toast.success(farm.id && editFarm ? "Exploitation mise à jour" : "Exploitation créée");
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Supprimer cette exploitation ?")) return;
    setDeletingId(id);
    try {
      await api.delete(`/farms/${id}`);
      setFarms((prev) => prev.filter(f => f.id !== id));
      toast.success("Exploitation supprimée");
    } catch (err) { toast.error(formatError(err.response?.data?.detail)); }
    finally { setDeletingId(null); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>
            Exploitations
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gérez vos exploitations agricoles
          </p>
        </div>
        <Button data-testid={FARMS.createButton} onClick={() => setShowCreate(true)} className="gap-2">
          <Plus size={16} /> Nouvelle exploitation
        </Button>
      </div>

      {loading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <Card key={i}><CardContent className="p-5"><Skeleton className="h-24" /></CardContent></Card>)}
        </div>
      ) : farms.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <Wheat size={40} className="text-muted-foreground mx-auto mb-4" />
            <h3 className="font-medium text-foreground mb-2" style={{ fontFamily: "Outfit, sans-serif" }}>
              Aucune exploitation
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Créez votre première exploitation pour commencer.
            </p>
            <Button onClick={() => setShowCreate(true)} size="sm" className="gap-2">
              <Plus size={14} /> Créer une exploitation
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div data-testid={FARMS.list} className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {farms.map((farm) => (
            <Card key={farm.id} data-testid={FARMS.farmCard}
              className="hover:-translate-y-0.5 transition-transform duration-150">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base font-semibold line-clamp-1" style={{ fontFamily: "Outfit, sans-serif" }}>
                    {farm.name}
                  </CardTitle>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7"
                      onClick={() => setEditFarm(farm)} data-testid="farm-edit-button">
                      <Pencil size={12} />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(farm.id)} disabled={deletingId === farm.id}
                      data-testid="farm-delete-button">
                      <Trash2 size={12} />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin size={13} className="shrink-0" />
                  <span className="truncate">{farm.location}</span>
                </div>
                {farm.total_area && (
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">{farm.total_area} ha</Badge>
                  </div>
                )}
                {farm.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{farm.description}</p>
                )}
                <div className="flex items-center justify-between pt-1 border-t border-border">
                  <p className="text-xs text-muted-foreground">
                    Créée le {new Date(farm.created_at).toLocaleDateString("fr-FR")}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "Outfit, sans-serif" }}>Nouvelle exploitation</DialogTitle>
          </DialogHeader>
          <FarmForm onSave={handleSave} onCancel={() => setShowCreate(false)} />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editFarm} onOpenChange={(o) => !o && setEditFarm(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "Outfit, sans-serif" }}>Modifier l'exploitation</DialogTitle>
          </DialogHeader>
          {editFarm && <FarmForm initial={editFarm} onSave={handleSave} onCancel={() => setEditFarm(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
