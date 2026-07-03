from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")

import os, secrets, hashlib, logging, uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, List

import bcrypt
import jwt
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response
from starlette.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from db import init_pool, close_pool, get_pool, pg_doc as doc, pg_docs as docs, pg_update

# ─── App ──────────────────────────────────────────────────────────────────────
app = FastAPI(title="Dat'Agro API", version="1.0.0")
api_router = APIRouter(prefix="/api")

# ─── CORS ─────────────────────────────────────────────────────────────────────
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")
_cors_raw = os.environ.get("CORS_ORIGINS", "http://localhost:3000")
CORS_ORIGINS = [o.strip() for o in _cors_raw.split(",") if o.strip() and o.strip() != "*"]
if not CORS_ORIGINS:
    CORS_ORIGINS = [FRONTEND_URL, "http://localhost:3000"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ─── Auth helpers ─────────────────────────────────────────────────────────────
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALG = "HS256"

def hash_password(pwd: str) -> str:
    return bcrypt.hashpw(pwd.encode(), bcrypt.gensalt()).decode()

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())

def create_access_token(uid: str, email: str) -> str:
    p = {"sub": uid, "email": email, "exp": datetime.now(timezone.utc) + timedelta(hours=2), "type": "access"}
    return jwt.encode(p, JWT_SECRET, algorithm=JWT_ALG)

def create_refresh_token(uid: str) -> str:
    p = {"sub": uid, "exp": datetime.now(timezone.utc) + timedelta(days=7), "type": "refresh"}
    return jwt.encode(p, JWT_SECRET, algorithm=JWT_ALG)

def set_cookies(resp: Response, at: str, rt: str):
    resp.set_cookie("access_token", at, httponly=True, secure=False, samesite="lax", max_age=7200, path="/")
    resp.set_cookie("refresh_token", rt, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")

async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "): token = auth[7:]
    if not token:
        raise HTTPException(401, "Non authentifié")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        if payload.get("type") != "access":
            raise HTTPException(401, "Token invalide")
        user = await get_pool().fetchrow("SELECT * FROM users WHERE id = $1", payload["sub"])
        if not user:
            raise HTTPException(401, "Utilisateur introuvable")
        d = doc(user)
        d.pop("password_hash", None)
        return d
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expiré")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Token invalide")

async def require_admin(request: Request) -> dict:
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(403, "Accès administrateur requis")
    return user

async def get_farm_from_gateway_key(request: Request) -> dict:
    """Authenticates a hardware gateway (Raspberry Pi) via the X-Gateway-Key header."""
    key = request.headers.get("X-Gateway-Key")
    if not key:
        raise HTTPException(401, "Clé de passerelle manquante (header X-Gateway-Key)")
    key_hash = hashlib.sha256(key.encode()).hexdigest()
    farm = await get_pool().fetchrow("SELECT * FROM farms WHERE gateway_key_hash = $1", key_hash)
    if not farm:
        raise HTTPException(401, "Clé de passerelle invalide")
    return farm

# ─── Utils ────────────────────────────────────────────────────────────────────
def farm_doc(f) -> dict | None:
    """Like doc(), but never leaks the gateway key hash — only its presence + display prefix."""
    if f is None: return None
    d = doc(f)
    d.pop("gateway_key_hash", None)
    d["has_gateway_key"] = bool(f.get("gateway_key_hash"))
    return d

def farm_docs(lst): return [farm_doc(f) for f in lst]

# ─── Pydantic models ──────────────────────────────────────────────────────────
class RegisterReq(BaseModel):
    first_name: str; last_name: str; email: str; password: str
    phone: Optional[str] = None; farm_name: Optional[str] = None; country: Optional[str] = None

class LoginReq(BaseModel):
    email: str; password: str

class ForgotPwdReq(BaseModel):
    email: str

class ResetPwdReq(BaseModel):
    token: str; new_password: str

class FarmCreate(BaseModel):
    name: str; location: str
    description: Optional[str] = None; total_area: Optional[float] = None

class FarmUpdate(BaseModel):
    name: Optional[str] = None; location: Optional[str] = None
    description: Optional[str] = None; total_area: Optional[float] = None

class PlotCreate(BaseModel):
    farm_id: str; name: str
    location: Optional[str] = None; area: Optional[float] = None
    crop_type: Optional[str] = None; sowing_date: Optional[str] = None
    notes: Optional[str] = None; status: str = "active"

class PlotUpdate(BaseModel):
    name: Optional[str] = None; location: Optional[str] = None
    area: Optional[float] = None; crop_type: Optional[str] = None
    sowing_date: Optional[str] = None; notes: Optional[str] = None; status: Optional[str] = None

class DeviceCreate(BaseModel):
    farm_id: str; name: str; device_uid: str; device_type: str
    plot_id: Optional[str] = None; sensor_types: List[str] = []
    firmware_version: Optional[str] = "1.0.0"; maintenance_notes: Optional[str] = None

class DeviceUpdate(BaseModel):
    name: Optional[str] = None; plot_id: Optional[str] = None
    status: Optional[str] = None; battery_level: Optional[int] = None
    signal_strength: Optional[int] = None; maintenance_notes: Optional[str] = None

class ReadingCreate(BaseModel):
    device_id: str; plot_id: str
    soil_moisture: Optional[float] = None; soil_temperature: Optional[float] = None
    air_temperature: Optional[float] = None; air_humidity: Optional[float] = None
    luminosity: Optional[float] = None; soil_nitrogen: Optional[float] = None
    soil_phosphorus: Optional[float] = None; soil_potassium: Optional[float] = None
    ph: Optional[float] = None; conductivity: Optional[float] = None

class BatchReadingItem(BaseModel):
    device_uid: str
    soil_moisture: Optional[float] = None; soil_temperature: Optional[float] = None
    air_temperature: Optional[float] = None; air_humidity: Optional[float] = None
    luminosity: Optional[float] = None; soil_nitrogen: Optional[float] = None
    soil_phosphorus: Optional[float] = None; soil_potassium: Optional[float] = None
    ph: Optional[float] = None; conductivity: Optional[float] = None

class BatchIngestReq(BaseModel):
    readings: List[BatchReadingItem]

class AlertUpdate(BaseModel):
    is_read: Optional[bool] = None; is_resolved: Optional[bool] = None

