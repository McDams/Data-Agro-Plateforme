# Dat'Agro — Plateforme Intelligente d'Agriculture Connectée

**Dat'Agro** est une plateforme full-stack de gestion agricole connectée. Elle sert d'interface entre les agriculteurs, les appareils IoT, un pipeline de données et des modules de prédiction IA. Deux rôles sont supportés : **Agriculteur** et **Administrateur**.

---

## Table des matières

1. [Fonctionnalités](#fonctionnalités)
2. [Architecture technique](#architecture-technique)
3. [Prérequis](#prérequis)
4. [Installation & Démarrage local](#installation--démarrage-local)
5. [Variables d'environnement](#variables-denvironnement)
6. [Endpoints API clés](#endpoints-api-clés)
7. [Schéma de base de données](#schéma-de-base-de-données)
8. [Flux d'authentification](#flux-dauthentification)
9. [Rôles et accès](#rôles-et-accès)
10. [Structure du projet](#structure-du-projet)
11. [Comptes de test](#comptes-de-test)

---

## Fonctionnalités

### Espace Agriculteur

| Module | Description |
|--------|-------------|
| **Authentification** | Inscription, connexion, mot de passe oublié/réinitialisation, sessions persistantes via JWT |
| **Onboarding guidé** | Processus en 4 étapes : Exploitation → Parcelle → Appareil → Association |
| **Tableau de bord** | KPIs en temps réel : exploitations, parcelles, appareils, alertes actives, moyennes capteurs |
| **Exploitations** | CRUD complet pour les exploitations agricoles |
| **Parcelles** | Gestion des parcelles par exploitation, type de culture, surface |
| **Appareils IoT** | Enregistrement et gestion de capteurs connectés (humidité sol, température, NPK, pH, etc.) |
| **Analytiques** | Graphiques historiques des relevés capteurs par parcelle |
| **Prédictions IA** | Analyse des données capteurs et recommandations agronomiques |
| **Alertes** | Alertes automatiques selon les seuils critiques (humidité, température, NPK, pH) |
| **Rapports** | Export et consultation des rapports d'exploitation |
| **Profil** | Modification du profil utilisateur et changement de mot de passe |

### Espace Administrateur

| Module | Description |
|--------|-------------|
| **Dashboard Admin** | Vue globale : utilisateurs, exploitations, appareils, alertes critiques |
| **Gestion utilisateurs** | Supervision, suspension/activation des comptes agriculteurs |
| **Supervision exploitations** | Vue de toutes les exploitations de la plateforme |
| **Supervision appareils** | État global du parc d'appareils IoT |
| **Alertes globales** | Toutes les alertes actives sur la plateforme |
| **Journaux d'audit** | Historique des actions utilisateurs |
| **Paramètres système** | Configuration de la plateforme |

---

## Architecture technique

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (React)                      │
│  React 18 + React Router + Tailwind CSS + Shadcn/UI         │
│  Port: 3000                                                  │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS / API calls (/api/*)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                      Backend (FastAPI)                       │
│  Python + FastAPI + Motor (async MongoDB driver)            │
│  Port: 8001                                                  │
│  Auth: JWT Bearer tokens (localStorage) + httpOnly cookies  │
└──────────────────────────┬──────────────────────────────────┘
                           │ Motor async driver
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                      Base de données                         │
│  MongoDB (localhost:27017)                                   │
└─────────────────────────────────────────────────────────────┘
```

**Stack Frontend**
- React 18, React Router v6
- Tailwind CSS avec thème personnalisé (mode clair/sombre)
- Shadcn/UI (composants accessibles)
- Axios (client HTTP avec intercepteurs)
- Recharts (graphiques analytiques)
- Lucide React (icônes)

**Stack Backend**
- FastAPI (framework Python async)
- Motor (driver MongoDB async)
- PyJWT (tokens JWT)
- Bcrypt (hachage de mots de passe)
- Pydantic v2 (validation des données)

---

## Prérequis

- **Node.js** >= 18.x et **Yarn** >= 1.x
- **Python** >= 3.11
- **MongoDB** >= 6.x (local ou Atlas)
- **pip** >= 23.x

---

## Installation & Démarrage local

### 1. Cloner le dépôt

```bash
git clone <url-du-repo>
cd datagro
```

### 2. Backend (FastAPI)

```bash
cd backend

# Créer et activer un environnement virtuel
python3 -m venv venv
source venv/bin/activate   # Linux/macOS
# ou: venv\Scripts\activate  # Windows

# Installer les dépendances
pip install -r requirements.txt

# Configurer les variables d'environnement
cp .env.example .env
# Éditer .env avec vos valeurs (voir section Variables d'environnement)

# Démarrer le serveur de développement
uvicorn server:app --reload --host 0.0.0.0 --port 8001
```

### 3. Frontend (React)

```bash
cd frontend

# Installer les dépendances
yarn install

# Configurer les variables d'environnement
cp .env.example .env
# Éditer .env avec vos valeurs

# Démarrer le serveur de développement
yarn start
```

L'application est accessible à : `http://localhost:3000`

L'API est accessible à : `http://localhost:8001/api`

La documentation interactive Swagger : `http://localhost:8001/docs`

---

## Variables d'environnement

### Backend (`backend/.env`)

```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=datagro_db
CORS_ORIGINS=http://localhost:3000
JWT_SECRET=votre-secret-jwt-tres-securise-au-moins-32-chars
ADMIN_EMAIL=admin@datagro.com
ADMIN_PASSWORD=DatAgro2024!
FRONTEND_URL=http://localhost:3000
```

| Variable | Description | Exemple |
|----------|-------------|---------|
| `MONGO_URL` | URI de connexion MongoDB | `mongodb://localhost:27017` |
| `DB_NAME` | Nom de la base de données | `datagro_db` |
| `CORS_ORIGINS` | Origines autorisées (séparées par virgule) | `http://localhost:3000` |
| `JWT_SECRET` | Clé secrète pour signer les tokens JWT | Chaîne aléatoire de 32+ caractères |
| `ADMIN_EMAIL` | Email du compte administrateur créé au démarrage | `admin@datagro.com` |
| `ADMIN_PASSWORD` | Mot de passe admin (min. 8 caractères) | `DatAgro2024!` |
| `FRONTEND_URL` | URL du frontend (pour CORS) | `http://localhost:3000` |

### Frontend (`frontend/.env`)

```env
REACT_APP_BACKEND_URL=http://localhost:8001
WDS_SOCKET_PORT=3000
```

| Variable | Description |
|----------|-------------|
| `REACT_APP_BACKEND_URL` | URL du backend FastAPI |
| `WDS_SOCKET_PORT` | Port WebSocket pour hot-reload (dev uniquement) |

---

## Endpoints API clés

### Authentification

| Méthode | Endpoint | Description | Auth |
|---------|----------|-------------|:---:|
| `POST` | `/api/auth/register` | Inscription → retourne `access_token` | Non |
| `POST` | `/api/auth/login` | Connexion → retourne `access_token` | Non |
| `POST` | `/api/auth/logout` | Déconnexion | Oui |
| `GET` | `/api/auth/me` | Profil courant | Oui |
| `POST` | `/api/auth/refresh` | Rafraîchissement du token | Cookie refresh |
| `POST` | `/api/auth/forgot-password` | Demande de réinitialisation | Non |
| `POST` | `/api/auth/reset-password` | Réinitialisation mot de passe | Non |

### Exploitations

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `GET` | `/api/farms` | Liste des exploitations |
| `POST` | `/api/farms` | Créer une exploitation |
| `GET` | `/api/farms/{id}` | Détail exploitation |
| `PUT` | `/api/farms/{id}` | Modifier exploitation |
| `DELETE` | `/api/farms/{id}` | Supprimer exploitation |

### Parcelles

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `GET` | `/api/plots` | Liste des parcelles (`?farm_id=`) |
| `POST` | `/api/plots` | Créer une parcelle |
| `PUT` | `/api/plots/{id}` | Modifier parcelle |
| `DELETE` | `/api/plots/{id}` | Supprimer parcelle |

### Appareils

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `GET` | `/api/devices` | Liste des appareils |
| `POST` | `/api/devices` | Enregistrer un appareil |
| `PUT` | `/api/devices/{id}` | Modifier appareil |
| `DELETE` | `/api/devices/{id}` | Supprimer appareil |

### Données capteurs & Prédictions

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `GET` | `/api/readings` | Relevés capteurs (`?device_id=&plot_id=&hours=48`) |
| `POST` | `/api/readings` | Injecter un relevé capteur |
| `GET` | `/api/predictions` | Prédictions IA |
| `POST` | `/api/predictions/generate/{plot_id}` | Générer prédictions |

### Alertes

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `GET` | `/api/alerts` | Liste alertes (`?severity=&is_resolved=`) |
| `PUT` | `/api/alerts/{id}/read` | Marquer comme lue |
| `PUT` | `/api/alerts/{id}/resolve` | Résoudre une alerte |

### Administration

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `GET` | `/api/admin/stats` | Statistiques globales |
| `GET` | `/api/admin/users` | Liste agriculteurs |
| `PUT` | `/api/admin/users/{id}/status` | Modifier statut utilisateur |
| `GET` | `/api/admin/farms` | Toutes les exploitations |
| `GET` | `/api/admin/devices` | Tous les appareils |
| `GET` | `/api/admin/audit-logs` | Journaux d'audit |

---

## Schéma de base de données

### Collection `users`

```json
{
  "_id": "ObjectId",
  "first_name": "string",
  "last_name": "string",
  "email": "string (unique)",
  "phone": "string?",
  "farm_name": "string?",
  "country": "string?",
  "role": "farmer | admin",
  "status": "active | suspended | pending",
  "password_hash": "string (bcrypt)",
  "onboarding_completed": "boolean",
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

### Collection `farms`

```json
{
  "_id": "ObjectId",
  "name": "string",
  "location": "string",
  "description": "string?",
  "total_area": "float? (hectares)",
  "owner_id": "string (ref: users._id)",
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

### Collection `plots`

```json
{
  "_id": "ObjectId",
  "farm_id": "string (ref: farms._id)",
  "owner_id": "string (ref: users._id)",
  "name": "string",
  "location": "string?",
  "area": "float? (hectares)",
  "crop_type": "string?",
  "sowing_date": "string?",
  "notes": "string?",
  "status": "active | inactive",
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

### Collection `devices`

```json
{
  "_id": "ObjectId",
  "farm_id": "string",
  "plot_id": "string?",
  "owner_id": "string",
  "name": "string",
  "device_uid": "string (unique)",
  "device_type": "string",
  "sensor_types": ["string"],
  "status": "online | offline | maintenance",
  "battery_level": "int (0-100)",
  "signal_strength": "int",
  "firmware_version": "string",
  "last_sync": "datetime?",
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

### Collection `sensor_readings`

```json
{
  "_id": "ObjectId",
  "device_id": "string",
  "plot_id": "string",
  "owner_id": "string",
  "soil_moisture": "float? (%)",
  "soil_temperature": "float? (°C)",
  "air_temperature": "float? (°C)",
  "air_humidity": "float? (%)",
  "luminosity": "float? (lux)",
  "soil_nitrogen": "float? (mg/kg)",
  "soil_phosphorus": "float? (mg/kg)",
  "soil_potassium": "float? (mg/kg)",
  "ph": "float?",
  "conductivity": "float?",
  "timestamp": "datetime"
}
```

### Collection `alerts`

```json
{
  "_id": "ObjectId",
  "owner_id": "string",
  "device_id": "string",
  "plot_id": "string",
  "type": "string",
  "severity": "low | medium | high | critical",
  "title": "string",
  "message": "string",
  "is_read": "boolean",
  "is_resolved": "boolean",
  "resolved_at": "datetime?",
  "created_at": "datetime"
}
```

---

## Flux d'authentification

Dat'Agro utilise une authentification double : **JWT en `localStorage`** (principal) + **httpOnly cookies** (backup).

```
┌────────────┐     POST /api/auth/login      ┌────────────┐
│  Frontend  │ ──────────────────────────── ▶│  Backend   │
│            │                               │            │
│            │ ◀──────────────────────────── │            │
│            │  { access_token, user... }     │            │
│            │  Set-Cookie: access_token      │            │
│            │                               │            │
│ localStorage│                              │            │
│ .set(token)│                               │            │
└────────────┘                               └────────────┘
      │
      │  Requêtes suivantes
      ▼
Authorization: Bearer <token>   ← prioritaire
Cookie: access_token=<token>    ← backup

Token expire → POST /api/auth/refresh → nouveau token → retry automatique
```

**Durée de vie des tokens :**
- Access token : **2 heures**
- Refresh token : **7 jours**

---

## Rôles et accès

| Route | Rôle requis |
|-------|-------------|
| `/` | Public |
| `/connexion`, `/inscription` | Public |
| `/onboarding` | Authentifié |
| `/tableau-de-bord`, `/exploitations`, etc. | `farmer` |
| `/admin`, `/admin/*` | `admin` |

---

## Structure du projet

```
/app
├── backend/
│   ├── server.py              # Application FastAPI, routes, connexion DB
│   ├── requirements.txt       # Dépendances Python
│   ├── .env                   # Variables d'environnement
│   └── tests/
│       └── test_agriflow.py   # Tests pytest E2E backend
│
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── layout/        # AppLayout, Sidebar, TopHeader
│       │   └── ui/            # Composants Shadcn/UI
│       ├── contexts/
│       │   ├── AuthContext.js # Auth state + localStorage token
│       │   └── ThemeContext.js
│       ├── pages/
│       │   ├── Landing.js
│       │   ├── auth/          # Login, Register, ForgotPassword, ResetPassword
│       │   ├── onboarding/    # Onboarding 4 étapes
│       │   ├── farmer/        # Dashboard, Farms, Plots, Devices, Analytics...
│       │   └── admin/         # AdminDashboard, AdminUsers, AdminFarms...
│       ├── utils/
│       │   └── api.js         # Axios + intercepteurs Bearer token
│       ├── App.js             # Routes React Router v6
│       └── index.css          # Variables CSS Tailwind
│
├── memory/
│   ├── PRD.md
│   └── test_credentials.md
│
└── README.md
```

---

## Comptes de test

| Rôle | Email | Mot de passe |
|------|-------|-------------|
| Admin | `admin@agriflow.com` | `AgriFlow2024!` |
| Agriculteur | Créer via `/inscription` | — |

> Le compte admin est créé automatiquement au démarrage du serveur.

---

## Développement

### Lancer les tests backend

```bash
cd backend
pytest tests/ -v
```

### Mode production

1. Mettre `secure=True` dans `set_cookies()` dans `server.py`
2. Utiliser un `JWT_SECRET` fort (32+ caractères)
3. Configurer MongoDB Atlas
4. `CORS_ORIGINS` = domaine de production uniquement
5. HTTPS obligatoire

---

*Dat'Agro — Vers une agriculture connectée et intelligente*
