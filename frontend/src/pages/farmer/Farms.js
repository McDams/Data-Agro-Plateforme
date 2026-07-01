import { useState, useEffect } from "react";
import api, { formatError } from "@/utils/api";
import { Plus, Pencil, Trash2, MapPin, Wheat, ArrowRight, Radio, Copy, Check, RefreshCw } from "lucide-react";
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

function GatewayKeyDialog({ farm, open, onOpenChange, onKeyGenerated }) {
  const [loading, setLoading] = useState(false);
  const [newKey, setNewKey] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => { if (!open) { setNewKey(null); setCopied(false); } }, [open]);

  const generate = async () => {
    setLoading(true);
    try {
      const { data } = await api.post(`/farms/${farm.id}/gateway-key`);
      setNewKey(data.gateway_key);
      onKeyGenerated(farm.id, { has_gateway_key: true, gateway_key_prefix: data.gateway_key.slice(0, 11) });
    } catch (err) { toast.error(formatError(err.response?.data?.detail)); }
    finally { setLoading(false); }
  };

  const copy = async () => {
    await navigator.clipboard.writeText(newKey);
    setCopied(true);
    toast.success("Clé copiée");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: "Outfit, sans-serif" }}>Passerelle IoT — {farm?.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Cette clé authentifie votre passerelle Raspberry Pi (nœuds ESP32 + LoRa) auprès de l'API
            pour l'envoi périodique des relevés capteurs (<code>POST /api/ingest/batch</code>,
            en-tête <code>X-Gateway-Key</code>).
          </p>

          {newKey ? (
            <>
              <Alert>
                <AlertDescription className="text-xs">
                  Notez cette clé maintenant : elle ne sera <strong>plus jamais affichée</strong> en clair.
                  Configurez-la sur votre Raspberry Pi (ex: variable d'environnement <code>GATEWAY_KEY</code>).
                </AlertDescription>
              </Alert>
              <div className="flex items-center gap-2">
                <Input readOnly value={newKey} className="font-mono text-xs" />
                <Button type="button" size="icon" variant="outline" onClick={copy}>
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                </Button>
              </div>
            </>
          ) : farm?.has_gateway_key ? (
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <div className="flex items-center gap-2 text-sm">
                <Radio size={14} className="text-green-600" />
                Configurée — <code className="text-xs">{farm.gateway_key_prefix}…</code>
              </div>
              <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={generate} disabled={loading}>
                <RefreshCw size={13} /> Régénérer
              </Button>
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-border p-4 text-center">
              <p className="text-sm text-muted-foreground mb-3">Aucune clé configurée pour cette exploitation.</p>
              <Button type="button" size="sm" className="gap-2" onClick={generate} disabled={loading}>
                <Radio size={14} /> {loading ? "Génération..." : "Générer une clé de passerelle"}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

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
  const [gatewayFarm, setGatewayFarm] = useState(null);

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

  const handleGatewayKeyGenerated = (farmId, patch) => {
    setFarms((prev) => prev.map(f => f.id === farmId ? { ...f, ...patch } : f));
    setGatewayFarm((prev) => prev && prev.id === farmId ? { ...prev, ...patch } : prev);
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
                  <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs"
                    onClick={() => setGatewayFarm(farm)} data-testid="farm-gateway-button">
                    <Radio size={12} className={farm.has_gateway_key ? "text-green-600" : ""} />
                    Passerelle IoT
                  </Button>
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

      {/* Gateway Key Dialog */}
      <GatewayKeyDialog farm={gatewayFarm} open={!!gatewayFarm}
        onOpenChange={(o) => !o && setGatewayFarm(null)} onKeyGenerated={handleGatewayKeyGenerated} />
    </div>
  );
}
