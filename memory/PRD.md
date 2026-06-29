# AgriFlow — PRD (Product Requirements Document)

## Vue d'ensemble
**Produit** : AgriFlow — Plateforme SaaS d'agriculture connectée  
**Dernière mise à jour** : 2024-01-01  
**Version** : 1.0.0 MVP  

## Contexte et objectifs
Plateforme web full-stack permettant aux agriculteurs et administrateurs de :
- Surveiller des capteurs IoT déployés dans les champs
- Analyser données de sol et d'environnement
- Visualiser des prédictions basées sur les données capteur
- Gérer fermes, parcelles, appareils et alertes

## Architecture technique
- **Backend** : FastAPI (Python) — /app/backend/server.py
- **Frontend** : React 19 — /app/frontend/src/
- **Base de données** : MongoDB
- **Auth** : JWT via httpOnly cookies, bcrypt pour les mots de passe
- **Charts** : Recharts
- **Icons** : lucide-react
- **Style** : Tailwind CSS + shadcn/ui
- **Fonts** : Outfit (headings) + IBM Plex Sans (body)

## Rôles utilisateur
1. **Farmer** (agriculteur) — dashboard, exploitations, parcelles, appareils, analytics, prédictions, alertes, rapports, profil
2. **Admin** — dashboard admin, gestion utilisateurs, supervision exploitations/appareils, alertes, journal d'audit, paramètres système

## Ce qui a été implémenté (MVP v1.0)

### Backend (server.py)
- Auth complète : register, login, logout, me, refresh, forgot-password, reset-password
- Protection anti-brute-force (5 tentatives max)
- CRUD Exploitations (farms)
- CRUD Parcelles (plots)
- CRUD Appareils (devices) avec enrollment
- Lectures capteur (sensor readings) avec génération automatique d'alertes
- Moteur d'alertes automatiques basé sur seuils
- Module prédictions : algorithme basé sur tendances 72h des capteurs
- Module rapports
- Notifications
- Administration (stats, users, farms, devices, alerts, audit logs)
- Onboarding (4 étapes : farm → plot → device → association)
- Dashboard stats (KPIs calculés en temps réel)

### Frontend
- **Pages publiques** : Landing page, Login, Register, ForgotPassword, ResetPassword
- **Onboarding** : Stepper guidé 4 étapes
- **Farmer** : Dashboard (KPIs + charts), Exploitations, Parcelles, Appareils (+ simulateur de lectures), Analytics (charts ligne/aire/barre), Prédictions, Alertes, Rapports, Profil/Paramètres
- **Admin** : Dashboard, Gestion utilisateurs, Exploitations, Appareils, Alertes, Journal d'audit, Paramètres système
- Sidebar responsive (collapse sur desktop, drawer sur mobile)
- Dark/Light mode (persisté en localStorage)
- Toasts/notifications
- Export CSV depuis les pages Analytics et Rapports

## Résultats des tests
- Backend : 100% (19/19 tests)
- Frontend : 95% (flux complets validés)

## Comptes de test
- Admin: admin@agriflow.com / AgriFlow2024!
- Farmer test: uifarmer_1782764007@test.com / TestFarmer2024!

## Personas utilisateur
1. **Jean Dupont** — agriculteur céréalier, 50 ha en Beauce, non-technicien, veut des alertes simples et des tableaux de bord lisibles
2. **Marie Martin** — exploitante maraîchère, plusieurs parcelles, veut suivre NPK et humidité en temps réel
3. **Admin AgriFlow** — supervise la plateforme, valide les comptes, surveille les incidents

## Fonctionnalités reportées (Backlog P1/P2)

### P1 (prochaine itération)
- Envoi réel d'emails pour reset de mot de passe (intégration SendGrid/Resend)
- Flux d'approbation admin pour nouveaux comptes farmers (pending → active)
- Notifications en temps réel (WebSocket ou polling)
- Page d'aide / FAQ
- Localisation GPS avec carte interactive (Leaflet.js)

### P2 (futur)
- Export PDF des rapports
- Application mobile (React Native ou PWA)
- Intégration API météo externe
- Multi-utilisateurs par exploitation (invitations)
- Tableau de bord de comparaison entre parcelles
- Historique des prédictions avec comparaison prévu vs réel
- Seuils d'alerte personnalisables par utilisateur
- Support multilingue (EN + FR)

## Variables d'environnement clés
- MONGO_URL, DB_NAME (MongoDB)
- JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
- FRONTEND_URL, CORS_ORIGINS
