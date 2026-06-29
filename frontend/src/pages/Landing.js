import { useNavigate } from "react-router-dom";
import { Sprout, BarChart2, Cpu, Bell, ArrowRight, CheckCircle, Shield, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const HERO_IMG = "https://images.pexels.com/photos/10201586/pexels-photo-10201586.jpeg";

const features = [
  {
    icon: Cpu,
    title: "Capteurs IoT connectés",
    desc: "Reliez vos sondes de terrain — humidité, NPK, température — à la plateforme en quelques minutes."
  },
  {
    icon: BarChart2,
    title: "Analyse de données en temps réel",
    desc: "Visualisez vos indicateurs agronomiques sur des tableaux de bord clairs et exploitables."
  },
  {
    icon: Bell,
    title: "Alertes intelligentes",
    desc: "Recevez des alertes automatiques lorsque vos cultures nécessitent une intervention."
  },
  {
    icon: Zap,
    title: "Prédictions basées sur les données",
    desc: "L'IA analyse les tendances de vos capteurs pour anticiper les risques et recommander des actions."
  },
  {
    icon: Shield,
    title: "Plateforme sécurisée",
    desc: "Vos données agricoles restent privées et protégées. Accès par rôle et chiffrement intégré."
  },
  {
    icon: CheckCircle,
    title: "Simple pour les agriculteurs",
    desc: "Interface conçue pour les utilisateurs non-techniques. Pas de jargon, que de l'essentiel."
  },
];

const benefits = [
  "Réduire les coûts d'irrigation de 20 à 40%",
  "Détecter les carences nutritives avant qu'elles impactent la récolte",
  "Gérer plusieurs exploitations depuis un seul tableau de bord",
  "Recevoir des recommandations d'action basées sur vos données réelles",
  "Suivre l'état de santé de chaque parcelle en temps réel",
];

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navbar */}
      <nav className="border-b border-border bg-card/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Sprout size={16} className="text-primary-foreground" />
            </div>
            <span className="font-semibold text-lg text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>
              Dat'Agro
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/connexion")}
              data-testid="landing-signin-button">
              Connexion
            </Button>
            <Button size="sm" onClick={() => navigate("/inscription")}
              data-testid="landing-signup-button">
              Commencer gratuitement
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <img src={HERO_IMG} alt="Champ agricole" className="w-full h-full object-cover opacity-10 dark:opacity-5" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/60 to-background" />
        </div>
        <div className="max-w-6xl mx-auto px-4 pt-20 pb-24 text-center">
          <Badge variant="secondary" className="mb-6 text-xs font-semibold tracking-wider uppercase">
            Agriculture connectée
          </Badge>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl tracking-tight font-medium text-foreground mb-6 leading-tight"
            style={{ fontFamily: "Outfit, sans-serif" }}>
            Pilotez vos exploitations
            <br />
            <span className="text-primary">avec la donnée terrain</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            Dat'Agro centralise vos capteurs IoT, analyse vos données de sol et d'environnement,
            et vous aide à prendre de meilleures décisions agronomiques — à temps.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" onClick={() => navigate("/inscription")}
              data-testid="hero-create-account-button"
              className="gap-2 px-8">
              Créer mon compte <ArrowRight size={16} />
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate("/connexion")}
              data-testid="hero-demo-button">
              Voir une démo
            </Button>
          </div>
          <p className="mt-6 text-sm text-muted-foreground">
            Gratuit pendant 14 jours · Aucune carte bancaire requise
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-4 py-20">
        <div className="text-center mb-14">
          <h2 className="text-2xl sm:text-3xl font-medium text-foreground mb-3" style={{ fontFamily: "Outfit, sans-serif" }}>
            Tout ce dont vous avez besoin pour gérer votre terrain
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Une plateforme pensée pour les agriculteurs, pas pour les ingénieurs.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f) => (
            <div key={f.title}
              className="bg-card border border-border rounded-lg p-6 hover:-translate-y-1 transition-transform duration-200">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <f.icon size={20} className="text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-2" style={{ fontFamily: "Outfit, sans-serif" }}>
                {f.title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Benefits */}
      <section className="bg-primary/5 border-y border-border py-20">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-2xl sm:text-3xl font-medium text-foreground mb-6" style={{ fontFamily: "Outfit, sans-serif" }}>
                Pourquoi les agriculteurs choisissent Dat'Agro
              </h2>
              <ul className="space-y-4">
                {benefits.map((b) => (
                  <li key={b} className="flex items-start gap-3">
                    <CheckCircle size={18} className="text-primary shrink-0 mt-0.5" />
                    <span className="text-muted-foreground text-sm">{b}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-card border border-border rounded-xl p-6 space-y-4">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-4">
                Aperçu du tableau de bord
              </div>
              {[
                { label: "Humidité du sol", value: "62%", color: "bg-blue-500", width: "62%", status: "Optimal" },
                { label: "Azote (N)", value: "45 mg/kg", color: "bg-green-500", width: "75%", status: "Bon" },
                { label: "Température air", value: "24°C", color: "bg-amber-500", width: "50%", status: "Normal" },
                { label: "pH du sol", value: "6.8", color: "bg-teal-500", width: "85%", status: "Excellent" },
              ].map((m) => (
                <div key={m.label} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-foreground font-medium">{m.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">{m.value}</span>
                      <Badge variant="outline" className="text-xs py-0 border-green-500/30 text-green-600">
                        {m.status}
                      </Badge>
                    </div>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full ${m.color} rounded-full opacity-70`} style={{ width: m.width }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-4 py-20 text-center">
        <h2 className="text-2xl sm:text-3xl font-medium text-foreground mb-4" style={{ fontFamily: "Outfit, sans-serif" }}>
          Prêt à connecter vos champs ?
        </h2>
        <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
          Rejoignez des centaines d'agriculteurs qui pilotent leur exploitation avec la donnée.
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <Button size="lg" onClick={() => navigate("/inscription")}
            data-testid="cta-create-account-button" className="gap-2 px-10">
            Créer mon compte <ArrowRight size={16} />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card py-8">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-primary flex items-center justify-center">
              <Sprout size={12} className="text-primary-foreground" />
            </div>
            <span className="text-sm font-semibold text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>
              Dat'Agro
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            © 2024 Dat'Agro. Plateforme d'agriculture connectée.
          </p>
        </div>
      </footer>
    </div>
  );
}
