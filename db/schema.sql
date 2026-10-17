-- SafeHer SQLite Database Schema

PRAGMA foreign_keys = ON;

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'user' CHECK(role IN ('user', 'contact', 'police', 'hospital', 'admin')),
    home_city TEXT DEFAULT 'Hyderabad',
    blood_group TEXT DEFAULT 'O+',
    allergies TEXT DEFAULT 'None',
    emergency_note TEXT DEFAULT 'Please contact family immediately.',
    language TEXT DEFAULT 'en' CHECK(language IN ('en', 'te', 'hi')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Trusted Contacts Table
CREATE TABLE IF NOT EXISTS trusted_contacts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    relationship TEXT NOT NULL,
    priority INTEGER DEFAULT 1,
    notify_sms INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Wearable IoT Devices Table
CREATE TABLE IF NOT EXISTS devices (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    device_id TEXT UNIQUE NOT NULL,
    device_name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('watch', 'earring', 'band', 'pendant')),
    api_key TEXT UNIQUE NOT NULL,
    battery_pct INTEGER DEFAULT 100,
    status TEXT DEFAULT 'online' CHECK(status IN ('online', 'offline')),
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Alerts Table
CREATE TABLE IF NOT EXISTS alerts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    device_id TEXT,
    trigger_type TEXT NOT NULL CHECK(trigger_type IN ('sos', 'fall', 'timer_missed', 'shake', 'voice', 'wearable')),
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'escalated_police', 'escalated_hospital', 'acknowledged', 'resolved')),
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    address TEXT,
    battery_pct INTEGER DEFAULT 100,
    audio_evidence_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE SET NULL
);

-- Alert Escalation Event Log
CREATE TABLE IF NOT EXISTS alert_events (
    id TEXT PRIMARY KEY,
    alert_id TEXT NOT NULL,
    stage TEXT NOT NULL CHECK(stage IN ('contacts_notified', 'police_escalated', 'hospital_escalated', 'acknowledged', 'resolved')),
    recipient TEXT NOT NULL,
    note TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (alert_id) REFERENCES alerts(id) ON DELETE CASCADE
);

-- Live Trips Table (with public share token)
CREATE TABLE IF NOT EXISTS trips (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    share_token TEXT UNIQUE NOT NULL,
    start_lat REAL NOT NULL,
    start_lng REAL NOT NULL,
    current_lat REAL NOT NULL,
    current_lng REAL NOT NULL,
    destination TEXT,
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'completed', 'cancelled')),
    battery_pct INTEGER DEFAULT 100,
    speed REAL DEFAULT 0,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    completed_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Location Points Telemetry (breadcrumbs for trips and active alerts)
CREATE TABLE IF NOT EXISTS location_points (
    id TEXT PRIMARY KEY,
    trip_id TEXT,
    alert_id TEXT,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    speed REAL DEFAULT 0,
    battery INTEGER DEFAULT 100,
    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
    FOREIGN KEY (alert_id) REFERENCES alerts(id) ON DELETE CASCADE
);

-- Safety Check-in Timer (Dead-man's Switch)
CREATE TABLE IF NOT EXISTS checkins (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expected_reach_time DATETIME NOT NULL,
    destination TEXT,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'safe', 'expired_alerted')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Community Incident Reports
CREATE TABLE IF NOT EXISTS incident_reports (
    id TEXT PRIMARY KEY,
    reporter_id TEXT,
    category TEXT NOT NULL CHECK(category IN ('poor_lighting', 'harassment', 'isolated_area', 'stalking', 'suspicious_activity')),
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    address TEXT,
    description TEXT,
    reported_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Emergency Services Seed (Police stations & Hospitals)
CREATE TABLE IF NOT EXISTS emergency_services (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('police', 'hospital', 'pharmacy')),
    city TEXT DEFAULT 'Hyderabad',
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    phone TEXT NOT NULL,
    is_24x7 INTEGER DEFAULT 1
);

-- Silent Evidence Files (Audio recordings from browser)
CREATE TABLE IF NOT EXISTS evidence_files (
    id TEXT PRIMARY KEY,
    alert_id TEXT,
    user_id TEXT NOT NULL,
    file_path TEXT NOT NULL,
    duration_sec INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (alert_id) REFERENCES alerts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
