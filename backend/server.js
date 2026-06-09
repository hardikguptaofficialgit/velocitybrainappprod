const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const { getDatabaseHealth, initializeDatabase } = require('./config/appwrite');
const authRoutes = require('./routes/auth');
const apiKeyRoutes = require('./routes/apiKeys');
const usageRoutes = require('./routes/usage');
const hostedRoutes = require('./routes/hosted');
const dashboardRoutes = require('./routes/dashboard');
const settingsRoutes = require('./routes/settings');
const integrationsRoutes = require('./routes/integrations');
const onboardingRoutes = require('./routes/onboarding');

const app = express();
const PORT = process.env.PORT || 5001;
const dashboardBuildPath = path.resolve(__dirname, '../dashboard/build');
const docsRoot = path.resolve(__dirname, '../docs');
const hasDashboardBuild = fs.existsSync(path.join(dashboardBuildPath, 'index.html'));
const shouldServeDashboard = process.env.SERVE_DASHBOARD === 'true' && hasDashboardBuild;
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
const frontendPort = (() => {
    try {
        return new URL(frontendUrl).port || '3000';
    } catch {
        return '3000';
    }
})();
const normalizeOrigin = (value) => {
    if (!value || typeof value !== 'string') {
        return value;
    }

    return value.replace(/\/+$/, '');
};

// PRODUCTION REQUIREMENT: CORS_ORIGINS must include every domain that the
// dashboard is served from, including the primary Vercel deployment URL and
// any custom domains. Missing an origin here causes authenticated dashboard API requests to be blocked by the browser after Appwrite sign-in.
//
// Example (backend .env or Vercel environment variable):
//   CORS_ORIGINS=https://velocitybrain.vercel.app,https://app.velocitybrain.com
//
// Also ensure the same origins are listed as Web platforms in Appwrite Console.
const configuredCorsOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((origin) => normalizeOrigin(origin?.trim()))
    .filter(Boolean);

const allowedOrigins = new Set([
    frontendUrl,
    ...configuredCorsOrigins,
    `http://localhost:${frontendPort}`,
    `http://127.0.0.1:${frontendPort}`,
    `http://localhost:${PORT}`,
    `http://127.0.0.1:${PORT}`
].map(normalizeOrigin));

// Trust proxy (required for rate limiting behind proxies)
app.set('trust proxy', 1);

// Security middleware - allow OAuth popups when this server serves the SPA.
app.use(helmet({
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' }
}));
app.use(cors({
    origin(origin, callback) {
        const normalizedOrigin = normalizeOrigin(origin);

        if (!normalizedOrigin || allowedOrigins.has(normalizedOrigin)) {
            return callback(null, true);
        }

        return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true
}));

// Compression
app.use(compression());

// Logging
app.use(morgan('combined'));

// Rate limiting — authenticated dashboard traffic is excluded so onboarding/login
// flows are not blocked by shared IPs hitting the global cap.
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'velocitybrain-dev-secret';

const hasValidBearerToken = (req) => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        return false;
    }

    try {
        jwt.verify(header.slice(7), JWT_SECRET);
        return true;
    } catch {
        return false;
    }
};

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: Number.parseInt(process.env.RATE_LIMIT_MAX || '500', 10),
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => hasValidBearerToken(req),
    message: { success: false, message: 'Too many requests, please try again later.' }
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: Number.parseInt(process.env.RATE_LIMIT_AUTH_MAX || '60', 10),
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many sign-in attempts, please try again later.' }
});

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/', apiLimiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check
app.get('/health', async (req, res) => {
    const database = await getDatabaseHealth();
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        database
    });
});

app.get('/', (req, res) => {
    res.json({
        success: true,
        service: 'velocitybrain-backend',
        message: 'API server is running',
        health: '/health'
    });
});

app.get('/api/docs/:docName', (req, res) => {
    const { docName } = req.params;

    if (!/^[A-Z0-9_]+\.(md|csv)$/i.test(docName)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid documentation path'
        });
    }

    const target = path.join(docsRoot, docName);
    const relative = path.relative(docsRoot, target);

    if (relative.startsWith('..') || path.isAbsolute(relative) || !fs.existsSync(target)) {
        return res.status(404).json({
            success: false,
            message: 'Documentation file not found'
        });
    }

    res.type(path.extname(target).toLowerCase() === '.csv' ? 'text/csv' : 'text/markdown');
    res.send(fs.readFileSync(target, 'utf8'));
});

// API Routes
app.use('/v1', hostedRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/integrations', integrationsRoutes);
app.use('/api/api-keys', apiKeyRoutes);
app.use('/api/usage', usageRoutes);
app.use('/api/dashboard', dashboardRoutes);

if (shouldServeDashboard) {
    app.use(express.static(dashboardBuildPath));

    app.get(/^\/(?!api\/|health$).*/, (req, res) => {
        res.sendFile(path.join(dashboardBuildPath, 'index.html'));
    });
}

// Error handling
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found'
    });
});

// Start server
async function startServer() {
    try {
        // Initialize Appwrite connection
        const initResult = await initializeDatabase();
        if (initResult?.ok) {
            console.log('Appwrite initialized successfully');
        } else if (initResult?.skipped) {
            console.warn('Appwrite skipped - database features will not be available');
        }

        const server = app.listen(PORT, () => {
            console.log(`VelocityBrain backend running on port ${PORT}`);
            console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
        });

        return server;
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    startServer();
}

module.exports = { app, startServer };