class ProfileUpdate(BaseModel):
    first_name: Optional[str] = None; last_name: Optional[str] = None
    phone: Optional[str] = None; farm_name: Optional[str] = None; country: Optional[str] = None

class PasswordChange(BaseModel):
    current_password: str; new_password: str

class UserStatusUpdate(BaseModel):
    status: str  # active, suspended, pending

# ─── Startup ──────────────────────────────────────────────────────────────────
@app.on_event("startup")
async def startup():
    await init_pool()
    pool = get_pool()

    admin_email = os.environ.get("ADMIN_EMAIL", "admin@datagro.com")
    admin_pwd = os.environ.get("ADMIN_PASSWORD", "DatAgro2024!")
    existing = await pool.fetchrow("SELECT * FROM users WHERE email = $1", admin_email)
    if existing is None:
        await pool.execute("""
            INSERT INTO users (first_name, last_name, email, phone, farm_name, country,
                                role, status, password_hash, onboarding_completed)
            VALUES ($1,$2,$3,$4,$5,$6,'admin','active',$7,TRUE)""",
            "Admin", "Dat'Agro", admin_email, "+33 1 00 00 00 00", "Dat'Agro Platform", "France",
            hash_password(admin_pwd))
    elif not verify_password(admin_pwd, existing["password_hash"]):
        await pool.execute("UPDATE users SET password_hash = $1, updated_at = now() WHERE email = $2",
                            hash_password(admin_pwd), admin_email)

@app.on_event("shutdown")
async def shutdown():
    await close_pool()

# ─── AUTH ─────────────────────────────────────────────────────────────────────
@api_router.post("/auth/register")
async def register(data: RegisterReq, response: Response):
    email = data.email.lower().strip()
    pool = get_pool()
    if await pool.fetchrow("SELECT id FROM users WHERE email = $1", email):
        raise HTTPException(400, "Cet email est déjà utilisé")
    row = await pool.fetchrow("""
        INSERT INTO users (first_name, last_name, email, phone, farm_name, country,
                            role, status, password_hash, onboarding_completed)
        VALUES ($1,$2,$3,$4,$5,$6,'farmer','active',$7,FALSE) RETURNING id""",
        data.first_name, data.last_name, email, data.phone, data.farm_name, data.country,
        hash_password(data.password))
    uid = str(row["id"])
    at = create_access_token(uid, email)
    rt = create_refresh_token(uid)
    set_cookies(response, at, rt)
    return {"id": uid, "first_name": data.first_name, "last_name": data.last_name,
            "email": email, "role": "farmer", "status": "active",
            "onboarding_completed": False, "farm_name": data.farm_name,
            "access_token": at, "refresh_token": rt}

@api_router.post("/auth/login")
async def login(data: LoginReq, request: Request, response: Response):
    email = data.email.lower().strip()
    ip = request.client.host if request.client else "unknown"
    key = f"{ip}:{email}"
    pool = get_pool()
    att = await pool.fetchrow("SELECT * FROM login_attempts WHERE identifier = $1", key)
    if att and att["count"] >= 5:
        if (datetime.now(timezone.utc) - att["last_attempt"]).total_seconds() < 900:
            raise HTTPException(429, "Trop de tentatives. Réessayez dans 15 minutes.")
        await pool.execute("DELETE FROM login_attempts WHERE identifier = $1", key)

    user = await pool.fetchrow("SELECT * FROM users WHERE email = $1", email)
    if not user or not verify_password(data.password, user["password_hash"]):
        await pool.execute("""
            INSERT INTO login_attempts (identifier, count, last_attempt) VALUES ($1,1,now())
            ON CONFLICT (identifier) DO UPDATE SET count = login_attempts.count + 1, last_attempt = now()""", key)
        raise HTTPException(401, "Email ou mot de passe incorrect")
    if user["status"] == "suspended":
        raise HTTPException(403, "Compte suspendu. Contactez l'administrateur.")
    await pool.execute("DELETE FROM login_attempts WHERE identifier = $1", key)
    uid = str(user["id"])
    at = create_access_token(uid, email)
    rt = create_refresh_token(uid)
    set_cookies(response, at, rt)
    return {"id": uid, "first_name": user["first_name"], "last_name": user["last_name"],
            "email": user["email"], "role": user["role"],
            "status": user["status"], "onboarding_completed": user["onboarding_completed"],
            "farm_name": user["farm_name"], "phone": user["phone"], "country": user["country"],
            "access_token": at, "refresh_token": rt}

@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"message": "Déconnecté"}

@api_router.get("/auth/me")
async def me(request: Request):
    return await get_current_user(request)

