require('dotenv').config();
const path = require('path');
const fs = require('fs');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Database initialization
const { getDatabase } = require('./db/database');
const seedDatabase = require('./db/seed');

// Services & Controllers that need Socket.IO
const notificationService = require('./services/notification.service');
const escalationService = require('./services/escalation.service');
const deviceController = require('./controllers/device.controller');
const alertController = require('./controllers/alert.controller');
const tripController = require('./controllers/trip.controller');
const incidentController = require('./controllers/incident.controller');

// Middlewares
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

// Route Handlers
const authRoutes = require('./routes/auth.routes');
const contactRoutes = require('./routes/contact.routes');
const deviceRoutes = require('./routes/device.routes');
const alertRoutes = require('./routes/alert.routes');
const tripRoutes = require('./routes/trip.routes');
const safetyRoutes = require('./routes/safety.routes');
const incidentRoutes = require('./routes/incident.routes');

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO with CORS
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

// Provide Socket.IO instance to all backend modules
notificationService.setSocketIO(io);
escalationService.setSocketIO(io);
deviceController.setSocketIO(io);
alertController.setSocketIO(io);
tripController.setSocketIO(io);
incidentController.setSocketIO(io);

// Security Middleware (configured to permit Leaflet tiles & inline audio/maps)
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));
app.use(cors());

// Body Parsers (Support up to 10MB for audio evidence uploads)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static frontend directory
app.use(express.static(path.join(__dirname, 'public')));

// Rate Limiter for API endpoints
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000,
    standardHeaders: true,
    legacyHeaders: false
});
app.use('/api/', apiLimiter);

// Register API Routes
app.use('/api/auth', authRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/device', deviceRoutes); // For hardware endpoint: POST /api/device/alert
app.use('/api/alerts', alertRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/safety', safetyRoutes);
app.use('/api/incidents', incidentRoutes);

// Friendly HTML entry points
app.get('/track/:token', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'track.html'));
});

// WebSocket Connection Lifecycle
io.on('connection', (socket) => {
    // Join trip tracking room
    socket.on('trip:join', (shareToken) => {
        socket.join(`trip:${shareToken}`);
    });

    // Join alert tracking room
    socket.on('alert:join', (alertId) => {
        socket.join(`alert:${alertId}`);
    });

    // Join responder channel (police, hospital, contacts)
    socket.on('responder:join', (role) => {
        socket.join('responders');
        if (role) socket.join(`role:${role}`);
    });

    socket.on('disconnect', () => {});
});

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Boot Server
const PORT = process.env.PORT || 3000;

async function startServer() {
    try {
        const db = getDatabase();

        // 1. Ensure tables exist
        const schemaPath = path.join(__dirname, 'db', 'schema.sql');
        if (fs.existsSync(schemaPath)) {
            const schemaSql = fs.readFileSync(schemaPath, 'utf8');
            db.exec(schemaSql);
        }

        // 2. Safe check if users exist
        let userCount = 0;
        try {
            const count = db.prepare('SELECT COUNT(*) as count FROM users').get();
            userCount = count ? count.count : 0;
        } catch (tableErr) {
            userCount = 0;
        }

        if (userCount === 0) {
            console.log('[SafeHer Boot] Database empty. Running initial seed...');
            await seedDatabase();
        }

        server.listen(PORT, () => {
            console.log('========================================================');
            console.log(`🚀 SafeHer Server running at http://localhost:${PORT}`);
            console.log(`📱 Landing Page:     http://localhost:${PORT}`);
            console.log(`🛡️  User Dashboard:   http://localhost:${PORT}/app.html`);
            console.log(`🚨 Responder Portal: http://localhost:${PORT}/responder.html`);
            console.log(`⚡ Wearable Sim:     http://localhost:${PORT}/simulator.html`);
            console.log('========================================================');
        });
    } catch (err) {
        console.error('[SafeHer Boot] Fatal error starting server:', err);
        process.exit(1);
    }
}

startServer();
