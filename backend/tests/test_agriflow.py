"""AgriFlow full API test suite - sequential, cookie-based auth"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
ADMIN_EMAIL = "admin@agriflow.com"
ADMIN_PASSWORD = "AgriFlow2024!"

_SUFFIX = uuid.uuid4().hex[:6]
TEST_EMAIL = f"testfarmer_{_SUFFIX}@test.com"
TEST_PASSWORD = "TestFarmer2024!"

# ─── Fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def farmer_session():
    s = requests.Session()
    # register new farmer
    r = s.post(f"{BASE_URL}/api/auth/register", json={
        "first_name": "Test", "last_name": "Farmer",
        "email": TEST_EMAIL, "password": TEST_PASSWORD
    })
    assert r.status_code == 200, f"Registration failed: {r.text}"
    yield s
    # cleanup – logout
    s.post(f"{BASE_URL}/api/auth/logout")

@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"Admin login failed: {r.text}"
    yield s
    s.post(f"{BASE_URL}/api/auth/logout")

@pytest.fixture(scope="module")
def farm_id(farmer_session):
    r = farmer_session.post(f"{BASE_URL}/api/farms", json={"name": "TEST_Ferme Alpha", "location": "Lyon"})
    assert r.status_code == 200, r.text
    return r.json()["id"]

@pytest.fixture(scope="module")
def plot_id(farmer_session, farm_id):
    r = farmer_session.post(f"{BASE_URL}/api/plots", json={
        "farm_id": farm_id, "name": "TEST_Parcelle B1", "crop_type": "Blé", "area": 10.5
    })
    assert r.status_code == 200, r.text
    return r.json()["id"]

@pytest.fixture(scope="module")
def device_id(farmer_session, farm_id, plot_id):
    uid = uuid.uuid4().hex[:8]
    r = farmer_session.post(f"{BASE_URL}/api/devices", json={
        "farm_id": farm_id, "plot_id": plot_id,
        "name": "TEST_Sensor001", "device_uid": f"DEV-TEST-{uid}",
        "device_type": "soil_sensor", "sensor_types": ["soil_moisture", "air_temperature"]
    })
    assert r.status_code == 200, r.text
    return r.json()["id"]

# ─── Auth tests ───────────────────────────────────────────────────────────────

def test_admin_login():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["role"] == "admin"
    assert d["email"] == ADMIN_EMAIL
    print(f"Admin login OK")

def test_admin_me(admin_session):
    r = admin_session.get(f"{BASE_URL}/api/auth/me")
    assert r.status_code == 200, r.text
    assert r.json()["role"] == "admin"
    print("Admin /me OK")

def test_farmer_register_and_me(farmer_session):
    r = farmer_session.get(f"{BASE_URL}/api/auth/me")
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["role"] == "farmer"
    assert d["email"] == TEST_EMAIL
    print("Farmer /me OK")

def test_duplicate_register():
    r = requests.post(f"{BASE_URL}/api/auth/register", json={
        "first_name": "Dup", "last_name": "User",
        "email": TEST_EMAIL, "password": TEST_PASSWORD
    })
    assert r.status_code == 400
    print("Duplicate email rejected OK")

def test_wrong_password_rejected():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": "wrongpass"})
    assert r.status_code == 401
    print("Wrong password rejected OK")

# ─── Farm tests ───────────────────────────────────────────────────────────────

def test_create_farm(farm_id):
    assert farm_id is not None
    print(f"Farm created: {farm_id}")

def test_get_farms(farmer_session):
    r = farmer_session.get(f"{BASE_URL}/api/farms")
    assert r.status_code == 200, r.text
    assert isinstance(r.json(), list)
    print(f"Got {len(r.json())} farms")

def test_get_farm_by_id(farmer_session, farm_id):
    r = farmer_session.get(f"{BASE_URL}/api/farms/{farm_id}")
    assert r.status_code == 200, r.text
    assert r.json()["id"] == farm_id
    print("Get farm by id OK")

# ─── Plot tests ───────────────────────────────────────────────────────────────

def test_create_plot(plot_id):
    assert plot_id is not None
    print(f"Plot created: {plot_id}")

def test_get_plots(farmer_session):
    r = farmer_session.get(f"{BASE_URL}/api/plots")
    assert r.status_code == 200, r.text
    assert isinstance(r.json(), list)
    print(f"Got {len(r.json())} plots")

# ─── Device tests ─────────────────────────────────────────────────────────────

def test_create_device(device_id):
    assert device_id is not None
    print(f"Device created: {device_id}")

def test_get_devices(farmer_session):
    r = farmer_session.get(f"{BASE_URL}/api/devices")
    assert r.status_code == 200, r.text
    assert isinstance(r.json(), list)
    print(f"Got {len(r.json())} devices")

# ─── Readings & Alerts ────────────────────────────────────────────────────────

def test_create_reading_low_moisture(farmer_session, device_id, plot_id):
    r = farmer_session.post(f"{BASE_URL}/api/readings", json={
        "device_id": device_id, "plot_id": plot_id,
        "soil_moisture": 15.0, "air_temperature": 25.0
    })
    assert r.status_code == 200, r.text
    print("Reading created OK")

def test_get_alerts(farmer_session):
    r = farmer_session.get(f"{BASE_URL}/api/alerts")
    assert r.status_code == 200, r.text
    alerts = r.json()
    assert isinstance(alerts, list)
    # Low moisture reading should have generated a critical alert
    assert len(alerts) >= 1, "Expected at least 1 alert from low moisture reading"
    print(f"Got {len(alerts)} alerts")

def test_generate_predictions(farmer_session, plot_id):
    r = farmer_session.post(f"{BASE_URL}/api/predictions/generate/{plot_id}")
    assert r.status_code == 200, r.text
    preds = r.json()
    assert isinstance(preds, list)
    assert len(preds) >= 1
    print(f"Generated {len(preds)} predictions")

def test_get_predictions(farmer_session, plot_id):
    r = farmer_session.get(f"{BASE_URL}/api/predictions?plot_id={plot_id}")
    assert r.status_code == 200, r.text
    assert isinstance(r.json(), list)
    print(f"Got {len(r.json())} predictions")

# ─── Admin endpoints ──────────────────────────────────────────────────────────

def test_admin_get_users(admin_session):
    r = admin_session.get(f"{BASE_URL}/api/admin/users")
    assert r.status_code == 200, r.text
    users = r.json()
    assert isinstance(users, list)
    assert len(users) >= 1
    print(f"Admin: got {len(users)} users")

def test_admin_stats(admin_session):
    r = admin_session.get(f"{BASE_URL}/api/admin/stats")
    assert r.status_code == 200, r.text
    d = r.json()
    assert "total_users" in d
    print(f"Admin stats: total_users={d['total_users']}")

def test_farmer_cannot_access_admin(farmer_session):
    r = farmer_session.get(f"{BASE_URL}/api/admin/users")
    assert r.status_code == 403, r.text
    print("Farmer blocked from admin OK")