@api_router.post("/auth/refresh")
async def refresh(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = request.headers.get("X-Refresh-Token", "")
        token = request.headers.get("X-Refresh-Token", "") or token
    if not token: raise HTTPException(401, "Token manquant")
    try:
        p = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        if p.get("type") != "refresh": raise HTTPException(401, "Token invalide")
        user = await get_pool().fetchrow("SELECT * FROM users WHERE id = $1", p["sub"])
        if not user: raise HTTPException(401, "Utilisateur introuvable")
        at = create_access_token(p["sub"], user["email"])
        response.set_cookie("access_token", at,
                            httponly=True, secure=False, samesite="lax", max_age=7200, path="/")
        return {"message": "Token rafraîchi", "access_token": at}
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Token invalide")

@api_router.post("/auth/forgot-password")
async def forgot_password(data: ForgotPwdReq):
    email = data.email.lower().strip()
    pool = get_pool()
    user = await pool.fetchrow("SELECT id FROM users WHERE email = $1", email)
    if user:
        token = secrets.token_urlsafe(32)
        await pool.execute("""
            INSERT INTO password_reset_tokens (token, user_id, email, expires_at, used)
            VALUES ($1,$2,$3,$4,FALSE)""",
            token, user["id"], email, datetime.now(timezone.utc) + timedelta(hours=1))
        logger.info(f"[RESET] /reinitialiser-mot-de-passe?token={token}")
    return {"message": "Si l'email existe, un lien de réinitialisation vous a été envoyé"}

@api_router.post("/auth/reset-password")
async def reset_password(data: ResetPwdReq):
    pool = get_pool()
    t = await pool.fetchrow("SELECT * FROM password_reset_tokens WHERE token = $1 AND used = FALSE", data.token)
    if not t or t["expires_at"] < datetime.now(timezone.utc):
        raise HTTPException(400, "Token invalide ou expiré")
    await pool.execute("UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2",
        hash_password(data.new_password), t["user_id"])
    await pool.execute("UPDATE password_reset_tokens SET used = TRUE WHERE token = $1", data.token)
    return {"message": "Mot de passe réinitialisé"}

# ─── FARMS ────────────────────────────────────────────────────────────────────
@api_router.get("/farms")
async def get_farms(request: Request):
    u = await get_current_user(request)
    pool = get_pool()
    if u["role"] == "admin":
        rows = await pool.fetch("SELECT * FROM farms ORDER BY created_at DESC LIMIT 200")
    else:
        rows = await pool.fetch("SELECT * FROM farms WHERE owner_id = $1 ORDER BY created_at DESC LIMIT 200", u["id"])
    return farm_docs(rows)

@api_router.post("/farms")
async def create_farm(data: FarmCreate, request: Request):
    u = await get_current_user(request)
    uid = u["id"]
    row = await get_pool().fetchrow("""
        INSERT INTO farms (name, location, description, total_area, owner_id)
        VALUES ($1,$2,$3,$4,$5) RETURNING *""",
        data.name, data.location, data.description, data.total_area, uid)
    await _audit(uid, "create_farm", "farm", str(row["id"]))
    return farm_doc(row)

@api_router.get("/farms/{fid}")
async def get_farm(fid: str, request: Request):
    u = await get_current_user(request)
    pool = get_pool()
    if u["role"] == "admin":
        f = await pool.fetchrow("SELECT * FROM farms WHERE id = $1", fid)
    else:
        f = await pool.fetchrow("SELECT * FROM farms WHERE id = $1 AND owner_id = $2", fid, u["id"])
    if not f: raise HTTPException(404, "Exploitation introuvable")
    return farm_doc(f)

@api_router.put("/farms/{fid}")
async def update_farm(fid: str, data: FarmUpdate, request: Request):
    u = await get_current_user(request)
    pool = get_pool()
    async with pool.acquire() as conn:
        if u["role"] == "admin":
            f = await conn.fetchrow("SELECT id FROM farms WHERE id = $1", fid)
        else:
            f = await conn.fetchrow("SELECT id FROM farms WHERE id = $1 AND owner_id = $2", fid, u["id"])
        if not f: raise HTTPException(404, "Exploitation introuvable")
        await pg_update(conn, "farms", fid, data.model_dump(exclude_unset=True))
        updated = await conn.fetchrow("SELECT * FROM farms WHERE id = $1", fid)
    return farm_doc(updated)

@api_router.post("/farms/{fid}/gateway-key")
async def generate_gateway_key(fid: str, request: Request):
    u = await get_current_user(request)
    pool = get_pool()
    if u["role"] == "admin":
        farm = await pool.fetchrow("SELECT id FROM farms WHERE id = $1", fid)
    else:
        farm = await pool.fetchrow("SELECT id FROM farms WHERE id = $1 AND owner_id = $2", fid, u["id"])
    if not farm: raise HTTPException(404, "Exploitation introuvable")
    raw_key = "gw_" + secrets.token_urlsafe(24)
    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
    await pool.execute("""
        UPDATE farms SET gateway_key_hash = $1, gateway_key_prefix = $2, updated_at = now() WHERE id = $3""",
        key_hash, raw_key[:11], fid)
    await _audit(u["id"], "generate_gateway_key", "farm", fid)
    return {"gateway_key": raw_key,
            "warning": "Cette clé ne sera plus jamais affichée en clair. Notez-la maintenant et configurez-la sur votre passerelle Raspberry Pi."}

@api_router.delete("/farms/{fid}")
async def delete_farm(fid: str, request: Request):
    u = await get_current_user(request)
    pool = get_pool()
    if u["role"] == "admin":
        result = await pool.execute("DELETE FROM farms WHERE id = $1", fid)
    else:
        result = await pool.execute("DELETE FROM farms WHERE id = $1 AND owner_id = $2", fid, u["id"])
    if result == "DELETE 0": raise HTTPException(404, "Exploitation introuvable")
    return {"message": "Exploitation supprimée"}

# ─── PLOTS ────────────────────────────────────────────────────────────────────
@api_router.get("/plots")
async def get_plots(request: Request, farm_id: Optional[str] = None):
    u = await get_current_user(request)
    pool = get_pool()
    conds, params = [], []
    if u["role"] != "admin":
        params.append(u["id"]); conds.append(f"owner_id = ${len(params)}")
    if farm_id:
        params.append(farm_id); conds.append(f"farm_id = ${len(params)}")
    where = f"WHERE {' AND '.join(conds)}" if conds else ""
    rows = await pool.fetch(f"SELECT * FROM plots {where} ORDER BY created_at DESC LIMIT 500", *params)
    return docs(rows)

@api_router.post("/plots")
async def create_plot(data: PlotCreate, request: Request):
    u = await get_current_user(request)
    uid = u["id"]
    pool = get_pool()
    if u["role"] != "admin":
        farm = await pool.fetchrow("SELECT id FROM farms WHERE id = $1 AND owner_id = $2", data.farm_id, uid)
        if not farm: raise HTTPException(403, "Accès refusé à cette exploitation")
    row = await pool.fetchrow("""
        INSERT INTO plots (farm_id, owner_id, name, location, area, crop_type, sowing_date, notes, status)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *""",
        data.farm_id, uid, data.name, data.location, data.area, data.crop_type,
        data.sowing_date, data.notes, data.status)
    return doc(row)

@api_router.get("/plots/{pid}")
async def get_plot(pid: str, request: Request):
    u = await get_current_user(request)
    pool = get_pool()
    if u["role"] == "admin":
        p = await pool.fetchrow("SELECT * FROM plots WHERE id = $1", pid)
    else:
        p = await pool.fetchrow("SELECT * FROM plots WHERE id = $1 AND owner_id = $2", pid, u["id"])
    if not p: raise HTTPException(404, "Parcelle introuvable")
    return doc(p)

@api_router.put("/plots/{pid}")
async def update_plot(pid: str, data: PlotUpdate, request: Request):
    u = await get_current_user(request)
    pool = get_pool()
    async with pool.acquire() as conn:
        if u["role"] == "admin":
            p = await conn.fetchrow("SELECT id FROM plots WHERE id = $1", pid)
        else:
            p = await conn.fetchrow("SELECT id FROM plots WHERE id = $1 AND owner_id = $2", pid, u["id"])
        if not p: raise HTTPException(404, "Parcelle introuvable")
        # Note: unlike farms, plot updates don't filter out None — a field can be explicitly nulled.
        fields = data.model_dump(exclude_unset=True)
        if fields:
            set_clause = ", ".join(f"{k} = ${i + 2}" for i, k in enumerate(fields))
            await conn.execute(f"UPDATE plots SET {set_clause}, updated_at = now() WHERE id = $1",
                                pid, *fields.values())
        updated = await conn.fetchrow("SELECT * FROM plots WHERE id = $1", pid)
    return doc(updated)

@api_router.delete("/plots/{pid}")
async def delete_plot(pid: str, request: Request):
    u = await get_current_user(request)
    pool = get_pool()
    if u["role"] == "admin":
        result = await pool.execute("DELETE FROM plots WHERE id = $1", pid)
    else:
        result = await pool.execute("DELETE FROM plots WHERE id = $1 AND owner_id = $2", pid, u["id"])
    if result == "DELETE 0": raise HTTPException(404, "Parcelle introuvable")
    return {"message": "Parcelle supprimée"}

# ─── DEVICES ──────────────────────────────────────────────────────────────────
@api_router.get("/devices")
async def get_devices(request: Request, farm_id: Optional[str] = None, plot_id: Optional[str] = None):
    u = await get_current_user(request)
    pool = get_pool()
    conds, params = [], []
    if u["role"] != "admin":
        params.append(u["id"]); conds.append(f"owner_id = ${len(params)}")
    if farm_id:
        params.append(farm_id); conds.append(f"farm_id = ${len(params)}")
    if plot_id:
        params.append(plot_id); conds.append(f"plot_id = ${len(params)}")
    where = f"WHERE {' AND '.join(conds)}" if conds else ""
    rows = await pool.fetch(f"SELECT * FROM devices {where} ORDER BY created_at DESC LIMIT 500", *params)
    return docs(rows)

@api_router.post("/devices")
async def create_device(data: DeviceCreate, request: Request):
    u = await get_current_user(request)
    uid = u["id"]
    pool = get_pool()
    if await pool.fetchrow("SELECT id FROM devices WHERE device_uid = $1", data.device_uid):
        raise HTTPException(400, "Cet identifiant d'appareil est déjà utilisé")
    row = await pool.fetchrow("""
        INSERT INTO devices (farm_id, plot_id, owner_id, name, device_uid, device_type, sensor_types,
                              status, battery_level, signal_strength, firmware_version, maintenance_notes)
        VALUES ($1,$2,$3,$4,$5,$6,$7,'offline',100,0,$8,$9) RETURNING *""",
        data.farm_id, data.plot_id, uid, data.name, data.device_uid, data.device_type,
        data.sensor_types, data.firmware_version, data.maintenance_notes)
    return doc(row)

@api_router.get("/devices/{did}")
async def get_device(did: str, request: Request):
    u = await get_current_user(request)
    pool = get_pool()
    if u["role"] == "admin":
        d = await pool.fetchrow("SELECT * FROM devices WHERE id = $1", did)
    else:
        d = await pool.fetchrow("SELECT * FROM devices WHERE id = $1 AND owner_id = $2", did, u["id"])
    if not d: raise HTTPException(404, "Appareil introuvable")
    return doc(d)

@api_router.put("/devices/{did}")
async def update_device(did: str, data: DeviceUpdate, request: Request):
    u = await get_current_user(request)
    pool = get_pool()
    async with pool.acquire() as conn:
        if u["role"] == "admin":
            d = await conn.fetchrow("SELECT id FROM devices WHERE id = $1", did)
        else:
            d = await conn.fetchrow("SELECT id FROM devices WHERE id = $1 AND owner_id = $2", did, u["id"])
        if not d: raise HTTPException(404, "Appareil introuvable")
        # Note: like plots, device updates don't filter out None.
        fields = data.model_dump(exclude_unset=True)
        if fields:
            set_clause = ", ".join(f"{k} = ${i + 2}" for i, k in enumerate(fields))
            await conn.execute(f"UPDATE devices SET {set_clause}, updated_at = now() WHERE id = $1",
                                did, *fields.values())
        updated = await conn.fetchrow("SELECT * FROM devices WHERE id = $1", did)
    return doc(updated)

@api_router.delete("/devices/{did}")
async def delete_device(did: str, request: Request):
    u = await get_current_user(request)
    pool = get_pool()
    if u["role"] == "admin":
        result = await pool.execute("DELETE FROM devices WHERE id = $1", did)
    else:
        result = await pool.execute("DELETE FROM devices WHERE id = $1 AND owner_id = $2", did, u["id"])
    if result == "DELETE 0": raise HTTPException(404, "Appareil introuvable")
    return {"message": "Appareil supprimé"}

# ─── SENSOR READINGS ──────────────────────────────────────────────────────────
@api_router.get("/readings")
async def get_readings(request: Request, device_id: Optional[str] = None,
                       plot_id: Optional[str] = None, limit: int = 100, hours: int = 48):
    u = await get_current_user(request)
    pool = get_pool()
    since = datetime.now(timezone.utc) - timedelta(hours=hours)
    conds, params = ["owner_id = $1", '"timestamp" >= $2'], [u["id"], since]
    if device_id:
        params.append(device_id); conds.append(f"device_id = ${len(params)}")
    if plot_id:
        params.append(plot_id); conds.append(f"plot_id = ${len(params)}")
    params.append(limit)
    rows = await pool.fetch(
        f'SELECT * FROM sensor_readings WHERE {" AND ".join(conds)} ORDER BY "timestamp" DESC LIMIT ${len(params)}',
        *params)
    return docs(rows)

@api_router.post("/readings")
async def create_reading(data: ReadingCreate, request: Request):
    u = await get_current_user(request)
    uid = u["id"]
    now = datetime.now(timezone.utc)
    values = {k: v for k, v in data.model_dump().items() if k not in ("device_id", "plot_id")}
    reading = await _ingest_reading(uid, data.device_id, data.plot_id, values, now,
                                     source="manual_api", batch_id=uuid.uuid4())
    return doc(reading)

async def _ingest_reading(owner_id, device_id, plot_id, values: dict, now: datetime,
                           source: str, batch_id):
    """Shared by the manual /readings endpoint (JWT) and the hardware /ingest/batch endpoint (gateway key).
    Also dual-writes to bronze.sensor_ingestions (Bronze layer of the lakehouse pipeline) — the
    raw capture happens here, after device_uid validation but before any sensor-value validation,
    which Silver (n8n) is responsible for."""
    reading = {k: v for k, v in values.items() if v is not None}
    cols = ["device_id", "plot_id", "owner_id", '"timestamp"'] + list(reading.keys())
    placeholders = [f"${i + 1}" for i in range(len(cols))]
    vals = [device_id, plot_id, owner_id, now] + list(reading.values())
    pool = get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            row = await conn.fetchrow(
                f"INSERT INTO sensor_readings ({', '.join(cols)}) VALUES ({', '.join(placeholders)}) RETURNING *",
                *vals)
            await conn.execute(
                "UPDATE devices SET last_sync = $1, status = 'online', signal_strength = 80, updated_at = $1 WHERE id = $2",
                now, device_id)
            await conn.execute(
                """INSERT INTO bronze.sensor_ingestions (source, device_id, ingestion_batch_id, raw_payload)
                   VALUES ($1,$2,$3,$4)""",
                source, device_id, batch_id, {**reading, "timestamp": now.isoformat()})
    await _check_alerts(owner_id, device_id, plot_id, dict(row), now)
    return row

async def _check_alerts(uid, device_id, plot_id, reading: dict, now: datetime):
    pool = get_pool()

    async def _alert(atype: str, sev: str, title: str, msg: str):
        # Atomic guard via the partial unique index (device_id, type) WHERE is_resolved = FALSE
        # — replaces the old Mongo find-then-insert pattern (race-prone).
        await pool.execute("""
            INSERT INTO alerts (owner_id, device_id, plot_id, type, severity, title, message, created_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
            ON CONFLICT (device_id, type) WHERE is_resolved = FALSE DO NOTHING""",
            uid, device_id, plot_id, atype, sev, title, msg, now)

    soil_moisture = reading.get("soil_moisture")
    if soil_moisture is not None:
        if soil_moisture < 20:
            await _alert("low_moisture_critical", "critical", "Humidité du sol critique",
                f"Humidité du sol à {soil_moisture:.1f}% — irrigation urgente requise")
        elif soil_moisture < 30:
            await _alert("low_moisture_warning", "warning", "Humidité du sol faible",
                f"Humidité du sol à {soil_moisture:.1f}% — irrigation recommandée sous 48h")
    air_temperature = reading.get("air_temperature")
    if air_temperature is not None and air_temperature > 38:
        await _alert("high_temp", "warning", "Température élevée",
            f"Température de l'air à {air_temperature:.1f}°C — risque de stress thermique")
    soil_nitrogen = reading.get("soil_nitrogen")
    if soil_nitrogen is not None and soil_nitrogen < 20:
        await _alert("low_nitrogen", "warning", "Azote du sol insuffisant",
            f"Teneur en azote à {soil_nitrogen:.1f} mg/kg — apport en engrais recommandé")
    ph = reading.get("ph")
    if ph is not None and (ph < 5.5 or ph > 8.0):
        await _alert("ph_imbalance", "warning", "pH du sol déséquilibré",
            f"pH à {ph:.1f} — en dehors de la plage optimale (5.5–8.0)")

# ─── HARDWARE INGESTION (passerelle Raspberry Pi / ESP32-LoRa) ────────────────
@api_router.post("/ingest/batch")
async def ingest_batch(data: BatchIngestReq, request: Request):
    farm = await get_farm_from_gateway_key(request)
    farm_id = farm["id"]
    pool = get_pool()
    now = datetime.now(timezone.utc)
    batch_id = uuid.uuid4()  # partagé par toutes les lectures de ce POST (traçabilité Bronze)
    accepted = 0
    rejected = []
    for item in data.readings:
        device = await pool.fetchrow("SELECT * FROM devices WHERE device_uid = $1 AND farm_id = $2",
                                      item.device_uid, farm_id)
        if not device:
            rejected.append({"device_uid": item.device_uid,
                              "reason": "Appareil non enregistré pour cette exploitation"})
            continue
        values = item.model_dump(exclude={"device_uid"})
        await _ingest_reading(device["owner_id"], device["id"], device["plot_id"], values, now,
                               source="gateway_batch", batch_id=batch_id)
        accepted += 1
    return {"accepted": accepted, "rejected": rejected}

# ─── ALERTS ───────────────────────────────────────────────────────────────────
@api_router.get("/alerts")
async def get_alerts(request: Request, severity: Optional[str] = None,
                     is_resolved: Optional[bool] = None, limit: int = 100):
    u = await get_current_user(request)
    pool = get_pool()
    conds, params = ["owner_id = $1"], [u["id"]]
    if severity:
        params.append(severity); conds.append(f"severity = ${len(params)}")
    if is_resolved is not None:
        params.append(is_resolved); conds.append(f"is_resolved = ${len(params)}")
    params.append(limit)
    rows = await pool.fetch(
        f'SELECT * FROM alerts WHERE {" AND ".join(conds)} ORDER BY created_at DESC LIMIT ${len(params)}', *params)
    return docs(rows)

@api_router.put("/alerts/{aid}/read")
async def mark_alert_read(aid: str, request: Request):
    u = await get_current_user(request)
    await get_pool().execute("UPDATE alerts SET is_read = TRUE WHERE id = $1 AND owner_id = $2", aid, u["id"])
    return {"message": "Alerte marquée comme lue"}

@api_router.put("/alerts/{aid}/resolve")
async def resolve_alert(aid: str, request: Request):
    u = await get_current_user(request)
    now = datetime.now(timezone.utc)
    await get_pool().execute(
        "UPDATE alerts SET is_resolved = TRUE, is_read = TRUE, resolved_at = $1 WHERE id = $2 AND owner_id = $3",
        now, aid, u["id"])
    return {"message": "Alerte résolue"}

@api_router.delete("/alerts/{aid}")
async def delete_alert(aid: str, request: Request):
    u = await get_current_user(request)
    await get_pool().execute("DELETE FROM alerts WHERE id = $1 AND owner_id = $2", aid, u["id"])
    return {"message": "Alerte supprimée"}

# ─── PREDICTIONS ──────────────────────────────────────────────────────────────
@api_router.get("/predictions")
async def get_predictions(request: Request, plot_id: Optional[str] = None, limit: int = 20):
    u = await get_current_user(request)
    pool = get_pool()
    conds, params = ["owner_id = $1"], [u["id"]]
    if plot_id:
        params.append(plot_id); conds.append(f"plot_id = ${len(params)}")
    params.append(limit)
    rows = await pool.fetch(
        f'SELECT * FROM predictions WHERE {" AND ".join(conds)} ORDER BY created_at DESC LIMIT ${len(params)}', *params)
    return docs(rows)

@api_router.post("/predictions/generate/{plot_id}")
async def generate_predictions(plot_id: str, request: Request):
    u = await get_current_user(request)
    uid = u["id"]
    pool = get_pool()
    plot = await pool.fetchrow("SELECT * FROM plots WHERE id = $1 AND owner_id = $2", plot_id, uid)
    if not plot: raise HTTPException(404, "Parcelle introuvable")

    since = datetime.now(timezone.utc) - timedelta(hours=72)
    readings = await pool.fetch(
        'SELECT * FROM sensor_readings WHERE plot_id = $1 AND owner_id = $2 AND "timestamp" >= $3 '
        'ORDER BY "timestamp" ASC LIMIT 200', plot_id, uid, since)
    readings = [dict(r) for r in readings]

    now = datetime.now(timezone.utc)
    new_preds = _compute_predictions(readings, dict(plot), uid, now)
    if new_preds:
        async with pool.acquire() as conn, conn.transaction():
            await conn.execute("DELETE FROM predictions WHERE plot_id = $1 AND owner_id = $2", plot_id, uid)
            for p in new_preds:
                await conn.execute("""
                    INSERT INTO predictions (owner_id, plot_id, farm_id, plot_name, target_variable,
                        forecast_horizon, predicted_value, confidence, trend, risk_level,
                        explanation, recommended_action, created_at)
                    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)""",
                    p["owner_id"], p["plot_id"], p["farm_id"] or None, p["plot_name"], p["target_variable"],
                    p["forecast_horizon"], p["predicted_value"], p["confidence"], p["trend"], p["risk_level"],
                    p["explanation"], p["recommended_action"], p["created_at"])

    saved = await pool.fetch(
        "SELECT * FROM predictions WHERE plot_id = $1 AND owner_id = $2 ORDER BY created_at DESC LIMIT 20",
        plot_id, uid)
    return docs(saved)

# TODO(ML): Point d'extension pour le futur modèle de prédiction d'humidité —
# une fois le pipeline Bronze/Silver/Gold (n8n) en place, remplacer/augmenter
# cette heuristique par un modèle entraîné consommant gold.plot_features.
def _compute_predictions(readings: list, plot: dict, uid, now: datetime) -> list:
    preds = []
    plot_id = plot["id"]
    farm_id = str(plot.get("farm_id") or "")
    plot_name = plot.get("name", "Parcelle")

    if not readings:
        preds.append({"owner_id": uid, "plot_id": plot_id, "farm_id": farm_id,
            "plot_name": plot_name, "target_variable": "Connectivité",
            "forecast_horizon": "24h", "predicted_value": 0, "confidence": 0.90,
            "trend": "stable", "risk_level": "warning",
            "explanation": "Aucune donnée capteur reçue récemment.",
            "recommended_action": "Vérifiez la connexion de vos appareils.", "created_at": now})
        return preds

    latest = readings[-1]
    recent = readings[-6:] if len(readings) >= 6 else readings

    # Soil moisture prediction
    moist_vals = [r.get("soil_moisture") for r in recent if r.get("soil_moisture") is not None]
    if moist_vals:
        avg_m = sum(moist_vals) / len(moist_vals)
        trend_m = moist_vals[-1] - moist_vals[0] if len(moist_vals) > 1 else 0
        pred_m = max(0, avg_m + trend_m * 0.5)
        risk = "critical" if pred_m < 20 else "high" if pred_m < 30 else "medium" if pred_m < 40 else "low"
        if risk in ("critical", "high", "medium"):
            action = "Irrigation urgente requise" if risk == "critical" else "Planifier une irrigation dans les 24–48h" if risk == "high" else "Surveiller l'humidité, irrigation possible"
            preds.append({"owner_id": uid, "plot_id": plot_id, "farm_id": farm_id,
                "plot_name": plot_name, "target_variable": "Humidité du sol",
                "forecast_horizon": "48h", "predicted_value": round(pred_m, 1),
                "confidence": round(0.65 + 0.05 * min(len(moist_vals), 6), 2),
                "trend": "down" if trend_m < -2 else "up" if trend_m > 2 else "stable",
                "risk_level": risk,
                "explanation": f"L'humidité du sol est de {avg_m:.1f}% avec une tendance {'à la baisse' if trend_m < 0 else 'stable'}. Valeur prédite dans 48h: {pred_m:.1f}%.",
                "recommended_action": action, "created_at": now})

    # NPK prediction
    n_vals = [r.get("soil_nitrogen") for r in recent if r.get("soil_nitrogen") is not None]
    p_vals = [r.get("soil_phosphorus") for r in recent if r.get("soil_phosphorus") is not None]
    k_vals = [r.get("soil_potassium") for r in recent if r.get("soil_potassium") is not None]
    if n_vals and p_vals and k_vals:
        n, p, k = sum(n_vals)/len(n_vals), sum(p_vals)/len(p_vals), sum(k_vals)/len(k_vals)
        low = []
        if n < 25: low.append(f"N={n:.0f}")
        if p < 12: low.append(f"P={p:.0f}")
        if k < 20: low.append(f"K={k:.0f}")
        if low:
            preds.append({"owner_id": uid, "plot_id": plot_id, "farm_id": farm_id,
                "plot_name": plot_name, "target_variable": "NPK",
                "forecast_horizon": "7j", "predicted_value": round((n+p+k)/3, 1),
                "confidence": 0.72, "trend": "down", "risk_level": "medium",
                "explanation": f"Déséquilibre nutritif détecté: {', '.join(low)} mg/kg en dessous des seuils optimaux.",
                "recommended_action": "Apport en engrais NPK recommandé sous 7 jours.", "created_at": now})

    # Temperature stress
    temp_vals = [r.get("air_temperature") for r in recent if r.get("air_temperature") is not None]
    if temp_vals:
        avg_t = sum(temp_vals) / len(temp_vals)
        if avg_t > 35:
            preds.append({"owner_id": uid, "plot_id": plot_id, "farm_id": farm_id,
                "plot_name": plot_name, "target_variable": "Stress thermique",
                "forecast_horizon": "24h", "predicted_value": round(avg_t, 1),
                "confidence": 0.80, "trend": "stable", "risk_level": "high",
                "explanation": f"Température de l'air élevée ({avg_t:.1f}°C) — risque de stress thermique.",
                "recommended_action": "Ombrage ou irrigation de refroidissement recommandé.", "created_at": now})

    # pH imbalance
    ph_vals = [r.get("ph") for r in recent if r.get("ph") is not None]
    if ph_vals:
        avg_ph = sum(ph_vals) / len(ph_vals)
        if avg_ph < 5.5 or avg_ph > 7.8:
            preds.append({"owner_id": uid, "plot_id": plot_id, "farm_id": farm_id,
                "plot_name": plot_name, "target_variable": "pH du sol",
                "forecast_horizon": "7j", "predicted_value": round(avg_ph, 2),
                "confidence": 0.75, "trend": "stable",
                "risk_level": "medium" if 5.0 < avg_ph < 8.2 else "high",
                "explanation": f"pH du sol à {avg_ph:.1f} — hors plage optimale (5.5–7.8).",
                "recommended_action": "Amendement calcaire si pH < 5.5, soufre si pH > 7.8.", "created_at": now})

    # If all looks good
    if not preds:
        preds.append({"owner_id": uid, "plot_id": plot_id, "farm_id": farm_id,
            "plot_name": plot_name, "target_variable": "État général",
            "forecast_horizon": "7j", "predicted_value": 100, "confidence": 0.85,
            "trend": "stable", "risk_level": "low",
            "explanation": "Tous les paramètres de la parcelle sont dans les plages optimales.",
            "recommended_action": "Continuez la surveillance habituelle.", "created_at": now})

    return preds

# ─── PROFILE ──────────────────────────────────────────────────────────────────
@api_router.get("/profile")
async def get_profile(request: Request):
    return await get_current_user(request)

@api_router.put("/profile")
async def update_profile(data: ProfileUpdate, request: Request):
    u = await get_current_user(request)
    uid = u["id"]
    pool = get_pool()
    async with pool.acquire() as conn:
        await pg_update(conn, "users", uid, data.model_dump(exclude_unset=True))
        user = await conn.fetchrow("SELECT * FROM users WHERE id = $1", uid)
    d = doc(user)
    d.pop("password_hash", None)
    return d

@api_router.put("/profile/password")
async def change_password(data: PasswordChange, request: Request):
    u = await get_current_user(request)
    uid = u["id"]
    pool = get_pool()
    user = await pool.fetchrow("SELECT * FROM users WHERE id = $1", uid)
    if not verify_password(data.current_password, user["password_hash"]):
        raise HTTPException(400, "Mot de passe actuel incorrect")
    await pool.execute("UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2",
        hash_password(data.new_password), uid)
    return {"message": "Mot de passe modifié avec succès"}

# ─── ONBOARDING ───────────────────────────────────────────────────────────────
@api_router.get("/onboarding/status")
async def onboarding_status(request: Request):
    u = await get_current_user(request)
    uid = u["id"]
    pool = get_pool()
    farms = await pool.fetchval("SELECT COUNT(*) FROM farms WHERE owner_id = $1", uid)
    plots = await pool.fetchval("SELECT COUNT(*) FROM plots WHERE owner_id = $1", uid)
    devices = await pool.fetchval("SELECT COUNT(*) FROM devices WHERE owner_id = $1", uid)
    return {"onboarding_completed": u.get("onboarding_completed", False),
            "has_farm": farms > 0, "has_plot": plots > 0, "has_device": devices > 0}

@api_router.post("/onboarding/complete")
async def complete_onboarding(request: Request):
    u = await get_current_user(request)
    await get_pool().execute("UPDATE users SET onboarding_completed = TRUE, updated_at = now() WHERE id = $1", u["id"])
    return {"message": "Onboarding terminé"}

# ─── DASHBOARD STATS ──────────────────────────────────────────────────────────
@api_router.get("/dashboard/stats")
async def dashboard_stats(request: Request):
    u = await get_current_user(request)
    uid = u["id"]
    pool = get_pool()
    farms = await pool.fetchval("SELECT COUNT(*) FROM farms WHERE owner_id = $1", uid)
    plots = await pool.fetchval("SELECT COUNT(*) FROM plots WHERE owner_id = $1", uid)
    total_dev = await pool.fetchval("SELECT COUNT(*) FROM devices WHERE owner_id = $1", uid)
    online_dev = await pool.fetchval("SELECT COUNT(*) FROM devices WHERE owner_id = $1 AND status = 'online'", uid)
    active_alerts = await pool.fetchval("SELECT COUNT(*) FROM alerts WHERE owner_id = $1 AND is_resolved = FALSE", uid)
    critical_alerts = await pool.fetchval(
        "SELECT COUNT(*) FROM alerts WHERE owner_id = $1 AND is_resolved = FALSE AND severity = 'critical'", uid)

    since_24h = datetime.now(timezone.utc) - timedelta(hours=24)
    recent_readings = await pool.fetch(
        'SELECT * FROM sensor_readings WHERE owner_id = $1 AND "timestamp" >= $2 LIMIT 500', uid, since_24h)

    avg_moisture, avg_temp, avg_npk = None, None, None
    moisture_vals = [r["soil_moisture"] for r in recent_readings if r["soil_moisture"] is not None]
    temp_vals = [r["air_temperature"] for r in recent_readings if r["air_temperature"] is not None]
    n_vals = [r["soil_nitrogen"] for r in recent_readings if r["soil_nitrogen"] is not None]
    p_vals = [r["soil_phosphorus"] for r in recent_readings if r["soil_phosphorus"] is not None]
    k_vals = [r["soil_potassium"] for r in recent_readings if r["soil_potassium"] is not None]

    if moisture_vals: avg_moisture = round(sum(moisture_vals)/len(moisture_vals), 1)
    if temp_vals: avg_temp = round(sum(temp_vals)/len(temp_vals), 1)
    if n_vals and p_vals and k_vals:
        avg_npk = round((sum(n_vals)/len(n_vals) + sum(p_vals)/len(p_vals) + sum(k_vals)/len(k_vals))/3, 1)

    return {"farms": farms, "plots": plots, "total_devices": total_dev,
            "online_devices": online_dev, "active_alerts": active_alerts,
            "critical_alerts": critical_alerts, "avg_moisture": avg_moisture,
            "avg_temperature": avg_temp, "avg_npk": avg_npk}

# ─── NOTIFICATIONS ────────────────────────────────────────────────────────────
@api_router.get("/notifications")
async def get_notifications(request: Request):
    u = await get_current_user(request)
    rows = await get_pool().fetch("SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50", u["id"])
    return docs(rows)

@api_router.put("/notifications/{nid}/read")
async def mark_notif_read(nid: str, request: Request):
    u = await get_current_user(request)
    await get_pool().execute("UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2", nid, u["id"])
    return {"message": "Notification marquée comme lue"}

# ─── ADMIN ────────────────────────────────────────────────────────────────────
@api_router.get("/admin/stats")
async def admin_stats(request: Request):
    await require_admin(request)
    pool = get_pool()
    total_users = await pool.fetchval("SELECT COUNT(*) FROM users WHERE role = 'farmer'")
    active_users = await pool.fetchval("SELECT COUNT(*) FROM users WHERE role = 'farmer' AND status = 'active'")
    pending_users = await pool.fetchval("SELECT COUNT(*) FROM users WHERE role = 'farmer' AND status = 'pending'")
    total_farms = await pool.fetchval("SELECT COUNT(*) FROM farms")
    total_plots = await pool.fetchval("SELECT COUNT(*) FROM plots")
    total_devices = await pool.fetchval("SELECT COUNT(*) FROM devices")
    online_devices = await pool.fetchval("SELECT COUNT(*) FROM devices WHERE status = 'online'")
    critical_alerts = await pool.fetchval("SELECT COUNT(*) FROM alerts WHERE severity = 'critical' AND is_resolved = FALSE")
    prediction_jobs = await pool.fetchval("SELECT COUNT(*) FROM predictions")
    return {"total_users": total_users, "active_users": active_users,
            "pending_users": pending_users, "total_farms": total_farms,
            "total_plots": total_plots, "total_devices": total_devices,
            "online_devices": online_devices, "critical_alerts": critical_alerts,
            "prediction_jobs": prediction_jobs}

@api_router.get("/admin/users")
async def admin_users(request: Request, status: Optional[str] = None, search: Optional[str] = None):
    await require_admin(request)
    pool = get_pool()
    conds, params = ["role = 'farmer'"], []
    if status:
        params.append(status); conds.append(f"status = ${len(params)}")
    if search:
        params.append(f"%{search}%")
        conds.append(f"(email ILIKE ${len(params)} OR first_name ILIKE ${len(params)} OR last_name ILIKE ${len(params)})")
    rows = await pool.fetch(f"SELECT * FROM users WHERE {' AND '.join(conds)} ORDER BY created_at DESC LIMIT 500", *params)
    result = []
    for u in rows:
        ud = doc(u)
        ud.pop("password_hash", None)
        ud["farms_count"] = await pool.fetchval("SELECT COUNT(*) FROM farms WHERE owner_id = $1", u["id"])
        ud["devices_count"] = await pool.fetchval("SELECT COUNT(*) FROM devices WHERE owner_id = $1", u["id"])
        result.append(ud)
    return result

@api_router.put("/admin/users/{uid}/status")
async def admin_update_user_status(uid: str, data: UserStatusUpdate, request: Request):
    await require_admin(request)
    await get_pool().execute("UPDATE users SET status = $1, updated_at = now() WHERE id = $2", data.status, uid)
    return {"message": f"Statut mis à jour: {data.status}"}

@api_router.get("/admin/farms")
async def admin_farms(request: Request):
    await require_admin(request)
    pool = get_pool()
    farms = await pool.fetch("SELECT * FROM farms ORDER BY created_at DESC LIMIT 1000")
    result = []
    for f in farms:
        fd = farm_doc(f)
        user = await pool.fetchrow("SELECT first_name, last_name, email FROM users WHERE id = $1", f["owner_id"])
        fd["owner_name"] = f"{user['first_name']} {user['last_name']}" if user else "Inconnu"
        fd["owner_email"] = user["email"] if user else ""
        fd["plots_count"] = await pool.fetchval("SELECT COUNT(*) FROM plots WHERE farm_id = $1", f["id"])
        fd["devices_count"] = await pool.fetchval("SELECT COUNT(*) FROM devices WHERE farm_id = $1", f["id"])
        result.append(fd)
    return result

@api_router.get("/admin/devices")
async def admin_devices(request: Request, status: Optional[str] = None):
    await require_admin(request)
    pool = get_pool()
    if status:
        rows = await pool.fetch("SELECT * FROM devices WHERE status = $1 ORDER BY created_at DESC LIMIT 1000", status)
    else:
        rows = await pool.fetch("SELECT * FROM devices ORDER BY created_at DESC LIMIT 1000")
    return docs(rows)

@api_router.get("/admin/alerts")
async def admin_alerts(request: Request, severity: Optional[str] = None):
    await require_admin(request)
    pool = get_pool()
    if severity:
        rows = await pool.fetch("SELECT * FROM alerts WHERE severity = $1 ORDER BY created_at DESC LIMIT 500", severity)
    else:
        rows = await pool.fetch("SELECT * FROM alerts ORDER BY created_at DESC LIMIT 500")
    return docs(rows)

@api_router.get("/admin/audit-logs")
async def admin_audit_logs(request: Request, limit: int = 100):
    await require_admin(request)
    rows = await get_pool().fetch("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT $1", limit)
    return docs(rows)

async def _audit(uid, action: str, resource_type: str, resource_id: str = "", details: dict = None):
    await get_pool().execute(
        "INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details) VALUES ($1,$2,$3,$4,$5)",
        uid, action, resource_type, resource_id, details or {})

# ─── Include router ───────────────────────────────────────────────────────────
app.include_router(api_router)
