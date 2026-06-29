from dotenv import load_dotenv
load_dotenv()

import os, secrets, logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Any, Annotated
from pathlib import Path

import bcrypt
import jwt
from bson import ObjectId
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Query
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, BeforeValidator, ConfigDict

# ─── App ──────────────────────────────────────────────────────────────────────
app = FastAPI(title="Dat'Agro API", version="1.0.0")
api_router = APIRouter(prefix="/api")

# ─── MongoDB ──────────────────────────────────────────────────────────────────
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

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

# ─── ObjectId helper ──────────────────────────────────────────────────────────
def _parse_oid(v: Any) -> str:
    if isinstance(v, ObjectId): return str(v)
    if isinstance(v, str): return v
    raise ValueError(f"Invalid ObjectId: {v}")

PyObjectId = Annotated[str, BeforeValidator(_parse_oid)]

# ─── Auth helpers ─────────────────────────────────────────────────────────────
JWT_SECRET = os.environ.get("JWT_SECRET", "fallback-datagro-secret-change-me")
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
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(401, "Utilisateur introuvable")
        user["_id"] = str(user["_id"])
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expiré")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Token invalide")

async def require_admin(request: Request) -> dict:
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(403, "Accès administrateur requis")
    return user

# ─── Utils ────────────────────────────────────────────────────────────────────
def doc(d: dict | None) -> dict | None:
    if d is None: return None
    r = {}
    for k, v in d.items():
        if k == "_id": r["id"] = str(v)
        elif isinstance(v, ObjectId): r[k] = str(v)
        elif isinstance(v, datetime): r[k] = v.isoformat()
        else: r[k] = v
    return r

def docs(lst): return [doc(d) for d in lst]

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
    await db.users.create_index("email", unique=True)
    await db.password_reset_tokens.create_index("expires_at", expireAfterSeconds=0)
    await db.login_attempts.create_index("identifier")
    await db.sensor_readings.create_index([("device_id", 1), ("timestamp", -1)])
    await db.alerts.create_index([("owner_id", 1), ("is_resolved", 1)])
    await db.predictions.create_index([("plot_id", 1), ("created_at", -1)])

    admin_email = os.environ.get("ADMIN_EMAIL", "admin@datagro.com")
    admin_pwd = os.environ.get("ADMIN_PASSWORD", "DatAgro2024!")
    now = datetime.now(timezone.utc)
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        await db.users.insert_one({
            "first_name": "Admin", "last_name": "Dat'Agro", "email": admin_email,
            "phone": "+33 1 00 00 00 00", "farm_name": "Dat'Agro Platform", "country": "France",
            "role": "admin", "status": "active",
            "password_hash": hash_password(admin_pwd), "onboarding_completed": True,
            "created_at": now, "updated_at": now
        })
    elif not verify_password(admin_pwd, existing.get("password_hash", "")):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_pwd), "updated_at": now}})

    Path("/app/memory").mkdir(exist_ok=True)
    Path("/app/memory/test_credentials.md").write_text(
        f"# Credentials de test Dat'Agro\n\n"
        f"## Admin\n- Email: {admin_email}\n- Mot de passe: {admin_pwd}\n- Rôle: admin\n\n"
        f"## Endpoints Auth\n- POST /api/auth/register\n- POST /api/auth/login\n"
        f"- POST /api/auth/logout\n- GET /api/auth/me\n"
    )

@app.on_event("shutdown")
async def shutdown():
    client.close()

