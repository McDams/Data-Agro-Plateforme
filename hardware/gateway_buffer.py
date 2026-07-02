"""
Tampon local pour la passerelle Dat'Agro — résilience réseau (architecture "hybride").

Si l'envoi vers l'API échoue à cause d'une coupure réseau (le Pi4 est le seul point du
réseau de capteurs connecté à Internet, et cette connexion peut être instable sur le
terrain), les relevés du cycle en cours sont écrits dans un fichier JSONL local et
automatiquement renvoyés — avant les nouveaux relevés — dès que la connexion revient.

Une erreur applicative (ex: clé de passerelle invalide) n'est PAS bufferisée : retenter
ne résoudrait rien tant que la configuration n'est pas corrigée.
"""
import json
import logging
from pathlib import Path

import requests

logger = logging.getLogger("datagro-gateway")


class BufferedSender:
    def __init__(self, session: requests.Session, api_base_url: str, buffer_path: str = "buffer.jsonl"):
        self.session = session
        self.api_base_url = api_base_url.rstrip("/")
        self.buffer_path = Path(buffer_path)

    def _load_buffered(self) -> list[dict]:
        if not self.buffer_path.exists():
            return []
        readings = []
        for line in self.buffer_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line:
                readings.append(json.loads(line))
        return readings

    def _clear_buffer(self):
        if self.buffer_path.exists():
            self.buffer_path.unlink()

    def _append_to_buffer(self, readings: list[dict]):
        with self.buffer_path.open("a", encoding="utf-8") as f:
            for r in readings:
                f.write(json.dumps(r) + "\n")

    def send_batch(self, readings: list[dict]) -> None:
        buffered = self._load_buffered()
        to_send = buffered + readings
        if not to_send:
            return
        try:
            resp = self.session.post(f"{self.api_base_url}/ingest/batch",
                                      json={"readings": to_send}, timeout=15)
            resp.raise_for_status()
        except (requests.exceptions.ConnectionError, requests.exceptions.Timeout) as e:
            logger.warning("Pas de connexion à l'API (%s) — %d relevé(s) mis en tampon local (%s)",
                            e, len(readings), self.buffer_path)
            self._append_to_buffer(readings)
            return
        except requests.exceptions.HTTPError as e:
            logger.error("Erreur API (%s): %s — lot abandonné, vérifiez la configuration (clé de passerelle ?)",
                          e.response.status_code, e.response.text)
            return

        result = resp.json()
        note = f" (dont {len(buffered)} en attente depuis une coupure précédente)" if buffered else ""
        logger.info("Lot envoyé: %d accepté(s), %d rejeté(s)%s",
                     result["accepted"], len(result["rejected"]), note)
        for rej in result["rejected"]:
            logger.warning("Rejeté — device_uid=%s: %s", rej["device_uid"], rej["reason"])
        self._clear_buffer()
