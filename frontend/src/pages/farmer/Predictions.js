import { useState, useEffect } from "react";
import api from "@/utils/api";
import { Brain, RefreshCw, TrendingUp, TrendingDown, Minus, ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const RISK_CONFIG = {
  critical: { label: "Critique", color: "bg-destructive/10 text-destructive border-destructive/20" },
  high: { label: "Élevé", color: "bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400" },
  medium: { label: "Moyen", color: "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400" },
  low: { label: "Faible", color: "bg-primary/5 text-primary border-primary/20" },
};

const TREND_ICON = { up: TrendingUp, down: TrendingDown, stable: Minus };

export default function Predictions() {
  const [plots, setPlots] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedPlot, setSelectedPlot] = useState("all");
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    Promise.all([
      api.get("/plots").then(r => r.data),
      api.get("/predictions?limit=50").then(r => r.data),
    ]).then(([p, pred]) => { setPlots(p); setPredictions(pred); })
      .catch(() => {}).finally(() => setLoading(false));
  }, []);

  const generateForAll = async () => {
    if (!plots.length) { toast.error("Aucune parcelle disponible"); return; }
    setGenerating(true);
    try {
      const results = await Promise.all(
        plots.map(p => api.post(`/predictions/generate/${p.id}`).then(r => r.data))
      );
      setPredictions(results.flat());
      toast.success("Prédictions générées avec succès");
    } catch { toast.error("Erreur lors de la génération"); }
    finally { setGenerating(false); }
  };

  const generateForPlot = async (plotId) => {
    setGenerating(true);
    try {
      const { data } = await api.post(`/predictions/generate/${plotId}`);
      setPredictions(prev => {
        const filtered = prev.filter(p => p.plot_id !== plotId);
        return [...filtered, ...data];
      });
      toast.success("Prédictions mises à jour");
    } catch { toast.error("Erreur lors de la génération"); }
    finally { setGenerating(false); }
  };

  const filtered = selectedPlot === "all" ? predictions : predictions.filter(p => p.plot_id === selectedPlot);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-medium text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>Prédictions</h1>
          <p className="text-sm text-muted-foreground">Analyse prédictive basée sur vos données capteur</p>
        </div>
        <div className="flex gap-3">
          {plots.length > 0 && (
            <select value={selectedPlot} onChange={e => setSelectedPlot(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm">
              <option value="all">Toutes les parcelles</option>
              {plots.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
          <Button onClick={generateForAll} disabled={generating || !plots.length}
            data-testid="generate-predictions-button" className="gap-2">
            <RefreshCw size={14} className={generating ? "animate-spin" : ""} />
            {generating ? "Génération..." : "Générer prédictions"}
          </Button>
        </div>
      </div>

      {/* Info card */}
      <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 flex items-start gap-3">
        <Brain size={20} className="text-primary shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-foreground">Comment fonctionnent les prédictions ?</p>
          <p className="text-xs text-muted-foreground mt-1">
            Les prédictions sont calculées à partir des données de vos capteurs. 
            L'algorithme analyse les tendances des 72 dernières heures pour identifier les risques 
            et recommander des actions préventives.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="grid md:grid-cols-2 gap-4">
          {[1,2,3,4].map(i => <Card key={i}><CardContent className="p-5"><Skeleton className="h-32" /></CardContent></Card>)}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <Brain size={40} className="text-muted-foreground mx-auto mb-4" />
            <h3 className="font-medium text-foreground mb-2" style={{ fontFamily: "Outfit, sans-serif" }}>
              Aucune prédiction
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {plots.length === 0
                ? "Créez des parcelles et des appareils pour générer des prédictions."
                : "Cliquez sur 'Générer prédictions' ou ajoutez des données capteur."}
            </p>
            {plots.length > 0 && (
              <Button onClick={generateForAll} disabled={generating} size="sm" className="gap-2">
                <RefreshCw size={14} /> Générer
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {filtered.map((pred) => {
            const risk = RISK_CONFIG[pred.risk_level] || RISK_CONFIG.low;
            const TrendIcon = TREND_ICON[pred.trend] || Minus;
            const isExpanded = expanded === pred.id;
            return (
              <Card key={pred.id} className={cn("border", risk.color.includes("destructive") ? "border-destructive/20" : "border-border")}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-xs text-muted-foreground font-semibold uppercase tracking-widest mb-1">
                        {pred.plot_name || "Parcelle"}
                      </p>
                      <h3 className="font-semibold text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>
                        {pred.target_variable}
                      </h3>
                    </div>
                    <Badge variant="outline" className={cn("text-xs shrink-0", risk.color)}>
                      {risk.label}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-4 mb-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Valeur prédite</p>
                      <p className="text-xl font-semibold text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>
                        {pred.predicted_value?.toFixed(1)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Horizon</p>
                      <p className="text-sm font-medium text-foreground">{pred.forecast_horizon}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Confiance</p>
                      <div className="flex items-center gap-1">
                        <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${(pred.confidence || 0) * 100}%` }} />
                        </div>
                        <span className="text-xs font-medium">{Math.round((pred.confidence || 0) * 100)}%</span>
                      </div>
                    </div>
                    <TrendIcon size={16} className={cn(
                      pred.trend === "up" ? "text-primary" :
                        pred.trend === "down" ? "text-destructive" : "text-muted-foreground"
                    )} />
                  </div>

                  <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                    <p className="text-xs font-semibold text-foreground">Action recommandée</p>
                    <p className="text-sm text-foreground">{pred.recommended_action}</p>
                  </div>

                  <button onClick={() => setExpanded(isExpanded ? null : pred.id)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mt-3 transition-colors">
                    <ChevronDown size={12} className={cn("transition-transform", isExpanded ? "rotate-180" : "")} />
                    {isExpanded ? "Masquer l'explication" : "Voir l'explication"}
                  </button>

                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <p className="text-xs text-muted-foreground leading-relaxed">{pred.explanation}</p>
                      <Button size="sm" variant="ghost" className="mt-2 h-7 text-xs gap-1"
                        onClick={() => generateForPlot(pred.plot_id)} disabled={generating}>
                        <RefreshCw size={11} /> Recalculer
                      </Button>
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground mt-3">
                    {new Date(pred.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