# ─── AUTH ─────────────────────────────────────────────────────────────────────
@api_router.post("/auth/register")
async def register(data: RegisterReq, response: Response):
    email = data.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "Cet email est déjà utilisé")
    now = datetime.now(timezone.utc)
    result = await db.users.insert_one({
        "first_name": data.first_name, "last_name": data.last_name, "email": email,
        "phone": data.phone, "farm_name": data.farm_name, "country": data.country,
        "role": "farmer", "status": "active",
        "password_hash": hash_password(data.password), "onboarding_completed": False,
        "created_at": now, "updated_at": now
    })
    uid = str(result.inserted_id)
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
    att = await db.login_attempts.find_one({"identifier": key})
    if att and att.get("count", 0) >= 5:
        if (datetime.now(timezone.utc) - att["last_attempt"]).total_seconds() < 900:
            raise HTTPException(429, "Trop de tentatives. Réessayez dans 15 minutes.")
        await db.login_attempts.delete_one({"identifier": key})

    user = await db.users.find_one({"email": email})
    if not user or not verify_password(data.password, user.get("password_hash", "")):
        await db.login_attempts.update_one({"identifier": key},
            {"$inc": {"count": 1}, "$set": {"last_attempt": datetime.now(timezone.utc)}}, upsert=True)
        raise HTTPException(401, "Email ou mot de passe incorrect")
    if user.get("status") == "suspended":
        raise HTTPException(403, "Compte suspendu. Contactez l'administrateur.")
    await db.login_attempts.delete_one({"identifier": key})
    uid = str(user["_id"])
    at = create_access_token(uid, email)
    rt = create_refresh_token(uid)
    set_cookies(response, at, rt)
    return {"id": uid, "first_name": user.get("first_name"), "last_name": user.get("last_name"),
            "email": user["email"], "role": user.get("role", "farmer"),
            "status": user.get("status"), "onboarding_completed": user.get("onboarding_completed", False),
            "farm_name": user.get("farm_name"), "phone": user.get("phone"), "country": user.get("country"),
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
        user = await db.users.find_one({"_id": ObjectId(p["sub"])})
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
    user = await db.users.find_one({"email": email})
    if user:
        token = secrets.token_urlsafe(32)
        await db.password_reset_tokens.insert_one({
            "token": token, "user_id": str(user["_id"]), "email": email,
            "expires_at": datetime.now(timezone.utc) + timedelta(hours=1), "used": False
        })
        logger.info(f"[RESET] /reinitialiser-mot-de-passe?token={token}")
    return {"message": "Si l'email existe, un lien de réinitialisation vous a été envoyé"}

@api_router.post("/auth/reset-password")
async def reset_password(data: ResetPwdReq):
    t = await db.password_reset_tokens.find_one({"token": data.token, "used": False})
    if not t or t["expires_at"] < datetime.now(timezone.utc):
        raise HTTPException(400, "Token invalide ou expiré")
    await db.users.update_one({"_id": ObjectId(t["user_id"])},
        {"$set": {"password_hash": hash_password(data.new_password), "updated_at": datetime.now(timezone.utc)}})
    await db.password_reset_tokens.update_one({"token": data.token}, {"$set": {"used": True}})
    return {"message": "Mot de passe réinitialisé"}

# ─── FARMS ────────────────────────────────────────────────────────────────────
@api_router.get("/farms")
async def get_farms(request: Request):
    u = await get_current_user(request)
    q = {} if u["role"] == "admin" else {"owner_id": u["_id"] if "_id" in u else u["id"]}
    oid = u.get("_id") or u.get("id")
    q = {} if u["role"] == "admin" else {"owner_id": oid}
    return docs(await db.farms.find(q).to_list(200))

@api_router.post("/farms")
async def create_farm(data: FarmCreate, request: Request):
    u = await get_current_user(request)
    now = datetime.now(timezone.utc)
    uid = u.get("_id") or u.get("id")
    r = await db.farms.insert_one({"name": data.name, "location": data.location,
        "description": data.description, "total_area": data.total_area,
        "owner_id": uid, "created_at": now, "updated_at": now})
    farm = await db.farms.find_one({"_id": r.inserted_id})
    await _audit(uid, "create_farm", "farm", str(r.inserted_id))
    return doc(farm)

@api_router.get("/farms/{fid}")
async def get_farm(fid: str, request: Request):
    u = await get_current_user(request)
    uid = u.get("_id") or u.get("id")
    q = {"_id": ObjectId(fid)} if u["role"] == "admin" else {"_id": ObjectId(fid), "owner_id": uid}
    f = await db.farms.find_one(q)
    if not f: raise HTTPException(404, "Exploitation introuvable")
    return doc(f)

@api_router.put("/farms/{fid}")
async def update_farm(fid: str, data: FarmUpdate, request: Request):
    u = await get_current_user(request)
    uid = u.get("_id") or u.get("id")
    q = {"_id": ObjectId(fid)} if u["role"] == "admin" else {"_id": ObjectId(fid), "owner_id": uid}
    upd = {k: v for k, v in data.model_dump(exclude_unset=True).items() if v is not None}
    upd["updated_at"] = datetime.now(timezone.utc)
    res = await db.farms.update_one(q, {"$set": upd})
    if res.matched_count == 0: raise HTTPException(404, "Exploitation introuvable")
    return doc(await db.farms.find_one({"_id": ObjectId(fid)}))

@api_router.delete("/farms/{fid}")
async def delete_farm(fid: str, request: Request):
    u = await get_current_user(request)
    uid = u.get("_id") or u.get("id")
    q = {"_id": ObjectId(fid)} if u["role"] == "admin" else {"_id": ObjectId(fid), "owner_id": uid}
    res = await db.farms.delete_one(q)
    if res.deleted_count == 0: raise HTTPException(404, "Exploitation introuvable")
    return {"message": "Exploitation supprimée"}

# ─── PLOTS ────────────────────────────────────────────────────────────────────
@api_router.get("/plots")
async def get_plots(request: Request, farm_id: Optional[str] = None):
    u = await get_current_user(request)
    uid = u.get("_id") or u.get("id")
    q = {} if u["role"] == "admin" else {"owner_id": uid}
    if farm_id: q["farm_id"] = farm_id
    return docs(await db.plots.find(q).to_list(500))

@api_router.post("/plots")
async def create_plot(data: PlotCreate, request: Request):
    u = await get_current_user(request)
    uid = u.get("_id") or u.get("id")
    if u["role"] != "admin":
        farm = await db.farms.find_one({"_id": ObjectId(data.farm_id), "owner_id": uid})
        if not farm: raise HTTPException(403, "Accès refusé à cette exploitation")
    now = datetime.now(timezone.utc)
    r = await db.plots.insert_one({"farm_id": data.farm_id, "owner_id": uid,
        "name": data.name, "location": data.location, "area": data.area,
        "crop_type": data.crop_type, "sowing_date": data.sowing_date, "notes": data.notes,
        "status": data.status, "created_at": now, "updated_at": now})
    return doc(await db.plots.find_one({"_id": r.inserted_id}))

@api_router.get("/plots/{pid}")
async def get_plot(pid: str, request: Request):
    u = await get_current_user(request)
    uid = u.get("_id") or u.get("id")
    q = {"_id": ObjectId(pid)} if u["role"] == "admin" else {"_id": ObjectId(pid), "owner_id": uid}
    p = await db.plots.find_one(q)
    if not p: raise HTTPException(404, "Parcelle introuvable")
    return doc(p)

@api_router.put("/plots/{pid}")
async def update_plot(pid: str, data: PlotUpdate, request: Request):
    u = await get_current_user(request)
    uid = u.get("_id") or u.get("id")
    q = {"_id": ObjectId(pid)} if u["role"] == "admin" else {"_id": ObjectId(pid), "owner_id": uid}
    upd = {k: v for k, v in data.model_dump(exclude_unset=True).items()}
    upd["updated_at"] = datetime.now(timezone.utc)
    res = await db.plots.update_one(q, {"$set": upd})
    if res.matched_count == 0: raise HTTPException(404, "Parcelle introuvable")
    return doc(await db.plots.find_one({"_id": ObjectId(pid)}))

@api_router.delete("/plots/{pid}")
async def delete_plot(pid: str, request: Request):
    u = await get_current_user(request)
    uid = u.get("_id") or u.get("id")
    q = {"_id": ObjectId(pid)} if u["role"] == "admin" else {"_id": ObjectId(pid), "owner_id": uid}
    res = await db.plots.delete_one(q)
    if res.deleted_count == 0: raise HTTPException(404, "Parcelle introuvable")
    return {"message": "Parcelle supprimée"}

# ─── DEVICES ──────────────────────────────────────────────────────────────────
@api_router.get("/devices")
async def get_devices(request: Request, farm_id: Optional[str] = None, plot_id: Optional[str] = None):
    u = await get_current_user(request)
    uid = u.get("_id") or u.get("id")
    q = {} if u["role"] == "admin" else {"owner_id": uid}
    if farm_id: q["farm_id"] = farm_id
    if plot_id: q["plot_id"] = plot_id
    return docs(await db.devices.find(q).to_list(500))

@api_router.post("/devices")
async def create_device(data: DeviceCreate, request: Request):
    u = await get_current_user(request)
    uid = u.get("_id") or u.get("id")
    if await db.devices.find_one({"device_uid": data.device_uid}):
        raise HTTPException(400, "Cet identifiant d'appareil est déjà utilisé")
    now = datetime.now(timezone.utc)
    r = await db.devices.insert_one({"farm_id": data.farm_id, "plot_id": data.plot_id,
        "owner_id": uid, "name": data.name, "device_uid": data.device_uid,
        "device_type": data.device_type, "sensor_types": data.sensor_types,
        "status": "offline", "battery_level": 100, "signal_strength": 0,
        "firmware_version": data.firmware_version, "maintenance_notes": data.maintenance_notes,
        "last_sync": None, "created_at": now, "updated_at": now})
    return doc(await db.devices.find_one({"_id": r.inserted_id}))

@api_router.get("/devices/{did}")
async def get_device(did: str, request: Request):
    u = await get_current_user(request)
    uid = u.get("_id") or u.get("id")
    q = {"_id": ObjectId(did)} if u["role"] == "admin" else {"_id": ObjectId(did), "owner_id": uid}
    d = await db.devices.find_one(q)
    if not d: raise HTTPException(404, "Appareil introuvable")
    return doc(d)

@api_router.put("/devices/{did}")
async def update_device(did: str, data: DeviceUpdate, request: Request):
    u = await get_current_user(request)
    uid = u.get("_id") or u.get("id")
    q = {"_id": ObjectId(did)} if u["role"] == "admin" else {"_id": ObjectId(did), "owner_id": uid}
    upd = {k: v for k, v in data.model_dump(exclude_unset=True).items()}
    upd["updated_at"] = datetime.now(timezone.utc)
    res = await db.devices.update_one(q, {"$set": upd})
    if res.matched_count == 0: raise HTTPException(404, "Appareil introuvable")
    return doc(await db.devices.find_one({"_id": ObjectId(did)}))

@api_router.delete("/devices/{did}")
async def delete_device(did: str, request: Request):
    u = await get_current_user(request)
    uid = u.get("_id") or u.get("id")
    q = {"_id": ObjectId(did)} if u["role"] == "admin" else {"_id": ObjectId(did), "owner_id": uid}
    res = await db.devices.delete_one(q)
    if res.deleted_count == 0: raise HTTPException(404, "Appareil introuvable")
    return {"message": "Appareil supprimé"}

# ─── SENSOR READINGS ──────────────────────────────────────────────────────────
@api_router.get("/readings")
async def get_readings(request: Request, device_id: Optional[str] = None,
                       plot_id: Optional[str] = None, limit: int = 100, hours: int = 48):
    u = await get_current_user(request)
    uid = u.get("_id") or u.get("id")
    since = datetime.now(timezone.utc) - timedelta(hours=hours)
    q = {"owner_id": uid, "timestamp": {"$gte": since}}
    if device_id: q["device_id"] = device_id
    if plot_id: q["plot_id"] = plot_id
    readings = await db.sensor_readings.find(q).sort("timestamp", -1).to_list(limit)
    return docs(readings)

@api_router.post("/readings")
async def create_reading(data: ReadingCreate, request: Request):
    u = await get_current_user(request)
    uid = u.get("_id") or u.get("id")
    now = datetime.now(timezone.utc)
    reading = {k: v for k, v in data.model_dump().items() if v is not None}
    reading["owner_id"] = uid
    reading["timestamp"] = now
    r = await db.sensor_readings.insert_one(reading)
    # Update device last_sync and status
    await db.devices.update_one({"_id": ObjectId(data.device_id)},
        {"$set": {"last_sync": now, "status": "online", "signal_strength": 80, "updated_at": now}})
    # Auto-generate alerts
    await _check_alerts(uid, data, now)
    return doc(await db.sensor_readings.find_one({"_id": r.inserted_id}))

async def _check_alerts(uid: str, data: ReadingCreate, now: datetime):
    async def _alert(atype: str, sev: str, title: str, msg: str):
        existing = await db.alerts.find_one({"device_id": data.device_id, "type": atype, "is_resolved": False})
        if not existing:
            await db.alerts.insert_one({"owner_id": uid, "device_id": data.device_id,
                "plot_id": data.plot_id, "type": atype, "severity": sev,
                "title": title, "message": msg, "is_read": False, "is_resolved": False,
                "resolved_at": None, "created_at": now})

    if data.soil_moisture is not None:
        if data.soil_moisture < 20:
            await _alert("low_moisture_critical", "critical", "Humidité du sol critique",
                f"Humidité du sol à {data.soil_moisture:.1f}% — irrigation urgente requise")
        elif data.soil_moisture < 30:
            await _alert("low_moisture_warning", "warning", "Humidité du sol faible",
                f"Humidité du sol à {data.soil_moisture:.1f}% — irrigation recommandée sous 48h")
    if data.air_temperature is not None and data.air_temperature > 38:
        await _alert("high_temp", "warning", "Température élevée",
            f"Température de l'air à {data.air_temperature:.1f}°C — risque de stress thermique")
    if data.soil_nitrogen is not None and data.soil_nitrogen < 20:
        await _alert("low_nitrogen", "warning", "Azote du sol insuffisant",
            f"Teneur en azote à {data.soil_nitrogen:.1f} mg/kg — apport en engrais recommandé")
    if data.ph is not None and (data.ph < 5.5 or data.ph > 8.0):
        await _alert("ph_imbalance", "warning", "pH du sol déséquilibré",
            f"pH à {data.ph:.1f} — en dehors de la plage optimale (5.5–8.0)")

# ─── ALERTS ───────────────────────────────────────────────────────────────────
@api_router.get("/alerts")
async def get_alerts(request: Request, severity: Optional[str] = None,
                     is_resolved: Optional[bool] = None, limit: int = 100):
    u = await get_current_user(request)
    uid = u.get("_id") or u.get("id")
    q = {"owner_id": uid}
    if severity: q["severity"] = severity
    if is_resolved is not None: q["is_resolved"] = is_resolved
    alerts = await db.alerts.find(q).sort("created_at", -1).to_list(limit)
    return docs(alerts)

@api_router.put("/alerts/{aid}/read")
async def mark_alert_read(aid: str, request: Request):
    u = await get_current_user(request)
    uid = u.get("_id") or u.get("id")
    await db.alerts.update_one({"_id": ObjectId(aid), "owner_id": uid}, {"$set": {"is_read": True}})
    return {"message": "Alerte marquée comme lue"}

@api_router.put("/alerts/{aid}/resolve")
async def resolve_alert(aid: str, request: Request):
    u = await get_current_user(request)
    uid = u.get("_id") or u.get("id")
    now = datetime.now(timezone.utc)
    await db.alerts.update_one({"_id": ObjectId(aid), "owner_id": uid},
        {"$set": {"is_resolved": True, "is_read": True, "resolved_at": now}})
    return {"message": "Alerte résolue"}

@api_router.delete("/alerts/{aid}")
async def delete_alert(aid: str, request: Request):
    u = await get_current_user(request)
    uid = u.get("_id") or u.get("id")
    await db.alerts.delete_one({"_id": ObjectId(aid), "owner_id": uid})
    return {"message": "Alerte supprimée"}

# ─── PREDICTIONS ──────────────────────────────────────────────────────────────
@api_router.get("/predictions")
async def get_predictions(request: Request, plot_id: Optional[str] = None, limit: int = 20):
    u = await get_current_user(request)
    uid = u.get("_id") or u.get("id")
    q = {"owner_id": uid}
    if plot_id: q["plot_id"] = plot_id
    preds = await db.predictions.find(q).sort("created_at", -1).to_list(limit)
    return docs(preds)

@api_router.post("/predictions/generate/{plot_id}")
async def generate_predictions(plot_id: str, request: Request):
    u = await get_current_user(request)
    uid = u.get("_id") or u.get("id")
    plot = await db.plots.find_one({"_id": ObjectId(plot_id), "owner_id": uid})
    if not plot: raise HTTPException(404, "Parcelle introuvable")

    since = datetime.now(timezone.utc) - timedelta(hours=72)
    readings = await db.sensor_readings.find(
        {"plot_id": plot_id, "owner_id": uid, "timestamp": {"$gte": since}}
    ).sort("timestamp", 1).to_list(200)

    now = datetime.now(timezone.utc)
    new_preds = _compute_predictions(readings, plot, uid, now)
    if new_preds:
        await db.predictions.delete_many({"plot_id": plot_id, "owner_id": uid})
        await db.predictions.insert_many(new_preds)

    saved = await db.predictions.find({"plot_id": plot_id, "owner_id": uid}).to_list(20)
    return docs(saved)

def _compute_predictions(readings: list, plot: dict, uid: str, now: datetime) -> list:
    preds = []
    plot_id = str(plot["_id"])
    farm_id = plot.get("farm_id", "")
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
    uid = u.get("_id") or u.get("id")
    upd = {k: v for k, v in data.model_dump(exclude_unset=True).items() if v is not None}
    upd["updated_at"] = datetime.now(timezone.utc)
    await db.users.update_one({"_id": ObjectId(uid)}, {"$set": upd})
    user = await db.users.find_one({"_id": ObjectId(uid)})
    user["_id"] = str(user["_id"])
    user.pop("password_hash", None)
    for k, v in user.items():
        if isinstance(v, datetime): user[k] = v.isoformat()
    return user

@api_router.put("/profile/password")
async def change_password(data: PasswordChange, request: Request):
    u = await get_current_user(request)
    uid = u.get("_id") or u.get("id")
    user = await db.users.find_one({"_id": ObjectId(uid)})
    if not verify_password(data.current_password, user.get("password_hash", "")):
        raise HTTPException(400, "Mot de passe actuel incorrect")
    await db.users.update_one({"_id": ObjectId(uid)},
        {"$set": {"password_hash": hash_password(data.new_password), "updated_at": datetime.now(timezone.utc)}})
    return {"message": "Mot de passe modifié avec succès"}

# ─── ONBOARDING ───────────────────────────────────────────────────────────────
@api_router.get("/onboarding/status")
async def onboarding_status(request: Request):
    u = await get_current_user(request)
    uid = u.get("_id") or u.get("id")
    farms = await db.farms.count_documents({"owner_id": uid})
    plots = await db.plots.count_documents({"owner_id": uid})
    devices = await db.devices.count_documents({"owner_id": uid})
    return {"onboarding_completed": u.get("onboarding_completed", False),
            "has_farm": farms > 0, "has_plot": plots > 0, "has_device": devices > 0}

@api_router.post("/onboarding/complete")
async def complete_onboarding(request: Request):
    u = await get_current_user(request)
    uid = u.get("_id") or u.get("id")
    await db.users.update_one({"_id": ObjectId(uid)},
        {"$set": {"onboarding_completed": True, "updated_at": datetime.now(timezone.utc)}})
    return {"message": "Onboarding terminé"}

# ─── DASHBOARD STATS ──────────────────────────────────────────────────────────
@api_router.get("/dashboard/stats")
async def dashboard_stats(request: Request):
    u = await get_current_user(request)
    uid = u.get("_id") or u.get("id")
    farms = await db.farms.count_documents({"owner_id": uid})
    plots = await db.plots.count_documents({"owner_id": uid})
    total_dev = await db.devices.count_documents({"owner_id": uid})
    online_dev = await db.devices.count_documents({"owner_id": uid, "status": "online"})
    active_alerts = await db.alerts.count_documents({"owner_id": uid, "is_resolved": False})
    critical_alerts = await db.alerts.count_documents({"owner_id": uid, "is_resolved": False, "severity": "critical"})

    since_24h = datetime.now(timezone.utc) - timedelta(hours=24)
    recent_readings = await db.sensor_readings.find(
        {"owner_id": uid, "timestamp": {"$gte": since_24h}}
    ).to_list(500)

    avg_moisture, avg_temp, avg_npk = None, None, None
    moisture_vals = [r["soil_moisture"] for r in recent_readings if r.get("soil_moisture") is not None]
    temp_vals = [r["air_temperature"] for r in recent_readings if r.get("air_temperature") is not None]
    n_vals = [r["soil_nitrogen"] for r in recent_readings if r.get("soil_nitrogen") is not None]
    p_vals = [r["soil_phosphorus"] for r in recent_readings if r.get("soil_phosphorus") is not None]
    k_vals = [r["soil_potassium"] for r in recent_readings if r.get("soil_potassium") is not None]

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
    uid = u.get("_id") or u.get("id")
    notifs = await db.notifications.find({"user_id": uid}).sort("created_at", -1).to_list(50)
    return docs(notifs)

@api_router.put("/notifications/{nid}/read")
async def mark_notif_read(nid: str, request: Request):
    u = await get_current_user(request)
    uid = u.get("_id") or u.get("id")
    await db.notifications.update_one({"_id": ObjectId(nid), "user_id": uid}, {"$set": {"is_read": True}})
    return {"message": "Notification marquée comme lue"}

# ─── ADMIN ────────────────────────────────────────────────────────────────────
@api_router.get("/admin/stats")
async def admin_stats(request: Request):
    await require_admin(request)
    total_users = await db.users.count_documents({"role": "farmer"})
    active_users = await db.users.count_documents({"role": "farmer", "status": "active"})
    pending_users = await db.users.count_documents({"role": "farmer", "status": "pending"})
    total_farms = await db.farms.count_documents({})
    total_plots = await db.plots.count_documents({})
    total_devices = await db.devices.count_documents({})
    online_devices = await db.devices.count_documents({"status": "online"})
    critical_alerts = await db.alerts.count_documents({"severity": "critical", "is_resolved": False})
    return {"total_users": total_users, "active_users": active_users,
            "pending_users": pending_users, "total_farms": total_farms,
            "total_plots": total_plots, "total_devices": total_devices,
            "online_devices": online_devices, "critical_alerts": critical_alerts,
            "prediction_jobs": await db.predictions.count_documents({})}

@api_router.get("/admin/users")
async def admin_users(request: Request, status: Optional[str] = None, search: Optional[str] = None):
    await require_admin(request)
    q = {"role": "farmer"}
    if status: q["status"] = status
    if search: q["$or"] = [{"email": {"$regex": search, "$options": "i"}},
                            {"first_name": {"$regex": search, "$options": "i"}},
                            {"last_name": {"$regex": search, "$options": "i"}}]
    users = await db.users.find(q, {"password_hash": 0}).to_list(500)
    result = []
    for u in users:
        ud = doc(u)
        ud["farms_count"] = await db.farms.count_documents({"owner_id": ud["id"]})
        ud["devices_count"] = await db.devices.count_documents({"owner_id": ud["id"]})
        result.append(ud)
    return result

@api_router.put("/admin/users/{uid}/status")
async def admin_update_user_status(uid: str, data: UserStatusUpdate, request: Request):
    await require_admin(request)
    await db.users.update_one({"_id": ObjectId(uid)},
        {"$set": {"status": data.status, "updated_at": datetime.now(timezone.utc)}})
    return {"message": f"Statut mis à jour: {data.status}"}

@api_router.get("/admin/farms")
async def admin_farms(request: Request):
    await require_admin(request)
    farms = await db.farms.find({}).to_list(1000)
    result = []
    for f in farms:
        fd = doc(f)
        user = await db.users.find_one({"_id": ObjectId(f["owner_id"])}, {"first_name": 1, "last_name": 1, "email": 1})
        fd["owner_name"] = f"{user['first_name']} {user['last_name']}" if user else "Inconnu"
        fd["owner_email"] = user.get("email", "") if user else ""
        fd["plots_count"] = await db.plots.count_documents({"farm_id": str(f["_id"])})
        fd["devices_count"] = await db.devices.count_documents({"farm_id": str(f["_id"])})
        result.append(fd)
    return result

@api_router.get("/admin/devices")
async def admin_devices(request: Request, status: Optional[str] = None):
    await require_admin(request)
    q = {"status": status} if status else {}
    devices = await db.devices.find(q).to_list(1000)
    return docs(devices)

@api_router.get("/admin/alerts")
async def admin_alerts(request: Request, severity: Optional[str] = None):
    await require_admin(request)
    q = {"severity": severity} if severity else {}
    alerts = await db.alerts.find(q).sort("created_at", -1).to_list(500)
    return docs(alerts)

@api_router.get("/admin/audit-logs")
async def admin_audit_logs(request: Request, limit: int = 100):
    await require_admin(request)
    logs = await db.audit_logs.find({}).sort("created_at", -1).to_list(limit)
    return docs(logs)

async def _audit(uid: str, action: str, resource_type: str, resource_id: str = "", details: dict = None):
    await db.audit_logs.insert_one({"user_id": uid, "action": action,
        "resource_type": resource_type, "resource_id": resource_id,
        "details": details or {}, "created_at": datetime.now(timezone.utc)})

# ─── Include router ───────────────────────────────────────────────────────────
app.include_router(api_router)
