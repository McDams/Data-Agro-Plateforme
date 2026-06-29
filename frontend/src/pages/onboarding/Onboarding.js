import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import api, { formatError } from "@/utils/api";
import { Sprout, Tractor, Map, Cpu, Link2, CheckCircle, ArrowRight, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

const STEPS = [
  { id: 1, icon: Tractor, title: "Créer une exploitation", desc: "Enregistrez votre première exploitation agricole." },
  { id: 2, icon: Map, title: "Ajouter une parcelle", desc: "Définissez une parcelle dans votre exploitation." },
  { id: 3, icon: Cpu, title: "Ajouter un appareil", desc: "Enregistrez votre premier capteur connecté." },
  { id: 4, icon: Link2, title: "Associer l'appareil", desc: "Liez l'appareil à votre parcelle." },
];

const DEVICE_TYPES = [
  "Station météo", "Sonde sol multi-paramètres", "Capteur humidité sol",
  "Capteur NPK", "Pluviomètre connecté", "Autre"
];

const CROP_TYPES = [
  "Blé", "Maïs", "Tournesol", "Colza", "Betterave", "Pomme de terre",
  "Vigne", "Arboriculture", "Maraîchage", "Légumineuses", "Autre"
];

export default function Onboarding() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [createdFarm, setCreatedFarm] = useState(null);
  const [createdPlot, setCreatedPlot] = useState(null);
  const [createdDevice, setCreatedDevice] = useState(null);

  const [farmForm, setFarmForm] = useState({ name: user?.farm_name || "", location: "", description: "", total_area: "" });
  const [plotForm, setPlotForm] = useState({ name: "", crop_type: "Blé", area: "", location: "", notes: "" });
  const [deviceForm, setDeviceForm] = useState({
    name: "", device_uid: "", device_type: "Station météo",
    sensor_types: ["soil_moisture", "air_temperature", "air_humidity"],
    firmware_version: "1.0.0"
  });

  const setF = (s) => (k) => (e) => s((f) => ({ ...f, [k]: e.target.value }));

  const handleFarm = async (e) => {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      const { data } = await api.post("/farms", {
        name: farmForm.name, location: farmForm.location,
        description: farmForm.description || null,
        total_area: farmForm.total_area ? parseFloat(farmForm.total_area) : null,
      });
      setCreatedFarm(data);
      setStep(2);
    } catch (err) { setError(formatError(err.response?.data?.detail)); }
    finally { setLoading(false); }
  };

  const handlePlot = async (e) => {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      const { data } = await api.post("/plots", {
        farm_id: createdFarm.id, name: plotForm.name, crop_type: plotForm.crop_type,
        area: plotForm.area ? parseFloat(plotForm.area) : null,
        location: plotForm.location || null, notes: plotForm.notes || null,
      });
      setCreatedPlot(data);
      setStep(3);
    } catch (err) { setError(formatError(err.response?.data?.detail)); }
    finally { setLoading(false); }
  };

  const handleDevice = async (e) => {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      const { data } = await api.post("/devices", {
        farm_id: createdFarm.id, name: deviceForm.name,
        device_uid: deviceForm.device_uid, device_type: deviceForm.device_type,
        sensor_types: deviceForm.sensor_types, firmware_version: deviceForm.firmware_version,
      });
      setCreatedDevice(data);
      setStep(4);
    } catch (err) { setError(formatError(err.response?.data?.detail)); }
    finally { setLoading(false); }
  };

  const handleAssociate = async () => {
    setError(""); setLoading(true);
    try {
      await api.put(`/devices/${createdDevice.id}`, { plot_id: createdPlot.id });
      await api.post("/onboarding/complete");
      updateUser({ onboarding_completed: true });
      navigate("/tableau-de-bord");
    } catch (err) { setError(formatError(err.response?.data?.detail)); }
    finally { setLoading(false); }
  };

  const skip = async () => {
    await api.post("/onboarding/complete");
    updateUser({ onboarding_completed: true });
    navigate("/tableau-de-bord");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Sprout size={16} className="text-primary-foreground" />
            </div>
            <span className="font-semibold text-lg" style={{ fontFamily: "Outfit, sans-serif" }}>AgriFlow</span>
          </div>
          <h1 className="text-2xl font-medium text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>
            Bienvenue, {user?.first_name} !
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configurez votre exploitation en 4 étapes rapides
          </p>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center flex-1">
              <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 transition-colors",
                step > s.id ? "bg-primary text-primary-foreground"
                  : step === s.id ? "bg-primary/20 text-primary border-2 border-primary"
                  : "bg-muted text-muted-foreground")}>
                {step > s.id ? <CheckCircle size={16} /> : s.id}
              </div>
              {i < STEPS.length - 1 && (
                <div className={cn("flex-1 h-0.5 mx-1", step > s.id ? "bg-primary" : "bg-border")} />
              )}
            </div>
          ))}
        </div>

        {/* Step card */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Step title */}
          {STEPS.filter(s => s.id === step).map((s) => (
            <div key={s.id} className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <s.icon size={20} className="text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-semibold uppercase tracking-widest">Étape {s.id}/4</p>
                <h2 className="font-semibold text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>{s.title}</h2>
              </div>
            </div>
          ))}

          {/* Step 1: Farm */}
          {step === 1 && (
            <form onSubmit={handleFarm} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Nom de l'exploitation *</Label>
                <Input data-testid="onboarding-farm-name" value={farmForm.name}
                  onChange={setF(setFarmForm)("name")} required placeholder="ex: Ferme des Chênes" />
              </div>
              <div className="space-y-1.5">
                <Label>Localisation *</Label>
                <Input data-testid="onboarding-farm-location" value={farmForm.location}
                  onChange={setF(setFarmForm)("location")} required placeholder="ex: Beauce, France" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Surface totale (ha)</Label>
                  <Input data-testid="onboarding-farm-area" type="number" value={farmForm.total_area}
                    onChange={setF(setFarmForm)("total_area")} placeholder="ex: 45" />
                </div>
                <div className="space-y-1.5">
                  <Label>Description</Label>
                  <Input value={farmForm.description}
                    onChange={setF(setFarmForm)("description")} placeholder="Optionnel" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <Button data-testid="onboarding-farm-submit" type="submit" className="flex-1" disabled={loading}>
                  {loading ? "Création..." : "Créer l'exploitation"} <ArrowRight size={16} className="ml-1" />
                </Button>
                <Button type="button" variant="ghost" onClick={skip} className="text-xs text-muted-foreground">
                  Passer
                </Button>
              </div>
            </form>
          )}

          {/* Step 2: Plot */}
          {step === 2 && (
            <form onSubmit={handlePlot} className="space-y-4">
              <div className="p-3 bg-primary/5 rounded-lg text-sm text-primary">
                Exploitation : <strong>{createdFarm?.name}</strong>
              </div>
              <div className="space-y-1.5">
                <Label>Nom de la parcelle *</Label>
                <Input data-testid="onboarding-plot-name" value={plotForm.name}
                  onChange={setF(setPlotForm)("name")} required placeholder="ex: Parcelle Nord B2" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Type de culture</Label>
                  <select value={plotForm.crop_type} onChange={setF(setPlotForm)("crop_type")}
                    data-testid="onboarding-plot-crop"
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
                    {CROP_TYPES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Surface (ha)</Label>
                  <Input type="number" value={plotForm.area} onChange={setF(setPlotForm)("area")} placeholder="ex: 5.2" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Localisation GPS</Label>
                <Input value={plotForm.location} onChange={setF(setPlotForm)("location")} placeholder="ex: 48.8566, 2.3522" />
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setStep(1)} size="icon">
                  <ArrowLeft size={16} />
                </Button>
                <Button data-testid="onboarding-plot-submit" type="submit" className="flex-1" disabled={loading}>
                  {loading ? "Création..." : "Créer la parcelle"} <ArrowRight size={16} className="ml-1" />
                </Button>
              </div>
            </form>
          )}

          {/* Step 3: Device */}
          {step === 3 && (
            <form onSubmit={handleDevice} className="space-y-4">
              <div className="p-3 bg-primary/5 rounded-lg text-sm text-primary">
                Parcelle : <strong>{createdPlot?.name}</strong>
              </div>
              <div className="space-y-1.5">
                <Label>Nom de l'appareil *</Label>
                <Input data-testid="onboarding-device-name" value={deviceForm.name}
                  onChange={setF(setDeviceForm)("name")} required placeholder="ex: Sonde Nord-1" />
              </div>
              <div className="space-y-1.5">
                <Label>Identifiant unique *</Label>
                <Input data-testid="onboarding-device-uid" value={deviceForm.device_uid}
                  onChange={setF(setDeviceForm)("device_uid")} required placeholder="ex: AF-2024-001" />
              </div>
              <div className="space-y-1.5">
                <Label>Type d'appareil</Label>
                <select value={deviceForm.device_type}
                  onChange={setF(setDeviceForm)("device_type")} data-testid="onboarding-device-type"
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
                  {DEVICE_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setStep(2)} size="icon">
                  <ArrowLeft size={16} />
                </Button>
                <Button data-testid="onboarding-device-submit" type="submit" className="flex-1" disabled={loading}>
                  {loading ? "Création..." : "Ajouter l'appareil"} <ArrowRight size={16} className="ml-1" />
                </Button>
              </div>
            </form>
          )}

          {/* Step 4: Associate */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="p-4 bg-primary/5 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Appareil</span>
                  <span className="font-medium text-foreground">{createdDevice?.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Parcelle</span>
                  <span className="font-medium text-foreground">{createdPlot?.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Exploitation</span>
                  <span className="font-medium text-foreground">{createdFarm?.name}</span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                En associant cet appareil à la parcelle, vous pourrez commencer à recevoir des données de terrain.
              </p>
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setStep(3)} size="icon">
                  <ArrowLeft size={16} />
                </Button>
                <Button data-testid="onboarding-associate-submit" onClick={handleAssociate}
                  className="flex-1" disabled={loading}>
                  {loading ? "Association..." : "Associer et accéder au tableau de bord"}
                  <ArrowRight size={16} className="ml-1" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
