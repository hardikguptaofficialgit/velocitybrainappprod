const express = require('express');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const OTPAuth = require('otpauth');
const QRCode = require('qrcode');

const { db, COLLECTIONS, appwriteInitialized } = require('../config/appwrite');
const { generateToken, authenticate } = require('../middleware/auth');
const { ACCESS_POLICY } = require('../config/access');
const {
    buildDefaultUserSettings,
    mergeSettings,
    sanitizeText,
    toPublicUser,
    toPublicWorkspace
} = require('../utils/account');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'velocitybrain-dev-secret';
const TWO_FACTOR_CHALLENGE_PURPOSE = '2fa-auth';

const ensureAppwrite = (res) => {
    if (!appwriteInitialized) {
        res.status(503).json({
            success: false,
            message: 'Appwrite not configured. Please set up Appwrite Cloud credentials.'
        });
        return false;
    }
    return true;
};

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

const ensureSettings = async (userId) => {
    const settingsRef = db.collection(COLLECTIONS.USER_SETTINGS).doc(userId);
    const settingsDoc = await settingsRef.get();
    if (!settingsDoc.exists) {
        const defaults = buildDefaultUserSettings();
        await settingsRef.set(defaults);
        return defaults;
    }
    const merged = mergeSettings(settingsDoc.data());
    await settingsRef.set(merged);
    return merged;
};

router.post('/register', (_req, res) => {
    res.status(410).json({
        success: false,
        message: 'Registration is handled by Appwrite Auth. Use the dashboard Appwrite session flow.'
    });
});

router.post('/login', (_req, res) => {
    res.status(410).json({
        success: false,
        message: 'Password sign-in is handled by Appwrite Auth. Use the dashboard Appwrite session flow.'
    });
});

router.get('/me', authenticate, async (req, res) => {
    if (!ensureAppwrite(res)) return;

    const userDoc = await db.collection(COLLECTIONS.USERS).doc(req.user.id).get();
    const userData = userDoc.exists ? userDoc.data() : req.user;
    await ensureSettings(req.user.id);
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

router.patch('/profile', authenticate, [
    body('name').optional().trim().escape(),
    body('email').optional().isEmail().normalizeEmail()
], async (req, res) => {
    try {
        if (!ensureAppwrite(res)) return;

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

router.post('/2fa/setup', authenticate, async (req, res) => {
    try {
        if (!ensureAppwrite(res)) return;

        const user = await db.collection(COLLECTIONS.USERS).doc(req.user.id).get();
        if (!user.exists) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const userData = user.data();
        const secret = generateTotpSecret();
        const issuer = 'VelocityBrain';
        const label = userData.email;
        const uri = buildTotp({ secret, label, issuer }).toString();
        const qrCodeDataURL = await QRCode.toDataURL(uri);

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

router.post('/2fa/verify', authenticate, async (req, res) => {
    try {
        if (!ensureAppwrite(res)) return;

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

        const isValid = verifyTotpCode({
            token,
            secret: userData['2fa_secret'],
            label: userData.email || 'VelocityBrain User'
        });

        if (!isValid) {
            return res.status(400).json({ success: false, message: 'Invalid token' });
        }

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

router.post('/2fa/disable', authenticate, async (req, res) => {
    try {
        if (!ensureAppwrite(res)) return;

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

        const isValid = verifyTotpCode({
            token,
            secret: userData['2fa_secret'],
            label: userData.email || 'VelocityBrain User'
        });

        if (!isValid) {
            return res.status(400).json({ success: false, message: 'Invalid token' });
        }

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
        if (!ensureAppwrite(res)) return;

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

module.exports = router;
