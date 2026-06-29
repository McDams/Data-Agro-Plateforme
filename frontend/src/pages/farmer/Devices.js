import { useState, useEffect } from "react";
import api, { formatError } from "@/utils/api";
import { Plus, Pencil, Trash2, Cpu, Wifi, WifiOff, Battery, AlertTriangle, Send } from "lucide-react";
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
import { DEVICES } from "@/constants/testIds";

const DEVICE_TYPES = ["Station météo", "Sonde sol multi-paramètres", "Capteur humidité sol",
  "Capteur NPK", "Pluviomètre connecté", "Autre"];

const SENSOR_OPTIONS = [
  { id: "soil_moisture", label: "Humidité sol" },
  { id: "soil_temperature", label: "Température sol" },
  { id: "air_temperature", label: "Température air" },
  { id: "air_humidity", label: "Humidité air" },
  { id: "luminosity", label: "Luminosité" },
  { id: "soil_nitrogen", label: "Azote (N)" },
  { id: "soil_phosphorus", label: "Phosphore (P)" },
  { id: "soil_potassium", label: "Potassium (K)" },
  { id: "ph", label: "pH" },
  { id: "conductivity", label: "Conductivité" },
];

function DeviceForm({ farms, plots, initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial || {
    farm_id: farms[0]?.id || "", plot_id: "", name: "", device_uid: "",
    device_type: "Station météo", sensor_types: ["soil_moisture", "air_temperature"],
    firmware_version: "1.0.0", maintenance_notes: ""
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const farmPlots = plots.filter(p => p.farm_id === form.farm_id);
  const toggleSensor = (s) => setForm(f => ({
    ...f, sensor_types: f.sensor_types.includes(s) ? f.sensor_types.filter(x => x !== s) : [...f.sensor_types, s]
  }));

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      const payload = { farm_id: form.farm_id, name: form.name, device_uid: form.device_uid,
        device_type: form.device_type, sensor_types: form.sensor_types,
        plot_id: form.plot_id || null, firmware_version: form.firmware_version || "1.0.0",
        maintenance_notes: form.maintenance_notes || null };
      let data;
      if (initial?.id) { ({ data } = await api.put(`/devices/${initial.id}`, payload)); }
      else { ({ data } = await api.post("/devices", payload)); }
      onSave(data);
    } catch (err) { setError(formatError(err.response?.data?.detail)); }
    finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Exploitation *</Label>
          <select value={form.farm_id} onChange={set("farm_id")} required
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
            {farms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>Parcelle</Label>
          <select value={form.plot_id} onChange={set("plot_id")}
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
            <option value="">Sans parcelle</option>
            {farmPlots.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Nom de l'appareil *</Label>
        <Input data-testid="device-form-name" value={form.name} onChange={set("name")} required placeholder="ex: Sonde Nord-1" />
      </div>
      <div className="space-y-1.5">
        <Label>Identifiant unique *</Label>
        <Input data-testid="device-form-uid" value={form.device_uid} onChange={set("device_uid")} required placeholder="ex: AF-2024-001" />
      </div>
      <div className="space-y-1.5">
        <Label>Type d'appareil</Label>
        <select value={form.device_type} onChange={set("device_type")}
          className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
          {DEVICE_TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
      </div>
      <div className="space-y-2">
        <Label>Capteurs disponibles</Label>
        <div className="grid grid-cols-2 gap-2">
          {SENSOR_OPTIONS.map(s => (
            <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.sensor_types.includes(s.id)} onChange={() => toggleSensor(s.id)}
                className="rounded border-border" />
              {s.label}
            </label>
          ))}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Version firmware</Label>
        <Input value={form.firmware_version} onChange={set("firmware_version")} placeholder="1.0.0" />
      </div>
      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">Annuler</Button>
        <Button data-testid="device-form-submit" type="submit" className="flex-1" disabled={loading}>
          {loading ? "Enregistrement..." : initial?.id ? "Mettre à jour" : "Ajouter"}
        </Button>
      </div>
    </form>
  );
}

function SimulateReadingDialog({ device, plot_id, onClose }) {
  const [form, setForm] = useState({
    soil_moisture: "55", soil_temperature: "18", air_temperature: "22", air_humidity: "65",
    soil_nitrogen: "38", soil_phosphorus: "18", soil_potassium: "28", ph: "6.8", luminosity: "15000"
  });
  const [loading, setLoading] = useState(false);
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!plot_id) { toast.error("Associez d'abord cet appareil à une parcelle"); return; }
    setLoading(true);
    try {
      const payload = { device_id: device.id, plot_id };
      Object.entries(form).forEach(([k, v]) => { if (v) payload[k] = parseFloat(v); });
      await api.post("/readings", payload);
      toast.success("Lecture simulée ajoutée");
      onClose();
    } catch (err) { toast.error(formatError(err.response?.data?.detail)); }
    finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Simulez une lecture capteur pour <strong>{device.name}</strong>
      </p>
      <div className="grid grid-cols-2 gap-3">
        {[
          { k: "soil_moisture", l: "Humidité sol (%)" }, { k: "air_temperature", l: "Temp. air (°C)" },
          { k: "soil_temperature", l: "Temp. sol (°C)" }, { k: "air_humidity", l: "Humidité air (%)" },
          { k: "soil_nitrogen", l: "Azote N (mg/kg)" }, { k: "soil_phosphorus", l: "Phosphore P (mg/kg)" },
          { k: "soil_potassium", l: "Potassium K (mg/kg)" }, { k: "ph", l: "pH" },
        ].map(({ k, l }) => (
          <div key={k} className="space-y-1">
            <Label className="text-xs">{l}</Label>
            <Input type="number" step="0.1" value={form[k]} onChange={set(k)} className="h-8 text-sm" />
          </div>
        ))}
      </div>
      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={onClose} className="flex-1">Annuler</Button>
        <Button type="submit" className="flex-1 gap-2" disabled={loading}>
          <Send size={14} /> {loading ? "Envoi..." : "Simuler"}
        </Button>
      </div>
    </form>
  );
}

