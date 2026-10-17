const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { getDatabase } = require('./database');

async function seed() {
    console.log('[SafeHer Seed] Starting database initialization & seeding...');
    const db = getDatabase();

    // 1. Run Schema
    const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    db.exec(schemaSql);
    console.log('[SafeHer Seed] Schema tables verified.');

    // Password hash for all demo accounts: 'SafeHer@123'
    const salt = bcrypt.genSaltSync(10);
    const demoPasswordHash = bcrypt.hashSync('SafeHer@123', salt);

    // 2. Demo Users
    const users = [
        {
            id: 'usr-demo-001',
            name: 'Ananya Sharma',
            email: 'user@safeher.org',
            phone: '+91 98765 00001',
            password_hash: demoPasswordHash,
            role: 'user',
            home_city: 'Hyderabad',
            blood_group: 'B+',
            allergies: 'Penicillin, Dust',
            emergency_note: 'Asthma inhaler in purse. Please inform family immediately.',
            language: 'en'
        },
        {
            id: 'usr-contact-001',
            name: 'Ramesh Sharma (Father)',
            email: 'contact@safeher.org',
            phone: '+91 98765 43210',
            password_hash: demoPasswordHash,
            role: 'contact',
            home_city: 'Hyderabad',
            blood_group: 'B+',
            allergies: 'None',
            emergency_note: '',
            language: 'en'
        },
        {
            id: 'usr-police-001',
            name: 'Banjara Hills Police Station Dispatch',
            email: 'police@safeher.org',
            phone: '112',
            password_hash: demoPasswordHash,
            role: 'police',
            home_city: 'Hyderabad',
            blood_group: 'O+',
            allergies: 'None',
            emergency_note: 'Official ERSS 112 Dispatch Desk',
            language: 'en'
        },
        {
            id: 'usr-hospital-001',
            name: 'Apollo Hospital Emergency Trauma Center',
            email: 'hospital@safeher.org',
            phone: '108',
            password_hash: demoPasswordHash,
            role: 'hospital',
            home_city: 'Hyderabad',
            blood_group: 'O+',
            allergies: 'None',
            emergency_note: 'Trauma & Ambulance Hotline',
            language: 'en'
        }
    ];

    const insertUser = db.prepare(`
        INSERT OR REPLACE INTO users (id, name, email, phone, password_hash, role, home_city, blood_group, allergies, emergency_note, language)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const u of users) {
        insertUser.run(u.id, u.name, u.email, u.phone, u.password_hash, u.role, u.home_city, u.blood_group, u.allergies, u.emergency_note, u.language);
    }
    console.log('[SafeHer Seed] Demo accounts created (User, Contact, Police, Hospital).');

    // 3. Trusted Contacts for Ananya
    const contacts = [
        { id: 'cnt-01', user_id: 'usr-demo-001', name: 'Ramesh Sharma', phone: '+91 98765 43210', relationship: 'Father', priority: 1 },
        { id: 'cnt-02', user_id: 'usr-demo-001', name: 'Priya Sharma', phone: '+91 98765 43211', relationship: 'Sister', priority: 2 },
        { id: 'cnt-03', user_id: 'usr-demo-001', name: 'Sneha Reddy', phone: '+91 98765 43212', relationship: 'Roommate', priority: 3 }
    ];

    const insertContact = db.prepare(`
        INSERT OR REPLACE INTO trusted_contacts (id, user_id, name, phone, relationship, priority)
        VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const c of contacts) {
        insertContact.run(c.id, c.user_id, c.name, c.phone, c.relationship, c.priority);
    }
    console.log('[SafeHer Seed] Trusted contacts seeded.');

    // 4. Wearable Devices
    const devices = [
        {
            id: 'dev-01',
            user_id: 'usr-demo-001',
            device_id: 'DEV-SAFE-901',
            device_name: 'SafeHer Smart Pendant v1',
            type: 'pendant',
            api_key: 'safeher_live_key_901',
            battery_pct: 94,
            status: 'online'
        },
        {
            id: 'dev-02',
            user_id: 'usr-demo-001',
            device_id: 'DEV-SAFE-902',
            device_name: 'SafeHer BLE Smart Band',
            type: 'band',
            api_key: 'safeher_live_key_902',
            battery_pct: 78,
            status: 'online'
        }
    ];

    const insertDevice = db.prepare(`
        INSERT OR REPLACE INTO devices (id, user_id, device_id, device_name, type, api_key, battery_pct, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const d of devices) {
        insertDevice.run(d.id, d.user_id, d.device_id, d.device_name, d.type, d.api_key, d.battery_pct, d.status);
    }
    console.log('[SafeHer Seed] Demo wearable devices seeded.');

    // 5. Emergency Services (Police & Hospitals)
    const services = [
        { id: 'srv-01', name: 'Banjara Hills Police Station', type: 'police', city: 'Hyderabad', lat: 17.4156, lng: 78.4350, phone: '040-27853562', is_24x7: 1 },
        { id: 'srv-02', name: 'Jubilee Hills Police Station', type: 'police', city: 'Hyderabad', lat: 17.4319, lng: 78.4073, phone: '040-27853570', is_24x7: 1 },
        { id: 'srv-03', name: 'Panjagutta Police Station', type: 'police', city: 'Hyderabad', lat: 17.4261, lng: 78.4528, phone: '040-27853560', is_24x7: 1 },
        { id: 'srv-04', name: 'Apollo Hospitals Emergency Trauma', type: 'hospital', city: 'Hyderabad', lat: 17.4265, lng: 78.4118, phone: '1066', is_24x7: 1 },
        { id: 'srv-05', name: 'Care Hospitals Banjara Hills', type: 'hospital', city: 'Hyderabad', lat: 17.4184, lng: 78.4487, phone: '040-61656565', is_24x7: 1 },
        { id: 'srv-06', name: 'MedPlus 24x7 Pharmacy & Clinic', type: 'pharmacy', city: 'Hyderabad', lat: 17.4225, lng: 78.4312, phone: '040-67006700', is_24x7: 1 }
    ];

    const insertService = db.prepare(`
        INSERT OR REPLACE INTO emergency_services (id, name, type, city, lat, lng, phone, is_24x7)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const s of services) {
        insertService.run(s.id, s.name, s.type, s.city, s.lat, s.lng, s.phone, s.is_24x7);
    }
    console.log('[SafeHer Seed] Emergency services seeded.');

    // 6. Community Incident Reports
    const incidents = [
        {
            id: 'inc-01',
            reporter_id: 'anonymous',
            category: 'poor_lighting',
            lat: 17.4215,
            lng: 78.4370,
            address: 'Road No. 12 back alley, Banjara Hills',
            description: 'Street lamps have been out for 2 weeks. Very dark after 8 PM.'
        },
        {
            id: 'inc-02',
            reporter_id: 'anonymous',
            category: 'harassment',
            lat: 17.4280,
            lng: 78.4150,
            address: 'Near Metro Pillar 1042',
            description: 'Catcalling reported by group near auto stand late evening.'
        },
        {
            id: 'inc-03',
            reporter_id: 'anonymous',
            category: 'isolated_area',
            lat: 17.4120,
            lng: 78.4280,
            address: 'Under-construction service lane',
            description: 'No commercial activity, zero foot traffic after 9:30 PM.'
        }
    ];

    const insertIncident = db.prepare(`
        INSERT OR REPLACE INTO incident_reports (id, reporter_id, category, lat, lng, address, description)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const inc of incidents) {
        insertIncident.run(inc.id, inc.reporter_id, inc.category, inc.lat, inc.lng, inc.address, inc.description);
    }
    console.log('[SafeHer Seed] Community incident reports seeded.');
    console.log('[SafeHer Seed] Database seeding complete! Ready for use.');
}

if (require.main === module) {
    seed().catch(err => {
        console.error('[SafeHer Seed] Error seeding database:', err);
        process.exit(1);
    });
}

module.exports = seed;
