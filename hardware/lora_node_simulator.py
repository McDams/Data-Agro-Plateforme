#!/usr/bin/env python3
"""
Simulateur de nœuds LoRa Dat'Agro (ESP32 + module LoRa + DHT22 + capteur de luminosité +
capteur NPK/pH). Sert à développer et démontrer tout le pipeline (ingestion → Bronze →
Silver → Gold) avant que le matériel réel (Système A) ne soit assemblé.

Ce script réutilise exactement le même contrat HTTP que la passerelle Raspberry Pi réelle
(`raspberry_gateway_example.py`) : header X-Gateway-Key, POST /api/ingest/batch, tampon
local via gateway_buffer.BufferedSender. Passer du simulateur au vrai matériel plus tard
ne demande donc aucun changement côté backend.

Usage :
  # 1. Première fois : crée une ferme/parcelle/appareils de démo via l'API
  python lora_node_simulator.py --bootstrap --nodes 4

  # 2. Lancer la simulation (réutilise l'état créé au bootstrap)
  python lora_node_simulator.py --interval 60

  # 3. Générer rapidement plusieurs jours d'historique (temps accéléré x120 = 1s réelle ≈ 2min simulées)
  python lora_node_simulator.py --time-scale 120

  # 4. Déclencher un événement de pluie en direct sur l'instance en cours (autre terminal)
  python lora_node_simulator.py --trigger-rain
  python lora_node_simulator.py --trigger-rain sim-esp32-01
"""
import argparse
import json
import logging
import math
import os
import random
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

import requests

from gateway_buffer import BufferedSender

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("datagro-simulator")

STATE_FILE = Path(__file__).parent / ".simulator_state.json"
CONTROL_FILE = Path(__file__).parent / ".simulator_trigger_rain"
SENSOR_TYPES = ["soil_moisture", "soil_temperature", "air_temperature", "air_humidity",
                "luminosity", "soil_nitrogen", "soil_phosphorus", "soil_potassium",
                "ph", "conductivity"]
DEMO_EMAIL = os.environ.get("SIMULATOR_EMAIL", "simulateur@datagro.com")
DEMO_PASSWORD = os.environ.get("SIMULATOR_PASSWORD", "SimulateurDemo2024!")
RAIN_EVENT_AVG_DAYS = 4  # ~1 événement de pluie tous les 3-5 jours simulés


