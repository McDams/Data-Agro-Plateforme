import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import api, { formatError } from "@/utils/api";
import { User, Lock, Bell, Palette, Save, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

const TABS = [
  { id: "profile", icon: User, label: "Mon profil" },
  { id: "password", icon: Lock, label: "Mot de passe" },
  { id: "appearance", icon: Palette, label: "Apparence" },
];

export default function Profile() {
  const { user, updateUser } = useAuth();
  const { theme, toggle } = useTheme();
  const [activeTab, setActiveTab] = useState("profile");
  const [profileForm, setProfileForm] = useState({
    first_name: user?.first_name || "", last_name: user?.last_name || "",
    phone: user?.phone || "", farm_name: user?.farm_name || "", country: user?.country || "",
  });
  const [pwdForm, setPwdForm] = useState({ current_password: "", new_password: "", confirm: "" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const setP = (k) => (e) => setProfileForm(f => ({ ...f, [k]: e.target.value }));
  const setPwd = (k) => (e) => setPwdForm(f => ({ ...f, [k]: e.target.value }));

  const saveProfile = async (e) => {
    e.preventDefault(); setError(""); setSuccess(""); setLoading(true);
    try {
      const { data } = await api.put("/profile", {
        first_name: profileForm.first_name, last_name: profileForm.last_name,
        phone: profileForm.phone || null, farm_name: profileForm.farm_name || null,
        country: profileForm.country || null,
      });
      updateUser(data);
      setSuccess("Profil mis à jour avec succès");
      toast.success("Profil mis à jour");
    } catch (err) { setError(formatError(err.response?.data?.detail)); }
    finally { setLoading(false); }
  };

  const savePassword = async (e) => {
    e.preventDefault(); setError(""); setSuccess("");
    if (pwdForm.new_password !== pwdForm.confirm) { setError("Les mots de passe ne correspondent pas."); return; }
    if (pwdForm.new_password.length < 8) { setError("Minimum 8 caractères."); return; }
    setLoading(true);
    try {
      await api.put("/profile/password", {
        current_password: pwdForm.current_password, new_password: pwdForm.new_password,
      });
      setPwdForm({ current_password: "", new_password: "", confirm: "" });
      setSuccess("Mot de passe modifié");
      toast.success("Mot de passe modifié");
    } catch (err) { setError(formatError(err.response?.data?.detail)); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-medium text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>Paramètres</h1>
        <p className="text-sm text-muted-foreground">Gérez votre compte et vos préférences</p>
      </div>

      {/* User header */}
      <Card>
        <CardContent className="p-5 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center">
            <span className="text-lg font-semibold text-primary">
              {user?.first_name?.[0]}{user?.last_name?.[0]}
            </span>
          </div>
          <div>
            <p className="font-semibold text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>
              {user?.first_name} {user?.last_name}
            </p>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
            {user?.farm_name && (
              <p className="text-xs text-primary mt-0.5">{user.farm_name}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tab navigation */}
      <div className="flex gap-1 border-b border-border">
        {TABS.map((tab) => (
          <button key={tab.id} onClick={() => { setActiveTab(tab.id); setError(""); setSuccess(""); }}
            data-testid={`settings-tab-${tab.id}`}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            <tab.icon size={14} /> {tab.label}
          </button>
        ))}
      </div>

      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      {success && (
        <Alert className="border-primary/30 bg-primary/5 text-primary">
          <Check size={14} />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {/* Profile tab */}
      {activeTab === "profile" && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Informations personnelles</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={saveProfile} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Prénom</Label>
                  <Input data-testid="profile-first-name" value={profileForm.first_name} onChange={setP("first_name")} />
                </div>
                <div className="space-y-1.5">
                  <Label>Nom</Label>
                  <Input data-testid="profile-last-name" value={profileForm.last_name} onChange={setP("last_name")} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input value={user?.email} disabled className="opacity-60" />
              </div>
              <div className="space-y-1.5">
                <Label>Téléphone</Label>
                <Input data-testid="profile-phone" value={profileForm.phone} onChange={setP("phone")} placeholder="+33 6 00 00 00 00" />
              </div>
              <div className="space-y-1.5">
                <Label>Nom de l'exploitation</Label>
                <Input data-testid="profile-farm-name" value={profileForm.farm_name} onChange={setP("farm_name")} />
              </div>
              <div className="space-y-1.5">
                <Label>Pays</Label>
                <Input data-testid="profile-country" value={profileForm.country} onChange={setP("country")} />
              </div>
              <Button data-testid="profile-save" type="submit" className="gap-2" disabled={loading}>
                <Save size={14} /> {loading ? "Enregistrement..." : "Enregistrer"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Password tab */}
      {activeTab === "password" && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Changer le mot de passe</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={savePassword} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Mot de passe actuel</Label>
                <Input data-testid="current-password" type="password" value={pwdForm.current_password}
                  onChange={setPwd("current_password")} required />
              </div>
              <div className="space-y-1.5">
                <Label>Nouveau mot de passe</Label>
                <Input data-testid="new-password" type="password" value={pwdForm.new_password}
                  onChange={setPwd("new_password")} required placeholder="8 caractères minimum" />
              </div>
              <div className="space-y-1.5">
                <Label>Confirmer le nouveau mot de passe</Label>
                <Input data-testid="confirm-password" type="password" value={pwdForm.confirm}
                  onChange={setPwd("confirm")} required />
              </div>
              <Button data-testid="save-password" type="submit" className="gap-2" disabled={loading}>
                <Lock size={14} /> {loading ? "Modification..." : "Modifier le mot de passe"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Appearance tab */}
      {activeTab === "appearance" && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Apparence</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-foreground">Mode sombre</p>
                <p className="text-xs text-muted-foreground">Basculer entre mode clair et sombre</p>
              </div>
              <Switch checked={theme === "dark"} onCheckedChange={toggle} data-testid="theme-toggle" />
            </div>
            <div className="p-4 rounded-lg bg-muted/50 border border-border">
              <p className="text-xs text-muted-foreground">
                Thème actuel : <span className="font-medium text-foreground">
                  {theme === "dark" ? "Mode sombre" : "Mode clair"}
                </span>
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
