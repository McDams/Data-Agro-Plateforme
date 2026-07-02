#!/usr/bin/env python3
"""
Gabarit de passerelle Dat'Agro pour Raspberry Pi 4.

Rôle : le Pi4 est le seul point du réseau de capteurs connecté à Internet. Il reçoit en LoRa
les trames envoyées par chaque nœud ESP32 (NPK, pH, humidité/température ambiante, humidité du
sol, luminosité), les agrège, puis les transmet par lot à l'API Dat'Agro toutes les
GATEWAY_INTERVAL_SECONDS.

Ce script ne contient AUCUNE dépendance LoRa réelle (ex: pyLoRa / SX127x) — c'est un gabarit
à brancher sur votre code de réception LoRa existant. Remplacez `read_lora_frames()` par votre
propre logique de lecture du module LoRa du Pi4, qui doit renvoyer une liste de dicts au format
attendu par `POST /api/ingest/batch` (voir README.md, section "Intégration matérielle").

Prérequis :
  - Chaque nœud ESP32 doit déjà être enregistré comme "Appareil" sur la plateforme
    (page Appareils), avec un `device_uid` unique correspondant à celui envoyé en LoRa.
  - Une clé de passerelle doit avoir été générée pour l'exploitation concernée
    (page Exploitations → Passerelle IoT → Générer une clé), et placée dans GATEWAY_KEY ci-dessous
    (ou en variable d'environnement, recommandé).

Usage :
  GATEWAY_KEY=gw_xxxxxxxxxxxxxxxxxxxxxxxx API_BASE_URL=https://votre-domaine/api python3 raspberry_gateway_example.py
"""
import os
import time
import logging

import requests

from gateway_buffer import BufferedSender

API_BASE_URL = os.environ.get("API_BASE_URL", "http://localhost:8001/api")
GATEWAY_KEY = os.environ["GATEWAY_KEY"]
GATEWAY_INTERVAL_SECONDS = int(os.environ.get("GATEWAY_INTERVAL_SECONDS", "60"))
BUFFER_PATH = os.environ.get("GATEWAY_BUFFER_PATH", "buffer.jsonl")

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("datagro-gateway")

SESSION = requests.Session()
SESSION.headers.update({"X-Gateway-Key": GATEWAY_KEY, "Content-Type": "application/json"})
SENDER = BufferedSender(SESSION, API_BASE_URL, BUFFER_PATH)


def read_lora_frames() -> list[dict]:
    """
    À REMPLACER par votre lecture réelle du module LoRa (ex: SX127x sur SPI).

    Doit renvoyer une liste de relevés, un par nœud reçu depuis le dernier appel, au format :
      {
        "device_uid": "esp32-parcelle3-01",   # doit correspondre à l'appareil enregistré
        "soil_moisture": 42.3,                # %  (optionnel selon les capteurs du nœud)
        "soil_temperature": 21.5,             # °C (optionnel)
        "air_temperature": 27.8,              # °C (optionnel)
        "air_humidity": 55.0,                 # %  (optionnel)
        "luminosity": 12000,                  # lux (optionnel)
        "soil_nitrogen": 38.0,                # mg/kg (optionnel)
        "soil_phosphorus": 22.0,               # mg/kg (optionnel)
        "soil_potassium": 180.0,               # mg/kg (optionnel)
        "ph": 6.4,                             # optionnel
        "conductivity": 1.2,                   # optionnel
      }
    Seul `device_uid` est obligatoire ; n'incluez que les capteurs réellement présents sur le nœud.
    """
    raise NotImplementedError(
        "Branchez ici la lecture de votre module LoRa (ex: pyLoRa/SX127x) et la décodification "
        "des trames envoyées par vos nœuds ESP32."
    )


def main():
    logger.info("Passerelle Dat'Agro démarrée (intervalle=%ds, API=%s, tampon=%s)",
                GATEWAY_INTERVAL_SECONDS, API_BASE_URL, BUFFER_PATH)
    while True:
        try:
            readings = read_lora_frames()
            SENDER.send_batch(readings)
        except Exception:
            logger.exception("Erreur inattendue lors du cycle de lecture LoRa")
        time.sleep(GATEWAY_INTERVAL_SECONDS)


if __name__ == "__main__":
    main()