# ─── Bootstrap (via l'API HTTP authentifiée — pas d'accès direct à la DB) ─────
def bootstrap(api_base: str, n_nodes: int) -> dict:
    s = requests.Session()
    r = s.post(f"{api_base}/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD})
    if r.status_code != 200:
        r = s.post(f"{api_base}/auth/register", json={
            "first_name": "Simulateur", "last_name": "LoRa",
            "email": DEMO_EMAIL, "password": DEMO_PASSWORD,
            "farm_name": "Ferme de simulation",
        })
        r.raise_for_status()
    token = r.json()["access_token"]
    s.headers.update({"Authorization": f"Bearer {token}"})

    r = s.post(f"{api_base}/farms", json={
        "name": "Ferme de simulation LoRa", "location": "Simulation",
        "description": "Exploitation générée par lora_node_simulator.py pour les besoins du mémoire.",
    })
    r.raise_for_status()
    farm = r.json()

    r = s.post(f"{api_base}/farms/{farm['id']}/gateway-key")
    r.raise_for_status()
    gateway_key = r.json()["gateway_key"]

    r = s.post(f"{api_base}/plots", json={
        "farm_id": farm["id"], "name": "Parcelle simulée", "crop_type": "Démonstration",
    })
    r.raise_for_status()
    plot = r.json()

    nodes = []
    for i in range(n_nodes):
        device_uid = f"sim-esp32-{i + 1:02d}"
        r = s.post(f"{api_base}/devices", json={
            "farm_id": farm["id"], "plot_id": plot["id"], "name": f"Nœud simulé {i + 1}",
            "device_uid": device_uid, "device_type": "Sonde sol multi-paramètres",
            "sensor_types": SENSOR_TYPES,
        })
        r.raise_for_status()
        nodes.append({"device_uid": device_uid, "plot_id": plot["id"]})

    state = {"farm_id": farm["id"], "plot_id": plot["id"], "gateway_key": gateway_key, "nodes": nodes}
    STATE_FILE.write_text(json.dumps(state, indent=2), encoding="utf-8")
    logger.info("Bootstrap terminé: ferme=%s, %d nœud(s) créé(s), état sauvegardé dans %s",
                farm["id"], len(nodes), STATE_FILE)
    return state


def load_or_bootstrap(args) -> dict:
    if STATE_FILE.exists():
        if args.bootstrap:
            logger.info("État existant trouvé (%s) — réutilisation. Supprimez ce fichier pour forcer "
                        "un nouveau bootstrap.", STATE_FILE)
        return json.loads(STATE_FILE.read_text(encoding="utf-8"))
    return bootstrap(args.api_base, args.nodes)


# ─── Modèle synthétique par nœud ────────────────────────────────────────────
def diurnal(hour_frac: float, base: float, amplitude: float, peak_hour: float = 14) -> float:
    return base + amplitude * math.cos(2 * math.pi * (hour_frac - peak_hour) / 24)


def luminosity_curve(hour_frac: float, cloudiness: float) -> float:
    """cloudiness: 0 (ciel très couvert) .. 1 (ciel clair)."""
    if hour_frac < 6 or hour_frac > 20:
        return 0.0
    x = (hour_frac - 6) / 14.0
    shape = math.sin(x * math.pi)  # 0 -> 1 -> 0 entre 6h et 20h
    peak = 20000 + 80000 * cloudiness
    return max(0.0, shape * peak)


class SimulatedNode:
    def __init__(self, device_uid: str, plot_id: str, seed: int):
        self.device_uid = device_uid
        self.plot_id = plot_id
        self.rng = random.Random(seed)
        self.soil_moisture = self.rng.uniform(40, 65)
        self.ph = self.rng.uniform(6.0, 7.0)
        self.n = self.rng.uniform(30, 55)
        self.p = self.rng.uniform(15, 35)
        self.k = self.rng.uniform(120, 200)
        self.conductivity = self.rng.uniform(0.8, 1.8)
        # Dérive de calibration lente et bornée par capteur (simule un capteur mal calibré).
        self.drift = {k: 0.0 for k in ("soil_moisture", "soil_temperature", "air_temperature", "air_humidity")}
        self.days_since_fertilization = self.rng.uniform(0, 15)
        self.online = True

    def tick(self, sim_time: datetime, dt_hours: float, cloudiness: float, rain_now: bool) -> dict | None:
        # Décrochage occasionnel du nœud (perte de trame LoRa) — probabilité faible par tick.
        if self.rng.random() < 0.02:
            return None

        hour_frac = sim_time.hour + sim_time.minute / 60
        for k in self.drift:
            self.drift[k] = max(-2.0, min(2.0, self.drift[k] + self.rng.uniform(-0.02, 0.02)))

        air_temperature = diurnal(hour_frac, base=18, amplitude=8) + self.rng.gauss(0, 0.6) + self.drift["air_temperature"]
        air_humidity = max(20.0, min(95.0, 70 - (air_temperature - 18) * 2 + self.rng.gauss(0, 3) + self.drift["air_humidity"]))
        soil_temperature = air_temperature - 3 + self.rng.gauss(0, 0.3) + self.drift["soil_temperature"]
        luminosity = luminosity_curve(hour_frac, cloudiness) * self.rng.uniform(0.9, 1.1)

        # Humidité du sol : évapotranspiration ∝ température/luminosité, reset par la pluie.
        evap = 0.15 * dt_hours * (1 + max(0.0, air_temperature - 18) / 20) * (1 + luminosity / 100000)
        self.soil_moisture = max(5.0, self.soil_moisture - evap)
        if rain_now:
            self.soil_moisture = min(95.0, self.soil_moisture + self.rng.uniform(15, 40))

        # NPK : décroissance lente, sursaut lors d'un événement de fertilisation rare.
        decay = 0.01 * dt_hours
        self.n = max(5.0, self.n - decay * self.rng.uniform(0.5, 1.5))
        self.p = max(2.0, self.p - decay * self.rng.uniform(0.3, 1.0))
        self.k = max(20.0, self.k - decay * self.rng.uniform(0.5, 1.5))
        self.days_since_fertilization += dt_hours / 24
        if self.days_since_fertilization > self.rng.uniform(10, 20):
            self.n += self.rng.uniform(15, 30)
            self.p += self.rng.uniform(8, 15)
            self.k += self.rng.uniform(30, 60)
            self.days_since_fertilization = 0.0

        # pH quasi stable, léger fléchissement pendant la pluie.
        self.ph = max(4.5, min(8.5, self.ph + self.rng.uniform(-0.02, 0.02) + (-0.05 if rain_now else 0)))
        self.conductivity = max(0.2, min(5.0, self.conductivity + self.rng.uniform(-0.03, 0.03)))

        return {
            "device_uid": self.device_uid,
            "soil_moisture": round(self.soil_moisture + self.drift["soil_moisture"], 1),
            "soil_temperature": round(soil_temperature, 1),
            "air_temperature": round(air_temperature, 1),
            "air_humidity": round(air_humidity, 1),
            "luminosity": round(luminosity, 0),
            "soil_nitrogen": round(self.n, 1),
            "soil_phosphorus": round(self.p, 1),
            "soil_potassium": round(self.k, 1),
            "ph": round(self.ph, 2),
            "conductivity": round(self.conductivity, 2),
        }


# ─── Boucle principale ───────────────────────────────────────────────────────
def check_rain_trigger(node_uids: set[str]) -> set[str]:
    """Lit le fichier de contrôle écrit par `--trigger-rain` depuis une autre invocation."""
    if not CONTROL_FILE.exists():
        return set()
    target = CONTROL_FILE.read_text(encoding="utf-8").strip()
    CONTROL_FILE.unlink()
    if target == "ALL" or not target:
        logger.info("Pluie déclenchée manuellement sur tous les nœuds")
        return set(node_uids)
    if target in node_uids:
        logger.info("Pluie déclenchée manuellement sur %s", target)
        return {target}
    logger.warning("--trigger-rain: device_uid inconnu (%s)", target)
    return set()


def run_simulation(args, state: dict):
    session = requests.Session()
    session.headers.update({"X-Gateway-Key": state["gateway_key"], "Content-Type": "application/json"})
    sender = BufferedSender(session, args.api_base, args.buffer_path)

    nodes = [SimulatedNode(n["device_uid"], n["plot_id"], seed=i) for i, n in enumerate(state["nodes"])]
    node_uids = {n.device_uid for n in nodes}
    sim_time = datetime.now(timezone.utc)
    cloudiness = random.uniform(0.4, 1.0)

    logger.info("Simulateur démarré: %d nœud(s), intervalle réel=%ds, time-scale=x%d",
                len(nodes), args.interval, args.time_scale)
    while True:
        dt_hours = (args.interval * args.time_scale) / 3600
        sim_time += timedelta(hours=dt_hours)

        cloudiness = max(0.15, min(1.0, cloudiness + random.uniform(-0.05, 0.05)))
        rain_prob = dt_hours / (RAIN_EVENT_AVG_DAYS * 24)
        rain_targets = check_rain_trigger(node_uids)
        if random.random() < rain_prob:
            rain_targets = node_uids
            logger.info("Événement de pluie (aléatoire) à %s", sim_time.isoformat())

        readings = []
        for node in nodes:
            reading = node.tick(sim_time, dt_hours, cloudiness, node.device_uid in rain_targets)
            if reading is not None:
                readings.append(reading)

        sender.send_batch(readings)
        time.sleep(args.interval)


def parse_args():
    p = argparse.ArgumentParser(
        description="Simulateur de nœuds LoRa Dat'Agro (ESP32 + NPK/pH + DHT22 + luminosité).")
    p.add_argument("--bootstrap", action="store_true",
                    help="Crée la ferme/parcelle/appareils de démo via l'API (idempotent).")
    p.add_argument("--nodes", type=int, default=4, help="Nombre de nœuds simulés (défaut: 4).")
    p.add_argument("--interval", type=int, default=60, help="Secondes réelles entre deux envois (défaut: 60).")
    p.add_argument("--time-scale", type=int, default=1,
                    help="Multiplicateur de temps simulé (défaut: 1 = temps réel).")
    p.add_argument("--api-base", default=os.environ.get("API_BASE_URL", "http://localhost:8001/api"))
    p.add_argument("--buffer-path", default="simulator_buffer.jsonl")
    p.add_argument("--trigger-rain", nargs="?", const="ALL", default=None, metavar="DEVICE_UID",
                    help="N'exécute pas de simulation : déclenche un événement de pluie pour l'instance "
                         "en cours (tous les nœuds si aucun device_uid n'est précisé), puis quitte.")
    return p.parse_args()


def main():
    args = parse_args()
    if args.trigger_rain is not None:
        CONTROL_FILE.write_text(args.trigger_rain, encoding="utf-8")
        print(f"Pluie déclenchée pour le prochain cycle "
              f"({'tous les nœuds' if args.trigger_rain == 'ALL' else args.trigger_rain}).")
        return

    state = load_or_bootstrap(args)
    try:
        run_simulation(args, state)
    except KeyboardInterrupt:
        logger.info("Simulateur arrêté.")


if __name__ == "__main__":
    main()
