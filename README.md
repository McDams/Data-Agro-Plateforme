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
10. [Intégration matérielle (ESP32 + LoRa + Raspberry Pi 4)](#intégration-matérielle-esp32--lora--raspberry-pi-4)
11. [Structure du projet](#structure-du-projet)
12. [Comptes de test](#comptes-de-test)

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
git clone https://github.com/McDams/Data-Agro-Plateforme.git
cd Data-Agro-Plateforme
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
| `POST` | `/api/farms/{id}/gateway-key` | Générer/régénérer la clé de passerelle IoT (retournée en clair une seule fois) |

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
| `POST` | `/api/readings` | Injecter un relevé capteur (auth utilisateur, usage manuel/frontend) |
| `POST` | `/api/ingest/batch` | Injecter un lot de relevés depuis une passerelle matérielle (auth `X-Gateway-Key`, voir [Intégration matérielle](#intégration-matérielle-esp32--lora--raspberry-pi-4)) |
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

## Intégration matérielle (ESP32 + LoRa + Raspberry Pi 4)

Dat'Agro est conçu pour recevoir des relevés d'un réseau de capteurs réel :

```
┌──────────────┐  LoRa   ┌──────────────┐  LoRa   ┌───────────────────┐
│ Nœud ESP32 #1│ ──────▶ │              │         │                    │
│ NPK/pH/humid.│         │  Raspberry   │ ◀────── │  Nœud ESP32 #2...  │
│ sol/temp/lux │         │  Pi 4        │         │                    │
└──────────────┘         │  (+module    │         └───────────────────┘
                          │   LoRa)      │
                          └──────┬───────┘
                                 │ HTTPS (X-Gateway-Key)
                                 ▼
                     POST /api/ingest/batch
                                 │
                                 ▼
                          Dat'Agro API → MongoDB → Dashboard / Alertes / Prédictions IA
```

Le Raspberry Pi 4 est le **seul point du réseau connecté à Internet** : chaque nœud ESP32
envoie ses relevés au Pi en LoRa, qui les agrège puis les transmet par lot à l'API.

### 1. Enregistrer chaque nœud ESP32 comme appareil

Avant qu'un nœud puisse envoyer des données, il doit être enregistré via l'interface
(**Appareils → Nouvel appareil**), rattaché à une exploitation (et optionnellement une parcelle),
avec un `device_uid` unique (ex: `esp32-parcelle3-01`) qui doit correspondre exactement à
l'identifiant envoyé par le nœud en LoRa. Un `device_uid` inconnu est rejeté par l'API.

### 2. Générer une clé de passerelle pour l'exploitation

Depuis **Exploitations → [votre exploitation] → Passerelle IoT → Générer une clé**, récupérez
la clé affichée (**une seule fois**, format `gw_...`) et configurez-la sur le Raspberry Pi
(variable d'environnement `GATEWAY_KEY`, jamais commitée dans un dépôt).

### 3. Envoyer les relevés depuis le Pi4

```bash
curl -X POST https://votre-domaine/api/ingest/batch \
  -H "X-Gateway-Key: gw_xxxxxxxxxxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "readings": [
      {
        "device_uid": "esp32-parcelle3-01",
        "soil_moisture": 42.3,
        "soil_temperature": 21.5,
        "air_temperature": 27.8,
        "air_humidity": 55.0,
        "luminosity": 12000,
        "soil_nitrogen": 38.0,
        "soil_phosphorus": 22.0,
        "soil_potassium": 180.0,
        "ph": 6.4,
        "conductivity": 1.2
      }
    ]
  }'
```

Seul `device_uid` est obligatoire ; n'incluez que les capteurs réellement présents sur le nœud.
La réponse indique le nombre de relevés acceptés et, pour chaque `device_uid` rejeté, la raison
(ex: appareil non enregistré pour cette exploitation) :

```json
{ "accepted": 1, "rejected": [] }
```

Un gabarit Python prêt à brancher sur votre code de réception LoRa est fourni dans
[`hardware/raspberry_gateway_example.py`](hardware/raspberry_gateway_example.py).

> **Prédictions IA** : `_compute_predictions` dans `backend/server.py` est aujourd'hui un moteur
> de règles/seuils simple, pas un modèle entraîné. Une fois ce pipeline en production et des
> données réelles accumulées, cette fonction est le point d'entrée à remplacer par un vrai modèle.

---

## Structure du projet

```
Data-Agro-Plateforme/
├── backend/
│   ├── server.py              # Application FastAPI, routes, connexion DB
│   ├── requirements.txt       # Dépendances Python
│   ├── .env.example           # Gabarit des variables d'environnement
│   └── tests/
│       └── test_datagro.py    # Tests pytest E2E backend
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
├── hardware/
│   └── raspberry_gateway_example.py  # Gabarit de passerelle LoRa → API
│
└── README.md
```

---

## Comptes de test

| Rôle | Email | Mot de passe |
|------|-------|-------------|
| Admin | `admin@datagro.com` | `DatAgro2024!` |
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
