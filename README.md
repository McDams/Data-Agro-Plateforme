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
11. [Pipeline Big Data — Lakehouse Bronze/Silver/Gold (n8n)](#pipeline-big-data--lakehouse-bronzesilvergold-n8n)
12. [Simulateur de nœuds LoRa](#simulateur-de-nœuds-lora)
13. [Structure du projet](#structure-du-projet)
14. [Comptes de test](#comptes-de-test)

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
│  Python + FastAPI + asyncpg (driver PostgreSQL async)        │
│  Port: 8001                                                  │
│  Auth: JWT Bearer tokens (localStorage) + httpOnly cookies  │
└──────────────────────────┬──────────────────────────────────┘
                           │ asyncpg (SQL paramétré, sans ORM)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                 PostgreSQL (localhost:5432)                  │
│  Schéma opérationnel (public) : users, farms, plots,          │
│  devices, sensor_readings, alerts, predictions...             │
│                           +                                   │
│  Lakehouse Bronze/Silver/Gold — voir section dédiée           │
│  (alimenté par n8n : Agro_Bronze_to_Silver, Agro_Silver_to_Gold)│
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
- asyncpg (driver PostgreSQL async, SQL paramétré à la main — pas d'ORM)
- PyJWT (tokens JWT)
- Bcrypt (hachage de mots de passe)
- Pydantic v2 (validation des données)

**Pipeline Big Data**
- PostgreSQL (schémas dédiés `bronze` / `silver` / `gold`, architecture médaillon)
- n8n (orchestration des transformations Bronze→Silver→Gold, planifiées par `scheduleTrigger`)

---

## Prérequis

- **Node.js** >= 18.x et **Yarn** >= 1.x
- **Python** >= 3.11
- **PostgreSQL** >= 13 (pour `gen_random_uuid()` natif, local ou managé)
- **n8n** >= 1.x (orchestration du pipeline Bronze/Silver/Gold — `npm install -g n8n`)
- **pip** >= 23.x

---

## Installation & Démarrage local

### 1. Cloner le dépôt

```bash
git clone https://github.com/McDams/Data-Agro-Plateforme.git
cd Data-Agro-Plateforme
```

### 2. Base de données PostgreSQL

```bash
# Créer le rôle applicatif et la base
psql -U postgres -c "CREATE ROLE datagro_app WITH LOGIN PASSWORD 'votre-mot-de-passe';"
psql -U postgres -c "CREATE DATABASE datagro_db OWNER datagro_app;"

# Appliquer le schéma opérationnel (obligatoire)
psql -U datagro_app -d datagro_db -f backend/db/schema_operational.sql

# Appliquer le schéma du lakehouse (optionnel à ce stade — nécessaire pour la
# section "Pipeline Big Data" ci-dessous)
psql -U datagro_app -d datagro_db -f pipeline/schema/bronze.sql
psql -U datagro_app -d datagro_db -f pipeline/schema/silver.sql
psql -U datagro_app -d datagro_db -f pipeline/schema/gold.sql
```

### 3. Backend (FastAPI)

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

### 4. Frontend (React)

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
DATABASE_URL=postgresql://datagro_app:votre-mot-de-passe@localhost:5432/datagro_db
CORS_ORIGINS=http://localhost:3000
JWT_SECRET=votre-secret-jwt-tres-securise-au-moins-32-chars
ADMIN_EMAIL=admin@datagro.com
ADMIN_PASSWORD=DatAgro2024!
FRONTEND_URL=http://localhost:3000
```

| Variable | Description | Exemple |
|----------|-------------|---------|
| `DATABASE_URL` | URI de connexion PostgreSQL | `postgresql://datagro_app:...@localhost:5432/datagro_db` |
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

Le schéma opérationnel complet (DDL) est dans [`backend/db/schema_operational.sql`](backend/db/schema_operational.sql).
Toutes les tables utilisent des clés primaires `UUID` (`gen_random_uuid()`, natif PostgreSQL ≥ 13) —
le champ `id` reste une chaîne opaque côté API, comme avant.

### Table `users`

```
id UUID, first_name, last_name, email (unique), phone?, farm_name?, country?,
role (farmer|admin), status (active|suspended|pending), password_hash (bcrypt),
onboarding_completed, created_at, updated_at
```

### Table `farms`

```
id UUID, name, location, description?, total_area? (ha), owner_id (FK users),
gateway_key_hash? (SHA-256, jamais exposé), gateway_key_prefix?, created_at, updated_at
```

### Table `plots`

```
id UUID, farm_id (FK farms), owner_id (FK users), name, location?, area? (ha),
crop_type?, sowing_date?, notes?, status, created_at, updated_at
```

### Table `devices`

```
id UUID, farm_id (FK farms), plot_id? (FK plots), owner_id (FK users), name,
device_uid (unique), device_type, sensor_types (TEXT[]),
status (online|offline|maintenance), battery_level (0-100), signal_strength,
firmware_version, last_sync?, created_at, updated_at
```

### Table `sensor_readings`

```
id UUID, device_id (FK devices), plot_id? (FK plots), owner_id (FK users),
soil_moisture? (%), soil_temperature? (°C), air_temperature? (°C), air_humidity? (%),
luminosity? (lux), soil_nitrogen?/soil_phosphorus?/soil_potassium? (mg/kg),
ph?, conductivity?, timestamp
```
Index `BRIN` sur `timestamp` (série temporelle à fort volume) + `btree` sur `(device_id, timestamp DESC)`.

### Table `alerts`

```
id UUID, owner_id (FK users), device_id? (FK devices), plot_id? (FK plots),
type, severity (info|warning|critical), title, message, is_read, is_resolved,
resolved_at?, created_at
```
Contrainte `UNIQUE (device_id, type) WHERE is_resolved = FALSE` : garantit qu'il n'existe
jamais deux alertes ouvertes du même type pour un appareil (upsert atomique via `ON CONFLICT`).

> Les tables `password_reset_tokens`, `login_attempts`, `predictions`, `notifications` et
> `audit_logs` complètent le schéma opérationnel — voir le DDL pour le détail complet.

### Schémas du lakehouse (`bronze` / `silver` / `gold`)

Voir la section [Pipeline Big Data](#pipeline-big-data--lakehouse-bronzesilvergold-n8n) ci-dessous.

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
              Dat'Agro API → PostgreSQL (opérationnel + Bronze)
                                 │
                                 ▼
        Dashboard / Alertes / Prédictions IA   +   pipeline n8n Bronze→Silver→Gold
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
[`hardware/raspberry_gateway_example.py`](hardware/raspberry_gateway_example.py). Il utilise
[`hardware/gateway_buffer.py`](hardware/gateway_buffer.py) (`BufferedSender`) pour bufferiser
localement les relevés en cas de coupure réseau (le Pi4 étant le seul point connecté à Internet)
et les renvoyer automatiquement à la reconnexion.

> **Prédictions IA** : `_compute_predictions` dans `backend/server.py` est aujourd'hui un moteur
> de règles/seuils simple, pas un modèle entraîné. Une fois le pipeline lakehouse ci-dessous en
> production et des données réelles accumulées dans `gold.plot_features`, cette fonction est le
> point d'entrée à remplacer par un vrai modèle de prédiction d'humidité.

---

## Pipeline Big Data — Lakehouse Bronze/Silver/Gold (n8n)

Chaque relevé accepté (manuel ou via la passerelle matérielle) est capturé une seconde fois,
brut, dans une architecture médaillon PostgreSQL orchestrée par **n8n** — le cœur du pipeline Big
Data du projet, indépendant de l'affichage temps réel du dashboard (qui continue de lire les
tables opérationnelles).

```
POST /api/readings ou /api/ingest/batch
              │
              ▼
   sensor_readings (opérationnel)  +  bronze.sensor_ingestions (capture brute JSONB)
                                              │
                                   n8n: Agro_Bronze_to_Silver (toutes les 2 min)
                                   → normalisation, détection d'anomalies (plages plausibles)
                                              ▼
                                   silver.sensor_readings_clean (typé, dédupliqué, flagué)
                                              │
                                   n8n: Agro_Silver_to_Gold (toutes les heures)
                                   → agrégats SQL (fenêtres, LAG, moyennes glissantes)
                                              ▼
                     gold.plot_hourly_agg / gold.plot_daily_agg / gold.plot_features
                                              │
                                              ▼
                          Point d'extension : futur modèle de prédiction d'humidité
```

### Couches

- **Bronze** (`bronze.sensor_ingestions`) : capture brute immuable, appareil validé mais valeurs
  non vérifiées. Alimentée directement par `_ingest_reading()` dans `backend/server.py`, dans la
  même transaction que l'écriture opérationnelle.
- **Silver** (`silver.sensor_readings_clean`) : données typées, dédupliquées
  (`UNIQUE(device_id, reading_ts)`), enrichies par jointure avec `devices`/`plots`/`farms`, avec
  détection d'anomalies (`is_outlier`/`outlier_reason` sur des plages plausibles par capteur — les
  valeurs suspectes sont conservées et flaguées, jamais supprimées silencieusement).
- **Gold** (`gold.plot_hourly_agg`, `gold.plot_daily_agg`, `gold.plot_features`) : agrégats par
  parcelle et table de features "ML-ready" (moyennes glissantes, valeurs décalées `LAG`) — le point
  d'entrée pour un futur modèle de prédiction.

DDL complet : [`pipeline/schema/bronze.sql`](pipeline/schema/bronze.sql),
[`silver.sql`](pipeline/schema/silver.sql), [`gold.sql`](pipeline/schema/gold.sql).

### Workflows n8n

Exportés en JSON dans [`pipeline/n8n_workflows/`](pipeline/n8n_workflows/), à importer dans n8n
(**Workflows → Import from File**) puis activer :

| Workflow | Déclencheur | Rôle |
|----------|-------------|------|
| `Agro_Bronze_to_Silver.json` | Toutes les 2 min | Sélectionne le Bronze non traité, normalise/valide (nœud Code), upsert vers Silver, marque comme traité |
| `Agro_Silver_to_Gold.json` | Toutes les heures | Agrège Silver → `plot_hourly_agg`, reconstruit `plot_features` par fonctions fenêtres SQL |

Les deux workflows utilisent un credential Postgres nommé pointant vers `datagro_db` (à recréer
dans n8n après import — **Credentials → New → Postgres**, avec les mêmes identifiants que
`DATABASE_URL`).

### Vérifier que le pipeline tourne

```sql
-- Combien de lignes Bronze en attente de traitement ?
SELECT COUNT(*) FROM bronze.sensor_ingestions WHERE processed = FALSE;

-- Le Silver se peuple-t-il ?
SELECT COUNT(*), MAX(reading_ts) FROM silver.sensor_readings_clean;

-- Le Gold se peuple-t-il ?
SELECT * FROM gold.plot_hourly_agg ORDER BY hour_utc DESC LIMIT 5;
```

---

## Simulateur de nœuds LoRa

Le matériel réel (Système A) n'étant pas encore assemblé, un simulateur permet de développer et
démontrer tout le pipeline dès maintenant : [`hardware/lora_node_simulator.py`](hardware/lora_node_simulator.py).

Il réutilise **exactement le même contrat HTTP** que la passerelle réelle (`X-Gateway-Key`,
`POST /api/ingest/batch`, tampon local via `gateway_buffer.BufferedSender`) — passer du simulateur
au vrai matériel plus tard ne demande donc aucun changement backend.

```bash
cd hardware

# 1re fois : crée une ferme/parcelle/appareils de démo via l'API (idempotent)
python lora_node_simulator.py --bootstrap --nodes 4

# Simulation en temps réel
python lora_node_simulator.py

# Générer rapidement plusieurs jours d'historique (temps accéléré)
python lora_node_simulator.py --time-scale 120

# Déclencher un événement de pluie en direct (autre terminal, sur l'instance en cours)
python lora_node_simulator.py --trigger-rain
```

Modèle synthétique par nœud : cycles diurnes (température/luminosité), humidité du sol avec
évapotranspiration + événements de pluie stochastiques, dérive lente NPK avec fertilisations
rares, pH quasi stable, dérive de calibration par capteur, décrochages LoRa occasionnels.

---

## Structure du projet

```
Data-Agro-Plateforme/
├── backend/
│   ├── server.py                    # Application FastAPI, routes, logique métier
│   ├── db.py                        # Pool asyncpg, sérialisation, helpers SQL
│   ├── db/
│   │   └── schema_operational.sql   # DDL du schéma opérationnel (users, farms, ...)
│   ├── requirements.txt             # Dépendances Python
│   ├── .env.example                 # Gabarit des variables d'environnement
│   └── tests/
│       └── test_datagro.py          # Tests pytest E2E backend
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
├── pipeline/
│   ├── schema/
│   │   ├── bronze.sql               # Capture brute
│   │   ├── silver.sql               # Données nettoyées/dédupliquées
│   │   └── gold.sql                 # Agrégats + features ML-ready
│   └── n8n_workflows/
│       ├── Agro_Bronze_to_Silver.json
│       └── Agro_Silver_to_Gold.json
│
├── hardware/
│   ├── raspberry_gateway_example.py # Gabarit de passerelle LoRa → API (vrai matériel)
│   ├── gateway_buffer.py            # Tampon local résilient (BufferedSender)
│   └── lora_node_simulator.py       # Simulateur de nœuds ESP32/LoRa
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
3. Configurer une instance PostgreSQL managée (ou auto-hébergée) et son `DATABASE_URL`
4. Héberger n8n (Docker recommandé) et republier les workflows du pipeline avec le credential
   Postgres de production
5. `CORS_ORIGINS` = domaine de production uniquement
6. HTTPS obligatoire

---

*Dat'Agro — Vers une agriculture connectée et intelligente*
