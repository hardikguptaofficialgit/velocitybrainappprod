const jwt = require('jsonwebtoken');
const { createJwtAccount, db, COLLECTIONS, appwriteInitialized } = require('../config/appwrite');
const { ACCESS_POLICY } = require('../config/access');
const { buildDefaultUserSettings, buildUserDefaults } = require('../utils/account');

const isProduction = process.env.NODE_ENV === 'production';

if (isProduction && !process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET must be configured in production');
}

const JWT_SECRET = process.env.JWT_SECRET || 'velocitybrain-dev-secret';

// Generate JWT token
const generateToken = (userId) => {
    return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '24h' });
};

const ensureUserProfile = async (appwriteUser) => {
    const userId = appwriteUser.$id || appwriteUser.id;
    const email = String(appwriteUser.email || '').trim().toLowerCase();
    const name = appwriteUser.name || email.split('@')[0] || '';
    const userRef = db.collection(COLLECTIONS.USERS).doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
        const now = new Date().toISOString();
        await userRef.set({
            ...buildUserDefaults({
                email,
                name,
                tier: ACCESS_POLICY.defaultUserTier
            }),
            appwrite_user_id: userId,
            auth_provider: 'appwrite',
            email_verified: Boolean(appwriteUser.emailVerification),
            created_at: now,
            updated_at: now,
            last_login_at: now
        });
        await db.collection(COLLECTIONS.USER_SETTINGS).doc(userId).set(buildDefaultUserSettings());
        return userRef.get();
    }

    const data = userDoc.data();
    await userRef.update({
        email: data.email || email,
        name: data.name || name,
        appwrite_user_id: userId,
        auth_provider: data.auth_provider || 'appwrite',
        email_verified: Boolean(appwriteUser.emailVerification),
        last_login_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    });
    return userRef.get();
};

const buildRequestUser = (userDoc) => {
    const user = userDoc.data();
    return {
        id: userDoc.id,
        email: user.email,
        name: user.name,
        tier: user.tier,
        title: user.title || '',
        company: user.company || '',
        accountType: user.account_type || '',
        avatarUrl: user.avatar_url || '',
        workspaceId: user.workspace_id || '',
        workspaceIds: Array.isArray(user.workspace_ids) ? user.workspace_ids : [],
        onboardingCompleted: Boolean(user.onboarding_completed)
    };
};

const loadAppwriteUserFromToken = async (token) => {
    const account = createJwtAccount(token);
    return account.get();
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
        
        if (!appwriteInitialized) {
            return res.status(503).json({ success: false, message: 'Database not initialized' });
        }

        let userDoc;
        if (decoded.userId) {
            userDoc = await db.collection(COLLECTIONS.USERS).doc(decoded.userId).get();
        } else {
            const appwriteUser = await loadAppwriteUserFromToken(token);
            userDoc = await ensureUserProfile(appwriteUser);
        }
        
        if (!userDoc.exists) {
            console.warn(`[AuthMiddleware] User doc not found for ${requestPath}`, { userId: decoded.userId });
            return res.status(401).json({ success: false, message: 'User not found' });
        }

        const user = userDoc.data();
        
        if (user.status !== 'active') {
            console.warn(`[AuthMiddleware] Inactive user blocked for ${requestPath}`, { userId: userDoc.id, status: user.status });
            return res.status(401).json({ success: false, message: 'User not found or inactive' });
        }

        req.user = buildRequestUser(userDoc);

        console.info(`[AuthMiddleware] Authenticated ${requestPath}`, {
            userId: req.user.id,
            email: req.user.email,
            tier: req.user.tier
        });
        
        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
            try {
                const token = req.headers.authorization?.replace('Bearer ', '');
                if (!token || !appwriteInitialized) {
                    return res.status(401).json({ success: false, message: 'Invalid token' });
                }
                const appwriteUser = await loadAppwriteUserFromToken(token);
                const userDoc = await ensureUserProfile(appwriteUser);
                if (!userDoc.exists || userDoc.data().status !== 'active') {
                    return res.status(401).json({ success: false, message: 'User not found or inactive' });
                }
                req.user = buildRequestUser(userDoc);
                return next();
            } catch (appwriteError) {
                console.warn('[AuthMiddleware] Invalid Appwrite JWT', {
                    path: `${req.method} ${req.originalUrl}`,
                    error: appwriteError?.message
                });
                return res.status(401).json({ success: false, message: 'Invalid token' });
            }
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
        
        if (token && appwriteInitialized) {
            let userDoc;
            try {
                const decoded = jwt.verify(token, JWT_SECRET);
                userDoc = await db.collection(COLLECTIONS.USERS).doc(decoded.userId).get();
            } catch {
                const appwriteUser = await loadAppwriteUserFromToken(token);
                userDoc = await ensureUserProfile(appwriteUser);
            }
            
            if (userDoc.exists) {
                const user = userDoc.data();
                if (user.status === 'active') {
                    req.user = buildRequestUser(userDoc);
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
            if (!appwriteInitialized) {
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
