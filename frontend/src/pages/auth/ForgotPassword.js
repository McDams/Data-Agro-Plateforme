import { useState } from "react";
import { Link } from "react-router-dom";
import api, { formatError } from "@/utils/api";
import { Sprout, ArrowLeft, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email });
      setSuccess(true);
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
            <span className="font-semibold text-xl" style={{ fontFamily: "Outfit, sans-serif" }}>Dat'Agro</span>
          </Link>
          <h1 className="text-2xl font-medium text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>
            Mot de passe oublié
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Nous vous enverrons un lien de réinitialisation
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          {success ? (
            <div className="text-center py-4 space-y-3">
              <CheckCircle size={40} className="text-primary mx-auto" />
              <p className="text-sm text-foreground font-medium">Instructions envoyées</p>
              <p className="text-sm text-muted-foreground">
                Si cet email est enregistré, vous recevrez un lien de réinitialisation.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
              <div className="space-y-1.5">
                <Label htmlFor="email">Adresse email</Label>
                <Input id="email" data-testid="forgot-email" type="email"
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  required placeholder="vous@exploitation.fr" />
              </div>
              <Button data-testid="forgot-submit" type="submit" className="w-full" disabled={loading}>
                {loading ? "Envoi..." : "Envoyer le lien"}
              </Button>
            </form>
          )}
        </div>

        <div className="text-center mt-6">
          <Link to="/connexion" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft size={14} /> Retour à la connexion
          </Link>
        </div>
      </div>
    </div>
  );
}
