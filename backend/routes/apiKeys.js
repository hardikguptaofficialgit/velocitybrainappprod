const express = require('express');
const crypto = require('crypto');
const { db, COLLECTIONS } = require('../config/firebase');
const { authenticate } = require('../middleware/auth');
const { ACCESS_POLICY, getStandardQuota } = require('../config/access');

const router = express.Router();

const STANDARD_QUOTA = getStandardQuota();

// Generate API key
function generateApiKey() {
    return 'vb-' + crypto.randomBytes(32).toString('hex');
}

// Hash API key for storage
function hashApiKey(key) {
    return crypto.createHash('sha256').update(key).digest('hex');
}

async function getOwnedApiKeyDoc(userId, keyId) {
    const keyDoc = await db.collection(COLLECTIONS.API_KEYS).doc(keyId).get();

    if (!keyDoc.exists) {
        return { error: 'API key not found', status: 404 };
    }

    const keyData = keyDoc.data();
    if (keyData.user_id !== userId) {
        return { error: 'Forbidden', status: 403 };
    }

    return { keyDoc, keyData };
}

// List API keys
router.get('/', authenticate, async (req, res) => {
    try {
        const keys = await db.collection(COLLECTIONS.API_KEYS).where('user_id', '==', req.user.id).get();

        const formattedKeys = keys.docs.map(keyDoc => {
            const key = keyDoc.data();
            return {
                id: keyDoc.id,
                name: key.name,
                keyPrefix: key.key_prefix,
                tier: key.tier,
                accessModel: ACCESS_POLICY.limitedAccessLabel,
                status: key.status,
                createdAt: key.created_at,
                lastUsedAt: key.last_used_at,
                dailyQuota: key.daily_quota,
                monthlyQuota: key.monthly_quota,
                usage: {
                    daily: 0,
                    monthly: 0,
                    total: 0
                }
            };
        });

        res.json(formattedKeys);
    } catch (error) {
        console.error('List API keys error:', error);
        res.status(500).json({ success: false, message: 'Failed to list API keys' });
    }
});

// Create API key
router.post('/', authenticate, async (req, res) => {
    try {
        const { name } = req.body;
        const tier = req.user.tier || ACCESS_POLICY.defaultUserTier;

        if (!name) {
            return res.status(400).json({ success: false, message: 'Name is required' });
        }

        // Generate key
        const apiKey = generateApiKey();
        const keyHash = hashApiKey(apiKey);
        const keyPrefix = apiKey.substring(0, 14); // vb- + 12 hex chars

        const now = new Date().toISOString();
        const keyRef = await db.collection(COLLECTIONS.API_KEYS).add({
            user_id: req.user.id,
            name,
            key_hash: keyHash,
            key_prefix: keyPrefix,
            tier,
            status: 'active',
            created_at: now,
            last_used_at: null,
            daily_quota: STANDARD_QUOTA.daily,
            monthly_quota: STANDARD_QUOTA.monthly
        });

        res.json({
            success: true,
            key: apiKey,
            access: {
                label: ACCESS_POLICY.limitedAccessLabel,
                message: ACCESS_POLICY.publicAccessMessage
            },
            apiKey: {
                id: keyRef.id,
                name,
                keyPrefix,
                tier,
                status: 'active',
                createdAt: now,
                dailyQuota: STANDARD_QUOTA.daily,
                monthlyQuota: STANDARD_QUOTA.monthly
            }
        });
    } catch (error) {
        console.error('Create API key error:', error);
        res.status(500).json({ success: false, message: 'Failed to create API key' });
    }
});

// Update API key
router.patch('/:id', authenticate, async (req, res) => {
    try {
        const { name, status } = req.body;
        const ownedKey = await getOwnedApiKeyDoc(req.user.id, req.params.id);
        if (ownedKey.error) {
            return res.status(ownedKey.status).json({ success: false, message: ownedKey.error });
        }

        const updates = {};
        if (name) updates.name = name;
        if (status) updates.status = status;
        updates.daily_quota = STANDARD_QUOTA.daily;
        updates.monthly_quota = STANDARD_QUOTA.monthly;
        updates.updated_at = new Date().toISOString();

        await ownedKey.keyDoc.ref.update(updates);
        const updatedDoc = await db.collection(COLLECTIONS.API_KEYS).doc(req.params.id).get();
        const updated = updatedDoc.data();

        res.json({
            success: true,
            apiKey: {
                id: updatedDoc.id,
                name: updated.name,
                tier: updated.tier,
                status: updated.status,
                dailyQuota: updated.daily_quota,
                monthlyQuota: updated.monthly_quota
            }
        });
    } catch (error) {
        console.error('Update API key error:', error);
        res.status(500).json({ success: false, message: 'Failed to update API key' });
    }
});

// Delete API key
router.delete('/:id', authenticate, async (req, res) => {
    try {
        const ownedKey = await getOwnedApiKeyDoc(req.user.id, req.params.id);
        if (ownedKey.error) {
            return res.status(ownedKey.status).json({ success: false, message: ownedKey.error });
        }

        await ownedKey.keyDoc.ref.delete();
        res.json({ success: true, message: 'API key deleted' });
    } catch (error) {
        console.error('Delete API key error:', error);
        res.status(500).json({ success: false, message: 'Failed to delete API key' });
    }
});

// Validate API key (internal use)
router.post('/validate', async (req, res) => {
    try {
        const { apiKey } = req.body;

        if (!apiKey) {
            return res.status(400).json({ success: false, message: 'API key required' });
        }

        const keyHash = hashApiKey(apiKey);

        const keys = await db.collection(COLLECTIONS.API_KEYS).where('key_hash', '==', keyHash).get();

        if (keys.empty) {
            return res.status(401).json({ success: false, message: 'Invalid API key' });
        }

        const keyDoc = keys.docs[0];
        const key = keyDoc.data();

        if (key.status !== 'active') {
            return res.status(401).json({ success: false, message: 'API key is inactive' });
        }

        // Update last used
        await keyDoc.ref.update({ last_used_at: new Date().toISOString() });

        res.json({
            success: true,
            userId: key.user_id,
            tier: key.tier,
            dailyQuota: key.daily_quota,
            monthlyQuota: key.monthly_quota
        });
    } catch (error) {
        console.error('Validate API key error:', error);
        res.status(500).json({ success: false, message: 'Validation failed' });
    }
});

module.exports = router;