export default function Devices() {
  const [farms, setFarms] = useState([]);
  const [plots, setPlots] = useState([]);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editDevice, setEditDevice] = useState(null);
  const [simulateDevice, setSimulateDevice] = useState(null);

  const load = () => {
    Promise.all([
      api.get("/farms").then(r => r.data),
      api.get("/plots").then(r => r.data),
      api.get("/devices").then(r => r.data),
    ]).then(([f, p, d]) => { setFarms(f); setPlots(p); setDevices(d); })
      .catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleSave = (device) => {
    setDevices(prev => {
      const idx = prev.findIndex(d => d.id === device.id);
      if (idx >= 0) { const n = [...prev]; n[idx] = device; return n; }
      return [...prev, device];
    });
    setShowCreate(false); setEditDevice(null);
    toast.success(editDevice ? "Appareil mis à jour" : "Appareil ajouté");
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Supprimer cet appareil ?")) return;
    try {
      await api.delete(`/devices/${id}`);
      setDevices(prev => prev.filter(d => d.id !== id));
      toast.success("Appareil supprimé");
    } catch (err) { toast.error(formatError(err.response?.data?.detail)); }
  };

  const statusBadge = (status) => ({
    online: "border-green-500/30 text-green-600 bg-green-50 dark:bg-green-900/20",
    warning: "border-amber-500/30 text-amber-600 bg-amber-50 dark:bg-amber-900/20",
    offline: "border-border text-muted-foreground",
  }[status] || "border-border text-muted-foreground");

  const statusIcon = (status) => status === "online" ? <Wifi size={12} /> :
    status === "warning" ? <AlertTriangle size={12} /> : <WifiOff size={12} />;

  const statusLabel = (status) => status === "online" ? "En ligne" :
    status === "warning" ? "Avertissement" : "Hors ligne";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-medium text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>Appareils</h1>
          <p className="text-sm text-muted-foreground">Gérez vos capteurs IoT connectés</p>
        </div>
        {farms.length > 0 && (
          <Button data-testid={DEVICES.createButton} onClick={() => setShowCreate(true)} className="gap-2">
            <Plus size={16} /> Ajouter un appareil
          </Button>
        )}
      </div>

      {loading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <Card key={i}><CardContent className="p-5"><Skeleton className="h-32" /></CardContent></Card>)}
        </div>
      ) : farms.length === 0 ? (
        <Card className="border-dashed"><CardContent className="py-16 text-center">
          <Cpu size={40} className="text-muted-foreground mx-auto mb-3" />
          <p className="font-medium text-foreground mb-2">Aucune exploitation</p>
          <p className="text-sm text-muted-foreground">Créez d'abord une exploitation.</p>
        </CardContent></Card>
      ) : devices.length === 0 ? (
        <Card className="border-dashed"><CardContent className="py-16 text-center">
          <Cpu size={40} className="text-muted-foreground mx-auto mb-3" />
          <p className="font-medium text-foreground mb-2">Aucun appareil</p>
          <p className="text-sm text-muted-foreground mb-4">Ajoutez votre premier capteur.</p>
          <Button onClick={() => setShowCreate(true)} size="sm" className="gap-2"><Plus size={14} />Ajouter</Button>
        </CardContent></Card>
      ) : (
        <div data-testid={DEVICES.list} className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {devices.map((d) => {
            const plot = plots.find(p => p.id === d.plot_id);
            const farm = farms.find(f => f.id === d.farm_id);
            return (
              <Card key={d.id} data-testid={DEVICES.deviceCard}
                className="hover:-translate-y-0.5 transition-transform duration-150">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base font-semibold line-clamp-1" style={{ fontFamily: "Outfit, sans-serif" }}>
                        {d.name}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">{d.device_uid}</p>
                    </div>
                    <Badge variant="outline" className={cn("text-xs gap-1", statusBadge(d.status))}>
                      {statusIcon(d.status)} {statusLabel(d.status)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="secondary" className="text-xs">{d.device_type}</Badge>
                    {plot && <Badge variant="outline" className="text-xs">{plot.name}</Badge>}
                    {farm && !plot && <Badge variant="outline" className="text-xs">{farm.name}</Badge>}
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Battery size={12} />
                      <span className={cn(d.battery_level > 50 ? "text-primary" : d.battery_level > 20 ? "text-amber-500" : "text-destructive")}>
                        {d.battery_level ?? "—"}%
                      </span>
                    </div>
                    {d.firmware_version && <span>v{d.firmware_version}</span>}
                    {d.last_sync && (
                      <span>Sync: {new Date(d.last_sync).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
                    )}
                  </div>
                  {d.sensor_types?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {d.sensor_types.slice(0, 3).map(s => (
                        <span key={s} className="text-xs bg-muted rounded px-1.5 py-0.5">{s.replace(/_/g, " ")}</span>
                      ))}
                      {d.sensor_types.length > 3 && (
                        <span className="text-xs bg-muted rounded px-1.5 py-0.5">+{d.sensor_types.length - 3}</span>
                      )}
                    </div>
                  )}
                  <div className="flex gap-1.5 pt-1 border-t border-border">
                    <Button size="sm" variant="outline" className="flex-1 h-7 text-xs gap-1"
                      onClick={() => setSimulateDevice(d)} data-testid="device-simulate-button">
                      <Send size={11} /> Simuler
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
                      onClick={() => setEditDevice(d)} data-testid="device-edit-button">
                      <Pencil size={12} />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(d.id)} data-testid="device-delete-button">
                      <Trash2 size={12} />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle style={{ fontFamily: "Outfit, sans-serif" }}>Ajouter un appareil</DialogTitle></DialogHeader>
          <DeviceForm farms={farms} plots={plots} onSave={handleSave} onCancel={() => setShowCreate(false)} />
        </DialogContent>
      </Dialog>

      {/* Edit */}
      <Dialog open={!!editDevice} onOpenChange={(o) => !o && setEditDevice(null)}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle style={{ fontFamily: "Outfit, sans-serif" }}>Modifier l'appareil</DialogTitle></DialogHeader>
          {editDevice && <DeviceForm farms={farms} plots={plots} initial={editDevice} onSave={handleSave} onCancel={() => setEditDevice(null)} />}
        </DialogContent>
      </Dialog>

      {/* Simulate */}
      <Dialog open={!!simulateDevice} onOpenChange={(o) => !o && setSimulateDevice(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle style={{ fontFamily: "Outfit, sans-serif" }}>Simuler une lecture capteur</DialogTitle></DialogHeader>
          {simulateDevice && (
            <SimulateReadingDialog
              device={simulateDevice}
              plot_id={simulateDevice.plot_id}
              onClose={() => setSimulateDevice(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
