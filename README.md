# SafeHer – AI Women Safety & Safe Travel Web Application

> **"Safety that works even without your phone."**  
> Built for the College Hackathon on *"Innovative Ideas using AI"*.

SafeHer is an autonomous intermediary platform linking a user, her wearable IoT jewelry/smartband, trusted contacts, police dispatch (112), and emergency medical trauma centers (108). Even if a victim's phone is snatched, turned off, or out of reach, her wearable triggers an alert and helpers can track her live location with explainable AI route safety scores.

---

## 🌟 Key Features (All Implemented End-to-End)

1. **Autonomous Wearable SOS**: Triggers via REST from ESP32 jewelry/smartband without a phone session.
2. **5-Second Cancel Countdown**: Visual countdown circle with audio beeps preventing accidental false alarms.
3. **Multi-Tier Alert Escalation**: Stage 1 (0s): Trusted contacts $\rightarrow$ Stage 2 (60s): Nearest Police Station $\rightarrow$ Stage 3 (120s): Emergency Hospital.
4. **Live Location Sharing (`/track/:token`)**: Zero-app, public real-time Leaflet tracking link with battery & speed telemetry.
5. **AI Area Safety Score (0–100)**: Explainable model evaluating time of day, 24/7 lighting & commercial hubs, police proximity, and community hazard reports.
6. **Safe Route Comparison**: Evaluates 2–3 paths, recommending well-lit avenues over dark alleys.
7. **Safety Check-in Timer (Dead-man's Switch)**: "I'll reach in 30 min" timer; if "I'm Safe" isn't tapped, an automated SOS fires.
8. **Fake Incoming Call**: Synthetic realistic dual-tone phone ring with caller simulation to escape uncomfortable situations.
9. **Nearby Help Finder**: Leaflet map of nearest police stations, hospitals, and 24x7 pharmacies with 1-click Google GPS navigation.
10. **Voice & Shake SOS**: Web Speech API ("help me", "safeher") and `DeviceMotionEvent` violent phone shake triggers.
11. **Silent Audio Evidence**: Records 15s browser audio silently on SOS and securely uploads it to the alert timeline.
12. **Community Hazard Reports**: Anonymous reports on poor lighting and harassment feeding the AI safety heatmap.
13. **Wearable IoT Virtual Simulator**: Testbench for judges to simulate button-press SOS, fall detection, low battery, and moving GPS walker.
14. **Multilingual & Dark Mode**: English, Telugu, and Hindi translations with persistent dark mode toggle.

---

## 🏗️ Folder Structure

```text
safeher/
├── package.json
├── server.js               # Express + Socket.IO Server
├── .env.example
├── .gitignore
├── README.md
├── db/
│   ├── schema.sql          # 11 relational SQLite tables
│   ├── database.js         # Node 22+ native SQLite wrapper
│   └── seed.js             # Demo accounts, police, hospitals, and hazard seed
├── middleware/
│   ├── auth.js             # JWT & Role-Based Access Control
│   └── errorHandler.js     # Centralized error handler
├── routes/
│   ├── auth.routes.js
│   ├── contact.routes.js
│   ├── device.routes.js
│   ├── alert.routes.js
│   ├── trip.routes.js
│   ├── safety.routes.js
│   └── incident.routes.js
├── controllers/
│   ├── auth.controller.js
│   ├── contact.controller.js
│   ├── device.controller.js
│   ├── alert.controller.js
│   ├── trip.controller.js
│   ├── safety.controller.js
│   └── incident.controller.js
├── services/
│   ├── escalation.service.js   # 60s/120s multi-stage alert lifecycle
│   ├── safetyScore.service.js  # Heuristic explainable AI score engine
│   ├── route.service.js        # Safe route evaluator
│   └── notification.service.js # Twilio SMS & Live Simulation Broadcast
├── hardware/
│   └── esp32_wearable.ino      # ESP32 C++ firmware with WiFi, GPS & MPU6050 fall detection
└── public/
    ├── index.html              # Public Landing Page
    ├── auth.html               # Login / Register with Demo auto-fill
    ├── app.html                # User Safety Hub & Feature Cards
    ├── track.html              # Public Real-time Map Tracker (/track/:token)
    ├── responder.html          # Police & Hospital Command Center
    ├── simulator.html          # Wearable Hardware Simulator (For Judges)
    ├── css/
    │   ├── theme.css           # Tokens, CSS vars, dark mode
    │   ├── layout.css          # Responsive sidebar & mobile bottom bar
    │   └── components.css       # SOS pulsing button, countdown modal, fake call UI
    └── js/
        ├── api.js              # Fetch wrapper & toasts
        ├── i18n.js             # English, Telugu, Hindi dictionary
        ├── socket-client.js    # Socket.IO client & simulated SMS popup cards
        ├── auth.js             # Authentication logic
        ├── dashboard.js        # User hub logic & GPS handlers
        ├── track.js            # Live Leaflet tracking renderer
        ├── responder.js        # Police dispatch logic & 1-click resolve
        ├── simulator.js        # IoT virtual testbench
        ├── fake-call.js        # Web Audio synthesizer phone call
        └── voice-shake.js      # Web Speech & DeviceMotion listeners
```

---

## ⚡ Quick Setup & Running Locally

### 1. Install Dependencies
```bash
npm install
```

### 2. Seed Database (Optional – auto-seeds on first launch)
```bash
npm run seed
```

### 3. Start the Server
```bash
npm start
```
The server will boot at: **`http://localhost:3000`**

---

## 👥 Demo Accounts (Pre-Seeded)

All demo accounts share the password: `SafeHer@123`

| Role | Email | Password | Purpose |
| :--- | :--- | :--- | :--- |
| **User** | `user@safeher.org` | `SafeHer@123` | Main Victim Safety Hub (`/app.html`) |
| **Contact** | `contact@safeher.org` | `SafeHer@123` | Father / Trusted Emergency Contact |
| **Police** | `police@safeher.org` | `SafeHer@123` | Banjara Hills Police Station Dispatch (`/responder.html`) |
| **Hospital** | `hospital@safeher.org` | `SafeHer@123` | Apollo Hospital Trauma Center Dispatch |

*(You can also use the 1-click **"⚡ HACKATHON DEMO FAST-FILL"** buttons on the Login page!)*

---

## 👨‍⚖️ Step-by-Step Demo Script for Judges

1. **Step 1: Open the Landing Page**
   - Visit `http://localhost:3000`. Show the problem statement, 4 illustrated steps, and stats strip.
2. **Step 2: Log into User Safety Hub**
   - Click "Login", click the **"👤 User"** fast-fill button, and log in.
   - Show the pulsing red SOS button, Trusted Contacts list, and paired Wearable device (`DEV-SAFE-901`).
   - Show the **AI Area Safety Score gauge (0–100)** with its explainable time/lighting/police breakdown.
3. **Step 3: Open the Responder Command Center in a Second Tab**
   - Open `http://localhost:3000/responder.html` in an Incognito window or second browser tab.
   - Show the real-time Emergency Radar map.
4. **Step 4: Open the Wearable Simulator in a Third Tab**
   - Open `http://localhost:3000/simulator.html`.
   - Click **"Simulate Accelerometer Fall Detection Sensor"**.
   - Notice the signal is sent autonomously via HTTP without needing the user's phone!
5. **Step 5: Watch the Escalation & Tracking in Real Time**
   - In the Responder tab, notice the sirens chime and the victim's location appear on the map.
   - Click **"Open Public Tracking Map"** (`/track.html?alert=...`) to show how family tracks live location.
   - Return to the simulator and click **"Start Live Moving GPS Walker"**. Watch the victim move across Hyderabad streets in real time!
6. **Step 6: Demonstrate Novel AI & Extra Features**
   - **Fake Call**: Click "Trigger Call in 5s" on the User Hub to demonstrate the Web Audio synthetic ringtone.
   - **Safe Route Suggestion**: Click "Compare Route Safety" to demonstrate the AI-weighted road ranking.
   - **Dead-man's Switch**: Schedule a check-in timer to show how an alert fires if the user fails to tap "I'm Safe".

---

## 🔌 Hardware REST API Table

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/device/alert` | `deviceId` + `apiKey` | Autonomous hardware trigger (`sos`, `fall`, `low-battery`, `phone-lost`) |
| `POST` | `/api/device/telemetry` | `deviceId` + `apiKey` | Heartbeat GPS and battery telemetry |
| `GET` | `/api/trips/track/:token` | None (Public) | Fetch live trip coordinates for loved ones |
| `POST` | `/api/alerts/sos` | Bearer JWT | Mobile/Web user SOS trigger |
| `POST` | `/api/alerts/:id/acknowledge` | Bearer JWT | Police or hospital dispatch acknowledgment |
| `POST` | `/api/alerts/:id/resolve` | Bearer JWT | Mark emergency resolved and safe |
| `GET` | `/api/safety/score` | Query `lat`, `lng` | Compute explainable 0–100 AI Safety Score |
| `POST` | `/api/safety/routes` | Body Coords | Compare safe routes vs dark alleys |
| `POST` | `/api/incidents` | Optional JWT | Anonymous community hazard report |

---

## 🚀 Future Scope

- **Edge ML Model**: Replace the heuristic formula with an on-device TensorFlow Lite model trained on municipal crime statistics.
- **Direct BLE Gateway**: Bluetooth Low Energy mesh integration allowing wearables to hop across nearby devices even when cell reception drops.
- **Govt. ERSS 112 API Integration**: Direct dispatch bridge into national emergency response systems.
- **Native Cross-Platform Mobile App**: Flutter / React Native wrapper with background wake locks and persistent volume-key triggers.
