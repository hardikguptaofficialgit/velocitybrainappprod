const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const { auth, db, COLLECTIONS, firebaseInitialized } = require('../config/firebase');
const { generateToken, authenticate } = require('../middleware/auth');
const { ACCESS_POLICY } = require('../config/access');
const OTPAuth = require('otpauth');
const QRCode = require('qrcode');
const {
    buildDefaultUserSettings,
    buildUserDefaults,
    mergeSettings,
    sanitizeText,
    toPublicUser,
    toPublicWorkspace
} = require('../utils/account');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'velocitybrain-dev-secret';
const TWO_FACTOR_CHALLENGE_PURPOSE = '2fa-auth';

const buildTotp = ({ secret, label, issuer = 'VelocityBrain' }) => new OTPAuth.TOTP({
    issuer,
    label,
    secret
});

const generateTotpSecret = () => new OTPAuth.Secret().base32;

const generateTwoFactorChallengeToken = (userId, channel) => jwt.sign({
    userId,
    purpose: TWO_FACTOR_CHALLENGE_PURPOSE,
    channel
}, JWT_SECRET, { expiresIn: '10m' });

const verifyTotpCode = ({ token, secret, label = 'VelocityBrain User' }) => (
    buildTotp({ secret, label }).validate({
        token: String(token || '').trim(),
        window: 1
    }) !== null
);

const buildTwoFactorChallengeResponse = ({ user, channel, message }) => ({
    success: true,
    requiresTwoFactor: true,
    challengeToken: generateTwoFactorChallengeToken(user.id, channel),
    user: toPublicUser(user.id, user.data()),
    message
});

const getWorkspacePayload = async (workspaceId) => {
    if (!workspaceId) return null;
    const doc = await db.collection(COLLECTIONS.WORKSPACES).doc(workspaceId).get();
    if (!doc.exists) return null;
    return toPublicWorkspace(doc.id, doc.data());
};

// Register
router.post('/register', [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
    body('name').optional().trim().escape()
], async (req, res) => {
    try {
        if (!firebaseInitialized) {
            return res.status(503).json({ 
                success: false, 
                message: 'Firebase not configured. Please set up Firebase credentials.' 
            });
        }

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { email, password, name } = req.body;

        // Check if user exists
        const existingUsers = await db.collection(COLLECTIONS.USERS).where('email', '==', email).get();
        if (!existingUsers.empty) {
            return res.status(409).json({ success: false, message: 'Email already registered' });
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 12);

        // Create user
        const now = new Date().toISOString();
        const userDefaults = buildUserDefaults({
            email,
            name: name || '',
            tier: ACCESS_POLICY.defaultUserTier
        });
        const userRef = await db.collection(COLLECTIONS.USERS).add({
            ...userDefaults,
            password_hash: passwordHash,
            created_at: now,
            updated_at: now
        });
        await db.collection(COLLECTIONS.USER_SETTINGS).doc(userRef.id).set(buildDefaultUserSettings());

        // Generate token
        const token = generateToken(userRef.id);

        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            access: {
                label: ACCESS_POLICY.limitedAccessLabel,
                message: ACCESS_POLICY.publicAccessMessage
            },
            user: toPublicUser(userRef.id, userDefaults),
            token
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ success: false, message: 'Registration failed' });
    }
});

// Login
router.post('/login', [
    body('email').isEmail().normalizeEmail(),
    body('password').exists()
], async (req, res) => {
    try {
        if (!firebaseInitialized) {
            return res.status(503).json({ 
                success: false, 
                message: 'Firebase not configured. Please set up Firebase credentials.' 
            });
        }

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { email, password } = req.body;

        // Find user
        const users = await db.collection(COLLECTIONS.USERS).where('email', '==', email).get();
        if (users.empty) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        const userDoc = users.docs[0];
        const user = userDoc.data();

        // Verify password
        const isValid = await bcrypt.compare(password, user.password_hash);
        if (!isValid) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        // Check status
        if (user.status !== 'active') {
            return res.status(401).json({ success: false, message: 'Account is inactive' });
        }

        if (user['2fa_enabled']) {
            return res.status(202).json(buildTwoFactorChallengeResponse({
                user: userDoc,
                channel: 'password',
                message: 'Two-factor authentication is required to complete sign-in.'
            }));
        }

        // Generate token
        const token = generateToken(userDoc.id);

        const workspace = await getWorkspacePayload(user.workspace_id);

        res.json({
            success: true,
            message: 'Login successful',
            access: {
                label: ACCESS_POLICY.limitedAccessLabel,
                message: ACCESS_POLICY.publicAccessMessage
            },
            user: toPublicUser(userDoc.id, user),
            workspace,
            token
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: 'Login failed' });
    }
});

