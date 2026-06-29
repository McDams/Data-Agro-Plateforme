import { useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import api, { formatError } from "@/utils/api";
import { Sprout, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirm) { setError("Les mots de passe ne correspondent pas."); return; }
    if (password.length < 8) { setError("Minimum 8 caractères."); return; }
    setLoading(true);
    try {
      await api.post("/auth/reset-password", { token, new_password: password });
      setSuccess(true);
      setTimeout(() => navigate("/connexion"), 2000);
    } catch (err) {
      setError(formatError(err.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <Sprout size={20} className="text-primary-foreground" />
            </div>
            <span className="font-semibold text-xl" style={{ fontFamily: "Outfit, sans-serif" }}>AgriFlow</span>
          </Link>
          <h1 className="text-2xl font-medium text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>
            Nouveau mot de passe
          </h1>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          {success ? (
            <div className="text-center py-4 space-y-3">
              <CheckCircle size={40} className="text-primary mx-auto" />
              <p className="text-sm font-medium text-foreground">Mot de passe réinitialisé !</p>
              <p className="text-xs text-muted-foreground">Redirection vers la connexion...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
              <div className="space-y-1.5">
                <Label>Nouveau mot de passe</Label>
                <Input data-testid="reset-password" type="password" value={password}
                  onChange={(e) => setPassword(e.target.value)} required placeholder="8 caractères minimum" />
              </div>
              <div className="space-y-1.5">
                <Label>Confirmer le mot de passe</Label>
                <Input data-testid="reset-confirm" type="password" value={confirm}
                  onChange={(e) => setConfirm(e.target.value)} required placeholder="••••••••" />
              </div>
              <Button data-testid="reset-submit" type="submit" className="w-full" disabled={loading}>
                {loading ? "Réinitialisation..." : "Réinitialiser"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
