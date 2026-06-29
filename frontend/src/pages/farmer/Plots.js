import { useState, useEffect } from "react";
import api, { formatError } from "@/utils/api";
import { Plus, Pencil, Trash2, MapPin, Leaf, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PLOTS } from "@/constants/testIds";

const CROP_TYPES = ["Blé", "Maïs", "Tournesol", "Colza", "Betterave", "Pomme de terre",
  "Vigne", "Arboriculture", "Maraîchage", "Légumineuses", "Autre"];

const STATUS_LABELS = { active: "Active", inactive: "Inactive", harvested: "Récoltée" };
const STATUS_COLORS = {
  active: "border-green-500/30 text-green-600 bg-green-50 dark:bg-green-900/20",
  inactive: "border-border text-muted-foreground",
  harvested: "border-amber-500/30 text-amber-600 bg-amber-50 dark:bg-amber-900/20",
};

function PlotForm({ farms, initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial || {
    farm_id: farms[0]?.id || "", name: "", location: "", area: "",
    crop_type: "Blé", sowing_date: "", notes: "", status: "active"
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      const payload = { farm_id: form.farm_id, name: form.name, location: form.location || null,
        area: form.area ? parseFloat(form.area) : null, crop_type: form.crop_type,
        sowing_date: form.sowing_date || null, notes: form.notes || null, status: form.status };
      let data;
      if (initial?.id) { ({ data } = await api.put(`/plots/${initial.id}`, payload)); }
      else { ({ data } = await api.post("/plots", payload)); }
      onSave(data);
    } catch (err) { setError(formatError(err.response?.data?.detail)); }
    finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      <div className="space-y-1.5">
        <Label>Exploitation *</Label>
        <select data-testid="plot-form-farm" value={form.farm_id} onChange={set("farm_id")} required
          className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
          {farms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Nom de la parcelle *</Label>
          <Input data-testid="plot-form-name" value={form.name} onChange={set("name")} required placeholder="Parcelle Nord B2" />
        </div>
        <div className="space-y-1.5">
          <Label>Type de culture</Label>
          <select value={form.crop_type} onChange={set("crop_type")}
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
            {CROP_TYPES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Surface (ha)</Label>
          <Input type="number" step="0.1" value={form.area} onChange={set("area")} placeholder="5.2" />
        </div>
        <div className="space-y-1.5">
          <Label>Date de semis</Label>
          <Input type="date" value={form.sowing_date} onChange={set("sowing_date")} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Localisation GPS</Label>
        <Input value={form.location} onChange={set("location")} placeholder="48.8566, 2.3522" />
      </div>
      <div className="space-y-1.5">
        <Label>Statut</Label>
        <select value={form.status} onChange={set("status")}
          className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="harvested">Récoltée</option>
        </select>
      </div>
      <div className="space-y-1.5">
        <Label>Notes</Label>
        <Input value={form.notes} onChange={set("notes")} placeholder="Informations complémentaires..." />
      </div>
      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">Annuler</Button>
        <Button data-testid="plot-form-submit" type="submit" className="flex-1" disabled={loading}>
          {loading ? "Enregistrement..." : initial?.id ? "Mettre à jour" : "Créer"}
        </Button>
      </div>
    </form>
  );
}

export default function Plots() {
  const [farms, setFarms] = useState([]);
  const [plots, setPlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFarm, setSelectedFarm] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [editPlot, setEditPlot] = useState(null);

  useEffect(() => {
    Promise.all([api.get("/farms").then(r => r.data), api.get("/plots").then(r => r.data)])
      .then(([f, p]) => { setFarms(f); setPlots(p); })
      .catch(() => {}).finally(() => setLoading(false));
  }, []);

  const filtered = selectedFarm === "all" ? plots : plots.filter(p => p.farm_id === selectedFarm);

  const handleSave = (plot) => {
    setPlots(prev => {
      const idx = prev.findIndex(p => p.id === plot.id);
      if (idx >= 0) { const n = [...prev]; n[idx] = plot; return n; }
      return [...prev, plot];
    });
    setShowCreate(false); setEditPlot(null);
    toast.success(editPlot ? "Parcelle mise à jour" : "Parcelle créée");
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Supprimer cette parcelle ?")) return;
    try {
      await api.delete(`/plots/${id}`);
      setPlots(prev => prev.filter(p => p.id !== id));
      toast.success("Parcelle supprimée");
    } catch (err) { toast.error(formatError(err.response?.data?.detail)); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-medium text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>Parcelles</h1>
          <p className="text-sm text-muted-foreground">Gérez vos parcelles agricoles</p>
        </div>
        <div className="flex gap-3">
          {farms.length > 0 && (
            <select value={selectedFarm} onChange={(e) => setSelectedFarm(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm">
              <option value="all">Toutes les exploitations</option>
              {farms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          )}
          {farms.length > 0 && (
            <Button data-testid={PLOTS.createButton} onClick={() => setShowCreate(true)} className="gap-2">
              <Plus size={16} /> Nouvelle parcelle
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <Card key={i}><CardContent className="p-5"><Skeleton className="h-24" /></CardContent></Card>)}
        </div>
      ) : farms.length === 0 ? (
        <Card className="border-dashed"><CardContent className="py-16 text-center">
          <Leaf size={40} className="text-muted-foreground mx-auto mb-3" />
          <p className="font-medium text-foreground mb-2">Aucune exploitation</p>
          <p className="text-sm text-muted-foreground">Créez d'abord une exploitation.</p>
        </CardContent></Card>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed"><CardContent className="py-16 text-center">
          <MapPin size={40} className="text-muted-foreground mx-auto mb-3" />
          <p className="font-medium text-foreground mb-2">Aucune parcelle</p>
          <p className="text-sm text-muted-foreground mb-4">Ajoutez votre première parcelle.</p>
          <Button onClick={() => setShowCreate(true)} size="sm" className="gap-2"><Plus size={14} /> Créer</Button>
        </CardContent></Card>
      ) : (
        <div data-testid={PLOTS.list} className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((plot) => {
            const farm = farms.find(f => f.id === plot.farm_id);
            return (
              <Card key={plot.id} className="hover:-translate-y-0.5 transition-transform duration-150">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base font-semibold" style={{ fontFamily: "Outfit, sans-serif" }}>
                        {plot.name}
                      </CardTitle>
                      {farm && <p className="text-xs text-muted-foreground mt-0.5">{farm.name}</p>}
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge variant="outline" className={cn("text-xs", STATUS_COLORS[plot.status])}>
                        {STATUS_LABELS[plot.status] || plot.status}
                      </Badge>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditPlot(plot)}>
                        <Pencil size={11} />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(plot.id)}>
                        <Trash2 size={11} />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2.5">
                  <div className="flex flex-wrap gap-2">
                    {plot.crop_type && (
                      <Badge variant="secondary" className="text-xs gap-1"><Leaf size={10} />{plot.crop_type}</Badge>
                    )}
                    {plot.area && <Badge variant="secondary" className="text-xs">{plot.area} ha</Badge>}
                  </div>
                  {plot.location && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MapPin size={11} /><span>{plot.location}</span>
                    </div>
                  )}
                  {plot.sowing_date && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Calendar size={11} /><span>Semis: {new Date(plot.sowing_date).toLocaleDateString("fr-FR")}</span>
                    </div>
                  )}
                  {plot.notes && <p className="text-xs text-muted-foreground line-clamp-2">{plot.notes}</p>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle style={{ fontFamily: "Outfit, sans-serif" }}>Nouvelle parcelle</DialogTitle></DialogHeader>
          <PlotForm farms={farms} onSave={handleSave} onCancel={() => setShowCreate(false)} />
        </DialogContent>
      </Dialog>
      <Dialog open={!!editPlot} onOpenChange={(o) => !o && setEditPlot(null)}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle style={{ fontFamily: "Outfit, sans-serif" }}>Modifier la parcelle</DialogTitle></DialogHeader>
          {editPlot && <PlotForm farms={farms} initial={editPlot} onSave={handleSave} onCancel={() => setEditPlot(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
