import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import api, { formatError } from "@/utils/api";
import { Sprout, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AUTH } from "@/constants/testIds";

const COUNTRIES = ["France", "Maroc", "Algérie", "Tunisie", "Sénégal", "Côte d'Ivoire", "Belgique", "Suisse", "Canada", "Autre"];

export default function Register() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    first_name: "", last_name: "", email: "", phone: "",
    farm_name: "", country: "France", password: "", confirm_password: "",
  });
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (form.password !== form.confirm_password) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    if (form.password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    setLoading(true);
    try {
      const payload = { ...form };
      delete payload.confirm_password;
      const { data } = await api.post("/auth/register", payload);
      login(data);
      navigate("/onboarding");
    } catch (err) {
      setError(formatError(err.response?.data?.detail) || "Erreur lors de la création du compte");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <Sprout size={20} className="text-primary-foreground" />
            </div>
            <span className="font-semibold text-xl text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>
              AgriFlow
            </span>
          </Link>
          <h1 className="text-2xl font-medium text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>
            Créer un compte
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Rejoignez la plateforme en quelques minutes
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <form data-testid={AUTH.registerForm} onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="first_name">Prénom *</Label>
                <Input id="first_name" data-testid="register-first-name"
                  value={form.first_name} onChange={set("first_name")} required placeholder="Jean" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="last_name">Nom *</Label>
                <Input id="last_name" data-testid="register-last-name"
                  value={form.last_name} onChange={set("last_name")} required placeholder="Dupont" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email *</Label>
              <Input id="email" data-testid="register-email" type="email"
                value={form.email} onChange={set("email")} required placeholder="vous@exploitation.fr" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Téléphone</Label>
              <Input id="phone" data-testid="register-phone" type="tel"
                value={form.phone} onChange={set("phone")} placeholder="+33 6 00 00 00 00" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="farm_name">Nom de l'exploitation</Label>
              <Input id="farm_name" data-testid="register-farm-name"
                value={form.farm_name} onChange={set("farm_name")} placeholder="Ferme du Soleil" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="country">Pays</Label>
              <select id="country" data-testid="register-country"
                value={form.country} onChange={set("country")}
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm">
                {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Mot de passe *</Label>
              <div className="relative">
                <Input id="password" data-testid="register-password"
                  type={showPwd ? "text" : "password"}
                  value={form.password} onChange={set("password")} required
                  placeholder="8 caractères minimum" className="pr-10" />
                <button type="button" onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm_password">Confirmer le mot de passe *</Label>
              <Input id="confirm_password" data-testid="register-confirm-password"
                type="password" value={form.confirm_password} onChange={set("confirm_password")}
                required placeholder="••••••••" />
            </div>
            <Button data-testid={AUTH.registerSubmit} type="submit" className="w-full" disabled={loading}>
              {loading ? "Création..." : "Créer mon compte"}
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Déjà un compte ?{" "}
          <Link to="/connexion" className="text-primary font-medium hover:underline">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}