// Get current user
router.get('/me', authenticate, async (req, res) => {
    const userDoc = await db.collection(COLLECTIONS.USERS).doc(req.user.id).get();
    const userData = userDoc.exists ? userDoc.data() : req.user;
    const settingsRef = db.collection(COLLECTIONS.USER_SETTINGS).doc(req.user.id);
    const settingsDoc = await settingsRef.get();
    if (!settingsDoc.exists) {
        await settingsRef.set(buildDefaultUserSettings());
    } else {
        await settingsRef.set(mergeSettings(settingsDoc.data()));
    }
    const workspace = await getWorkspacePayload(userData.workspace_id);

    res.json({
        success: true,
        user: toPublicUser(req.user.id, userData),
        workspace,
        access: {
            label: ACCESS_POLICY.limitedAccessLabel,
            message: ACCESS_POLICY.publicAccessMessage
        }
    });
});

// Update profile
router.patch('/profile', authenticate, [
    body('name').optional().trim().escape(),
    body('email').optional().isEmail().normalizeEmail()
], async (req, res) => {
    try {
        if (!firebaseInitialized) {
            return res.status(503).json({ 
                success: false, 
                message: 'Firebase not configured. Please set up Firebase credentials.' 
            });
        }

        const updates = {};
        if (req.body.name) updates.name = sanitizeText(req.body.name, 120);
        if (req.body.email) updates.email = req.body.email;
        updates.updated_at = new Date().toISOString();

        await db.collection(COLLECTIONS.USERS).doc(req.user.id).update(updates);
        const userDoc = await db.collection(COLLECTIONS.USERS).doc(req.user.id).get();
        const userData = userDoc.data();

        res.json({
            success: true,
            user: toPublicUser(userDoc.id, userData),
            access: {
                label: ACCESS_POLICY.limitedAccessLabel,
                message: ACCESS_POLICY.publicAccessMessage
            }
        });
    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({ success: false, message: 'Update failed' });
    }
});

// Setup 2FA
router.post('/2fa/setup', authenticate, async (req, res) => {
    try {
        if (!firebaseInitialized) {
            return res.status(503).json({
                success: false,
                message: 'Firebase not configured. Please set up Firebase credentials.'
            });
        }

        const user = await db.collection(COLLECTIONS.USERS).doc(req.user.id).get();
        if (!user.exists) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const userData = user.data();

        // Generate a unique secret for this user
        const secret = generateTotpSecret();
        const issuer = 'VelocityBrain';
        const label = userData.email;

        // Generate OTPAuth URI for QR code
        const uri = buildTotp({ secret, label, issuer }).toString();

        // Generate QR code as data URL
        const qrCodeDataURL = await QRCode.toDataURL(uri);

        // Store the secret temporarily (not yet enabled)
        await user.ref.update({
            '2fa_secret': secret,
            '2fa_enabled': false,
            updated_at: new Date().toISOString()
        });

        res.json({
            success: true,
            secret,
            qrCode: qrCodeDataURL,
            user: toPublicUser(user.id, {
                ...userData,
                '2fa_secret': secret,
                '2fa_enabled': false
            }),
            message: 'Scan the QR code with your authenticator app, then verify to enable 2FA'
        });
    } catch (error) {
        console.error('2FA setup error:', error);
        res.status(500).json({ success: false, message: 'Failed to setup 2FA' });
    }
});

