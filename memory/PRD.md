# Dat'Agro — Product Requirements Document

## Problème original
Construire une application web full-stack responsive pour l'agriculture intelligente appelée "Dat'Agro". La plateforme fait interface entre agriculteurs, appareils IoT connectés, un pipeline de données et des modules de prédiction IA. Deux rôles : Agriculteur et Admin.

## Besoins produit
- Auth complète avec sessions persistantes et accès basé sur les rôles
- Onboarding guidé en 4 étapes pour les nouveaux agriculteurs
- Tableaux de bord temps réel avec données capteurs IoT
- Prédictions IA basées sur les données capteurs
- Alertes automatiques sur seuils critiques
- Dashboard admin de supervision
- UI professionnelle, premium, data-driven (thème vert/terre)

---

## Architecture technique

```
Frontend (React 18 + Tailwind + Shadcn/UI) - Port 3000
Backend (FastAPI + Motor async) - Port 8001
MongoDB - localhost:27017
Auth: JWT Bearer (localStorage) + httpOnly cookies (backup)
```

---

## Ce qui a été implémenté

### Session 1 (MVP initial)
- ✅ Architecture complète full-stack (FastAPI + React + MongoDB)
- ✅ Authentification JWT complète (register, login, logout, forgot/reset password)
- ✅ Sessions persistantes — **localStorage Bearer token (fix bug P0)**
- ✅ Protection des routes par rôle (farmer/admin)
- ✅ Page d'accueil publique (Landing)
- ✅ Onboarding 4 étapes (Farm → Plot → Device → Association)
- ✅ Dashboard agriculteur avec KPIs temps réel
- ✅ CRUD Exploitations, Parcelles, Appareils
- ✅ Injection données capteurs + alertes automatiques
- ✅ Analytiques (graphiques Recharts)
- ✅ Prédictions IA (algorithme rule-based sur données capteurs)
- ✅ Dashboard Admin avec stats globales
- ✅ Gestion utilisateurs admin (suspension/activation)
- ✅ Journaux d'audit
- ✅ Mode clair/sombre
- ✅ Renommage AgriFlow → Dat'Agro
- ✅ README.md complet

### Session 2 (Bug fix P0)
- ✅ **Fix bug onboarding**: passage cookie-only → Authorization Bearer (localStorage)
  - Backend: register/login retournent `access_token` dans le corps
  - Frontend api.js: intercepteur request ajoute `Authorization: Bearer`
  - Frontend AuthContext.js: login() stocke token, logout() l'efface
- ✅ README.md complet créé

---

## Backlog prioritaire

### P1 — Prochaine itération
- [ ] Intégration LLM réelle pour prédictions IA (Emergent LLM Key / Claude/GPT)
  - Remplacer `_compute_predictions()` rule-based par appel LLM avec contexte capteurs
  - Call `integration_playbook_expert_v2` pour Emergent LLM key

### P2 — Itération suivante
- [ ] Génération de données mock réalistes pour Analytics et Admin
  - Script de seed MongoDB avec données capteurs historiques (30 jours)
  - Données réalistes pour démonstration

### P3 — Backlog futur
- [ ] Module IoT temps réel (WebSocket pour données live)
- [ ] Export rapports PDF/CSV
- [ ] Alertes push/email (SendGrid ou autre)
- [ ] Géolocalisation des parcelles (carte interactive)
- [ ] Intégration météo (API externe)

---

## Endpoints API clés

| Méthode | Route | Auth |
|---------|-------|------|
| POST | /api/auth/register | Non |
| POST | /api/auth/login | Non |
| GET | /api/auth/me | Bearer |
| POST | /api/auth/refresh | Cookie refresh |
| GET/POST | /api/farms | Bearer |
| GET/POST | /api/plots | Bearer |
| GET/POST | /api/devices | Bearer |
| POST | /api/readings | Bearer |
| GET | /api/predictions | Bearer |
| POST | /api/predictions/generate/{plot_id} | Bearer |
| GET | /api/alerts | Bearer |
| GET | /api/dashboard/stats | Bearer |
| GET | /api/admin/stats | Bearer (admin) |
| GET | /api/admin/users | Bearer (admin) |

---

## Schéma DB principal

- `users`: _id, first_name, last_name, email, role, status, onboarding_completed, password_hash
- `farms`: _id, name, location, total_area, owner_id
- `plots`: _id, farm_id, owner_id, name, crop_type, area
- `devices`: _id, farm_id, plot_id, owner_id, device_uid, device_type, status, battery_level
- `sensor_readings`: _id, device_id, plot_id, owner_id, soil_moisture, air_temperature, ph, ...
- `alerts`: _id, owner_id, device_id, type, severity, is_resolved
- `predictions`: _id, plot_id, owner_id, target_variable, predicted_value, risk_level
- `audit_logs`: _id, user_id, action, resource_type

---

## Tests

- Iteration 1: Backend 100% (19/19), Frontend 95%
- Iteration 2: Backend 100% (19/19), Frontend 100% (7/7 flows)
- Fichiers: /app/test_reports/iteration_1.json, /app/test_reports/iteration_2.json
