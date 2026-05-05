const express = require('express');
const crypto = require('crypto');
const { db, COLLECTIONS } = require('../config/firebase');
const { authenticate } = require('../middleware/auth');
const { ACCESS_POLICY, getStandardQuota } = require('../config/access');
const { aggregateObservability } = require('../utils/observability');

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
        const [usageSnapshot, connectionSnapshot] = await Promise.all([
            db.collection(COLLECTIONS.USAGE_LOGS).where('user_id', '==', req.user.id).limit(10000).get(),
            db.collection(COLLECTIONS.AGENT_CONNECTIONS).where('user_id', '==', req.user.id).limit(500).get()
        ]);

        const usageLogs = usageSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        const connections = connectionSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        const intelligence = aggregateObservability({
            logs: usageLogs,
            connections,
            apiKeys: keys.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
        });

        const formattedKeys = keys.docs.map(keyDoc => {
            const key = keyDoc.data();
            const keyConnections = connections.filter((connection) => connection.api_key_id === keyDoc.id);
            const keyUsage = usageLogs.filter((log) => log.api_key_id === keyDoc.id);
            const linkedRepos = new Set(keyConnections.map((connection) => connection.repo_id || 'default-workspace'));
            const linkedAgents = new Set(keyConnections.map((connection) => connection.agent_id).filter(Boolean));
            const lastSeen = keyUsage
                .map((log) => log.created_at)
                .sort((a, b) => new Date(b || 0) - new Date(a || 0))[0] || key.last_used_at || null;
            return {
                id: keyDoc.id,
                name: key.name,
                keyPrefix: key.key_prefix,
                tier: key.tier,
                accessModel: ACCESS_POLICY.limitedAccessLabel,
                status: key.status,
                createdAt: key.created_at,
                lastUsedAt: key.last_used_at,
                revokedAt: key.revoked_at || null,
                lastRotatedAt: key.last_rotated_at || null,
                dailyQuota: key.daily_quota,
                monthlyQuota: key.monthly_quota,
                usage: {
                    daily: 0,
                    monthly: 0,
                    total: keyUsage.length,
                    totalTokens: keyUsage.reduce((sum, log) => sum + Number(log.total_tokens || 0), 0),
                    totalCostUsd: Number(keyUsage.reduce((sum, log) => sum + Number(log.cost_usd || 0), 0).toFixed(6)),
                    avgLatencyMs: keyUsage.length > 0
                        ? Math.round(keyUsage.reduce((sum, log) => sum + Number(log.latency_ms || log.response_time_ms || 0), 0) / keyUsage.length)
                        : 0
                },
                intelligence: {
                    linkedAgentCount: linkedAgents.size,
                    linkedRepoCount: linkedRepos.size,
                    linkedAgents: Array.from(linkedAgents).sort(),
                    linkedRepos: Array.from(linkedRepos).sort(),
                    lastSeen,
                    recentActivity: keyUsage
                        .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
                        .slice(0, 5)
                        .map((log) => ({
                            id: log.id,
                            description: log.task_type || `${log.method || 'POST'} ${log.endpoint || ''}`,
                            repoId: log.repo_id || 'default-workspace',
                            modelName: log.model_name || 'unknown',
                            timestamp: log.created_at || null
                        }))
                },
                scopeDefaults: key.scope_defaults || { repos: ['*'], agents: ['*'] }
            };
        });

        res.json({
            keys: formattedKeys,
            insights: intelligence.insights,
            anomalies: intelligence.anomalies
        });
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
            last_rotated_at: now,
            revoked_at: null,
            scope_defaults: {
                repos: ['*'],
                agents: ['*']
            },
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
                lastRotatedAt: now,
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

router.post('/:id/pairing-sessions', authenticate, async (req, res) => {
    try {
        const ownedKey = await getOwnedApiKeyDoc(req.user.id, req.params.id);
        if (ownedKey.error) {
            return res.status(ownedKey.status).json({ success: false, message: ownedKey.error });
        }

        const agentId = String(req.body?.agentId || '').trim();
        if (!agentId) {
            return res.status(400).json({ success: false, message: 'agentId is required' });
        }

        const pairCode = `vbp_${crypto.randomBytes(8).toString('hex')}`;
        const now = new Date();
        const expiresAt = new Date(now.getTime() + (10 * 60 * 1000)).toISOString();
        const session = {
            user_id: req.user.id,
            api_key_id: req.params.id,
            agent_id: agentId,
            agent_surface: req.body?.agentSurface || 'mcp',
            repo_scope: Array.isArray(req.body?.repoScope) && req.body.repoScope.length > 0 ? req.body.repoScope : ['*'],
            status: 'pending',
            code_hash: crypto.createHash('sha256').update(pairCode).digest('hex'),
            expires_at: expiresAt,
            metadata: req.body?.metadata || {},
            created_at: now.toISOString(),
            updated_at: now.toISOString()
        };

        const ref = await db.collection(COLLECTIONS.AGENT_PAIRING_SESSIONS).add(session);
        return res.json({
            success: true,
            pairingSession: {
                id: ref.id,
                agentId,
                agentSurface: session.agent_surface,
                pairCode,
                expiresAt,
                command: `velocitybrain connect ${agentId === 'claude-code' ? 'claude' : agentId} --pair-code ${pairCode} --apply`
            }
        });
    } catch (error) {
        console.error('Create pairing session error:', error);
        res.status(500).json({ success: false, message: 'Failed to create pairing session' });
    }
});

router.post('/:id/rotate', authenticate, async (req, res) => {
    try {
        const ownedKey = await getOwnedApiKeyDoc(req.user.id, req.params.id);
        if (ownedKey.error) {
            return res.status(ownedKey.status).json({ success: false, message: ownedKey.error });
        }

        const apiKey = generateApiKey();
        const keyHash = hashApiKey(apiKey);
        const keyPrefix = apiKey.substring(0, 14);
        const now = new Date().toISOString();

        await ownedKey.keyDoc.ref.update({
            key_hash: keyHash,
            key_prefix: keyPrefix,
            last_rotated_at: now,
            updated_at: now,
            revoked_at: null,
            status: 'active'
        });

        res.json({
            success: true,
            key: apiKey,
            apiKey: {
                id: ownedKey.keyDoc.id,
                keyPrefix,
                lastRotatedAt: now
            }
        });
    } catch (error) {
        console.error('Rotate API key error:', error);
        res.status(500).json({ success: false, message: 'Failed to rotate API key' });
    }
});

router.post('/:id/revoke', authenticate, async (req, res) => {
    try {
        const ownedKey = await getOwnedApiKeyDoc(req.user.id, req.params.id);
        if (ownedKey.error) {
            return res.status(ownedKey.status).json({ success: false, message: ownedKey.error });
        }

        const now = new Date().toISOString();
        await ownedKey.keyDoc.ref.update({
            status: 'revoked',
            revoked_at: now,
            updated_at: now
        });

        res.json({ success: true, revokedAt: now });
    } catch (error) {
        console.error('Revoke API key error:', error);
        res.status(500).json({ success: false, message: 'Failed to revoke API key' });
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