// Verify and enable 2FA
router.post('/2fa/verify', authenticate, async (req, res) => {
    try {
        if (!firebaseInitialized) {
            return res.status(503).json({ 
                success: false, 
                message: 'Firebase not configured. Please set up Firebase credentials.' 
            });
        }

        const { token } = req.body;

        if (!token) {
            return res.status(400).json({ success: false, message: 'Token is required' });
        }

        const user = await db.collection(COLLECTIONS.USERS).doc(req.user.id).get();
        if (!user.exists) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const userData = user.data();

        if (!userData['2fa_secret']) {
            return res.status(400).json({ success: false, message: '2FA not setup yet' });
        }

        // Verify the token
        const isValid = verifyTotpCode({
            token,
            secret: userData['2fa_secret'],
            label: userData.email || 'VelocityBrain User'
        });

        if (!isValid) {
            return res.status(400).json({ success: false, message: 'Invalid token' });
        }

        // Enable 2FA
        await user.ref.update({
            '2fa_enabled': true,
            updated_at: new Date().toISOString()
        });
        const refreshedUser = await db.collection(COLLECTIONS.USERS).doc(req.user.id).get();

        res.json({
            success: true,
            message: '2FA enabled successfully',
            user: toPublicUser(refreshedUser.id, refreshedUser.data())
        });
    } catch (error) {
        console.error('2FA verify error:', error);
        res.status(500).json({ success: false, message: 'Failed to verify 2FA' });
    }
});

// Disable 2FA
router.post('/2fa/disable', authenticate, async (req, res) => {
    try {
        if (!firebaseInitialized) {
            return res.status(503).json({ 
                success: false, 
                message: 'Firebase not configured. Please set up Firebase credentials.' 
            });
        }

        const { token } = req.body;

        if (!token) {
            return res.status(400).json({ success: false, message: 'Token is required' });
        }

        const user = await db.collection(COLLECTIONS.USERS).doc(req.user.id).get();
        if (!user.exists) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const userData = user.data();

        if (!userData['2fa_enabled']) {
            return res.status(400).json({ success: false, message: '2FA is not enabled' });
        }

        // Verify the token before disabling
        const isValid = verifyTotpCode({
            token,
            secret: userData['2fa_secret'],
            label: userData.email || 'VelocityBrain User'
        });

        if (!isValid) {
            return res.status(400).json({ success: false, message: 'Invalid token' });
        }

        // Disable 2FA
        await user.ref.update({
            '2fa_enabled': false,
            '2fa_secret': null,
            updated_at: new Date().toISOString()
        });
        const refreshedUser = await db.collection(COLLECTIONS.USERS).doc(req.user.id).get();

        res.json({
            success: true,
            message: '2FA disabled successfully',
            user: toPublicUser(refreshedUser.id, refreshedUser.data())
        });
    } catch (error) {
        console.error('2FA disable error:', error);
        res.status(500).json({ success: false, message: 'Failed to disable 2FA' });
    }
});

router.post('/2fa/complete', [
    body('challengeToken').notEmpty().trim(),
    body('token').notEmpty().trim()
], async (req, res) => {
    try {
        if (!firebaseInitialized) {
            return res.status(503).json({
                success: false,
                message: 'Firebase not configured. Please set up Firebase credentials.'
            });
        }

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        let challenge;
        try {
            challenge = jwt.verify(req.body.challengeToken, JWT_SECRET);
        } catch (error) {
            return res.status(401).json({
                success: false,
                message: error?.name === 'TokenExpiredError'
                    ? 'Two-factor challenge expired. Please sign in again.'
                    : 'Invalid two-factor challenge.'
            });
        }

        if (challenge.purpose !== TWO_FACTOR_CHALLENGE_PURPOSE || !challenge.userId) {
            return res.status(401).json({ success: false, message: 'Invalid two-factor challenge.' });
        }

        const userDoc = await db.collection(COLLECTIONS.USERS).doc(challenge.userId).get();
        if (!userDoc.exists) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const userData = userDoc.data();
        if (userData.status !== 'active') {
            return res.status(401).json({ success: false, message: 'Account is inactive' });
        }

        if (!userData['2fa_enabled'] || !userData['2fa_secret']) {
            return res.status(400).json({
                success: false,
                message: 'Two-factor authentication is not enabled for this account.'
            });
        }

        const isValid = verifyTotpCode({
            token: req.body.token,
            secret: userData['2fa_secret'],
            label: userData.email || 'VelocityBrain User'
        });

        if (!isValid) {
            return res.status(400).json({ success: false, message: 'Invalid token' });
        }

        const token = generateToken(userDoc.id);
        const workspace = await getWorkspacePayload(userData.workspace_id);

        res.json({
            success: true,
            message: 'Two-factor sign-in complete.',
            access: {
                label: ACCESS_POLICY.limitedAccessLabel,
                message: ACCESS_POLICY.publicAccessMessage
            },
            user: toPublicUser(userDoc.id, userData),
            workspace,
            token
        });
    } catch (error) {
        console.error('2FA completion error:', error);
        res.status(500).json({ success: false, message: 'Failed to complete two-factor sign-in' });
    }
});

