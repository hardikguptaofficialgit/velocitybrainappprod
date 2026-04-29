const jwt = require('jsonwebtoken');
const { db, COLLECTIONS, firebaseInitialized } = require('../config/firebase');
const { ACCESS_POLICY } = require('../config/access');

const isProduction = process.env.NODE_ENV === 'production';

if (isProduction && !process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET must be configured in production');
}

const JWT_SECRET = process.env.JWT_SECRET || 'velocitybrain-dev-secret';

// Generate JWT token
const generateToken = (userId) => {
    return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '24h' });
};

// Verify JWT token middleware
const authenticate = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        const requestPath = `${req.method} ${req.originalUrl}`;
        
        if (!token) {
            console.warn(`[AuthMiddleware] Missing bearer token for ${requestPath}`);
            return res.status(401).json({ success: false, message: 'Access token required' });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Get user from Firestore
        if (!firebaseInitialized) {
            return res.status(503).json({ success: false, message: 'Database not initialized' });
        }

        const userDoc = await db.collection(COLLECTIONS.USERS).doc(decoded.userId).get();
        
        if (!userDoc.exists) {
            console.warn(`[AuthMiddleware] User doc not found for ${requestPath}`, { userId: decoded.userId });
            return res.status(401).json({ success: false, message: 'User not found' });
        }

        const user = userDoc.data();
        
        if (user.status !== 'active') {
            console.warn(`[AuthMiddleware] Inactive user blocked for ${requestPath}`, { userId: userDoc.id, status: user.status });
            return res.status(401).json({ success: false, message: 'User not found or inactive' });
        }

        req.user = {
            id: userDoc.id,
            email: user.email,
            name: user.name,
            tier: user.tier
        };

        console.info(`[AuthMiddleware] Authenticated ${requestPath}`, {
            userId: req.user.id,
            email: req.user.email,
            tier: req.user.tier
        });
        
        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            console.warn('[AuthMiddleware] Invalid JWT', { path: `${req.method} ${req.originalUrl}` });
            return res.status(401).json({ success: false, message: 'Invalid token' });
        }
        if (error.name === 'TokenExpiredError') {
            console.warn('[AuthMiddleware] Expired JWT', { path: `${req.method} ${req.originalUrl}` });
            return res.status(401).json({ success: false, message: 'Token expired' });
        }
        console.error('[AuthMiddleware] Authentication error', {
            path: `${req.method} ${req.originalUrl}`,
            error
        });
        return res.status(500).json({ success: false, message: 'Authentication error' });
    }
};

// Optional auth - doesn't require token but attaches user if present
const optionalAuth = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        
        if (token && firebaseInitialized) {
            const decoded = jwt.verify(token, JWT_SECRET);
            const userDoc = await db.collection(COLLECTIONS.USERS).doc(decoded.userId).get();
            
            if (userDoc.exists) {
                const user = userDoc.data();
                if (user.status === 'active') {
                    req.user = {
                        id: userDoc.id,
                        email: user.email,
                        name: user.name,
                        tier: user.tier
                    };
                }
            }
        }
        
        next();
    } catch (error) {
        next();
    }
};

// Rate limit by access policy
const tierRateLimit = (tierLimits) => {
    return async (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ success: false, message: 'Authentication required' });
        }

        const fallbackLimit = ACCESS_POLICY.standardQuotas.daily;
        const limit = tierLimits[req.user.tier] || tierLimits.free || fallbackLimit;
        
        // Check usage in last 24 hours
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        
        try {
            if (!firebaseInitialized) {
                next();
                return;
            }

            // Fetch all usage logs for user and filter in memory (avoids composite index requirement)
            const usageSnapshot = await db.collection(COLLECTIONS.USAGE_LOGS)
                .where('user_id', '==', req.user.id)
                .limit(10000)
                .get();
            
            const usageCount = usageSnapshot.docs.filter(doc => {
                const data = doc.data();
                return data.created_at && new Date(data.created_at) > oneDayAgo;
            }).length;

            if (usageCount >= limit) {
                return res.status(429).json({
                    success: false,
                    message: 'Daily usage limit reached for the current free access window. Wait for the quota reset or contact support if you need higher limits.',
                    limit,
                    used: usageCount,
                    accessMessage: ACCESS_POLICY.publicAccessMessage
                });
            }

            req.dailyUsage = usageCount;
            req.dailyLimit = limit;
            next();
        } catch (error) {
            console.error('Rate limit check error:', error);
            next();
        }
    };
};

module.exports = {
    generateToken,
    authenticate,
    optionalAuth,
    tierRateLimit
};