// Firebase Session Authentication
// This endpoint syncs Firebase OAuth users with the backend database
router.post('/firebase-session', [
    body('idToken').notEmpty().trim()
], async (req, res) => {
    try {
        if (!firebaseInitialized) {
            return res.status(503).json({ 
                success: false, 
                message: 'Firebase not configured. Please set up Firebase credentials.' 
            });
        }

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { idToken } = req.body;
        const decodedToken = await auth.verifyIdToken(idToken);
        const userId = decodedToken.uid;
        const email = decodedToken.email;
        const name = decodedToken.name || decodedToken.displayName || '';

        if (!userId || !email) {
            return res.status(401).json({
                success: false,
                message: 'Invalid Firebase identity token'
            });
        }

        console.info('[AuthRoute] Firebase session sync requested', {
            userId,
            email
        });

        const OAUTH_PASSWORD_PLACEHOLDER = '__firebase_oauth_account__';
        const now = new Date().toISOString();

        // Check if user exists in our database
        const existingUsers = await db.collection(COLLECTIONS.USERS).where('email', '==', email).get();
        
        let userDoc;
        let userData;

        if (!existingUsers.empty) {
            // Update existing user
            const existingDoc = existingUsers.docs[0];
            await existingDoc.ref.update({
                name: sanitizeText(name, 120) || existingDoc.data().name,
                password_hash: existingDoc.data().password_hash || OAUTH_PASSWORD_PLACEHOLDER,
                updated_at: now
            });
            userDoc = await db.collection(COLLECTIONS.USERS).doc(existingDoc.id).get();
            userData = userDoc.data();
            console.info('[AuthRoute] Updated existing Firebase session user', {
                userId: userDoc.id,
                email: userData.email
            });
        } else {
            // Create new user from Firebase OAuth
            const userPayload = {
                ...buildUserDefaults({
                    email,
                    name,
                    tier: ACCESS_POLICY.defaultUserTier
                }),
                password_hash: OAUTH_PASSWORD_PLACEHOLDER,
                created_at: now,
                updated_at: now
            };
            await db.collection(COLLECTIONS.USERS).doc(userId).set(userPayload);
            await db.collection(COLLECTIONS.USER_SETTINGS).doc(userId).set(buildDefaultUserSettings());
            userDoc = await db.collection(COLLECTIONS.USERS).doc(userId).get();
            userData = userDoc.data();
            console.info('[AuthRoute] Created new Firebase session user', {
                userId: userDoc.id,
                email: userData.email
            });

        }

        const settingsRef = db.collection(COLLECTIONS.USER_SETTINGS).doc(userDoc.id);
        const settingsDoc = await settingsRef.get();
        if (!settingsDoc.exists) {
            await settingsRef.set(buildDefaultUserSettings());
        } else {
            await settingsRef.set(mergeSettings(settingsDoc.data()));
        }

        if (userData['2fa_enabled']) {
            return res.status(202).json(buildTwoFactorChallengeResponse({
                user: userDoc,
                channel: 'firebase',
                message: 'Two-factor authentication is required to complete sign-in.'
            }));
        }

        // Generate JWT token
        const token = generateToken(userDoc.id);
        console.info('[AuthRoute] Firebase session sync succeeded', {
            userId: userDoc.id,
            email: userData.email,
            hasToken: Boolean(token)
        });

        const workspace = await getWorkspacePayload(userData.workspace_id);

        res.json({
            success: true,
            access: {
                label: ACCESS_POLICY.limitedAccessLabel,
                message: ACCESS_POLICY.publicAccessMessage
            },
            user: toPublicUser(userDoc.id, userData),
            workspace,
            token
        });
    } catch (error) {
        console.error('[AuthRoute] Firebase session error', {
            body: {
                hasIdToken: Boolean(req.body?.idToken)
            },
            error
        });
        if (error?.code === 'auth/argument-error' || error?.code?.startsWith('auth/')) {
            return res.status(401).json({
                success: false,
                message: 'Invalid Firebase identity token'
            });
        }
        res.status(500).json({
            success: false,
            message: error.message || 'Session sync failed'
        });
    }
});

module.exports = router;
