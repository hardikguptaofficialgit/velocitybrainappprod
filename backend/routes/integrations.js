const express = require('express');

const { db, COLLECTIONS, firebaseInitialized } = require('../config/firebase');
const { authenticate } = require('../middleware/auth');
const { mergeSettings } = require('../utils/account');
const {
    PROVIDERS,
    buildAuthUrl,
    verifyIntegrationState,
    exchangeCodeForTokens,
    upsertSourceConnection,
    listSourceConnectionsForWorkspace,
    appendConnectionEvent,
    createSyncJob,
    buildCompanySourceSettings,
    summarizeWorkspaceCoverage,
    getIntegrationCapabilities
} = require('../utils/sourceIntegrations');

const router = express.Router();
const FRONTEND_URL = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/+$/, '');

const ensureFirebase = (res) => {
    if (!firebaseInitialized) {
        res.status(503).json({
            success: false,
            message: 'Firebase not configured. Please set up Firebase credentials.'
        });
        return false;
    }
    return true;
};

const providerList = Object.values(PROVIDERS).map((provider) => ({
    id: provider.id,
    label: provider.label,
    scopes: provider.scope
}));

async function getSettingsDoc(userId) {
    const ref = db.collection(COLLECTIONS.USER_SETTINGS).doc(userId);
    const doc = await ref.get();
    if (!doc.exists) {
        const payload = mergeSettings({});
        await ref.set(payload);
        return { ref, data: payload };
    }
    return { ref, data: mergeSettings(doc.data()) };
}

async function persistCompanySourceSettings(userId, connections, existingSelections = {}) {
    const settingsDoc = await getSettingsDoc(userId);
    const mergedSources = buildCompanySourceSettings(connections, settingsDoc.data.companySources);
    const nextSettings = mergeSettings({
        ...settingsDoc.data,
        companySources: {
            ...mergedSources,
            ...existingSelections
        },
        updated_at: new Date().toISOString()
    });
    await settingsDoc.ref.set(nextSettings);
    return nextSettings;
}

router.get('/', authenticate, async (req, res) => {
    try {
        if (!ensureFirebase(res)) return;

        const connections = await listSourceConnectionsForWorkspace(req.user.workspaceId);
        const settingsDoc = await getSettingsDoc(req.user.id);
        const companySources = buildCompanySourceSettings(connections, settingsDoc.data.companySources);
        const coverage = summarizeWorkspaceCoverage(connections);
        const capabilities = getIntegrationCapabilities();

        res.json({
            success: true,
            providers: providerList,
            integrations: connections,
            companySources,
            capabilities,
            ...coverage
        });
    } catch (error) {
        console.error('Integrations list error:', error);
        res.status(500).json({ success: false, message: 'Failed to load integrations' });
    }
});

router.get('/onboarding-status', authenticate, async (req, res) => {
    try {
        if (!ensureFirebase(res)) return;

        const connections = await listSourceConnectionsForWorkspace(req.user.workspaceId);
        const settingsDoc = await getSettingsDoc(req.user.id);
        const companySources = buildCompanySourceSettings(connections, settingsDoc.data.companySources);
        const coverage = summarizeWorkspaceCoverage(connections);
        const capabilities = getIntegrationCapabilities();

        res.json({
            success: true,
            companySources,
            integrations: connections,
            capabilities,
            ...coverage
        });
    } catch (error) {
        console.error('Integrations onboarding status error:', error);
        res.status(500).json({ success: false, message: 'Failed to load onboarding integration status' });
    }
});

router.post('/:provider/start', authenticate, async (req, res) => {
    try {
        if (!ensureFirebase(res)) return;

        const provider = String(req.params.provider || '').toLowerCase();
        if (!PROVIDERS[provider]) {
            return res.status(400).json({ success: false, message: 'Unsupported integration provider' });
        }

        const from = ['onboarding', 'integrations'].includes(req.body?.from) ? req.body.from : 'integrations';
        const statePayload = {
            provider,
            from,
            userId: req.user.id,
            workspaceId: req.user.workspaceId || '',
            accountType: req.user.accountType || 'individual'
        };
        const auth = buildAuthUrl(req, provider, statePayload);

        res.json({
            success: true,
            provider,
            authUrl: auth.authUrl,
            callbackUrl: auth.callbackUrl,
            simulated: Boolean(auth.simulated),
            connectionMode: auth.simulated ? 'demo' : 'live'
        });
    } catch (error) {
        console.error('Integration start error:', error);
        res.status(400).json({ success: false, message: error.message || 'Failed to start integration' });
    }
});

router.get('/:provider/callback', async (req, res) => {
    const provider = String(req.params.provider || '').toLowerCase();
    const status = (value) => {
        const url = new URL(`${FRONTEND_URL}${value.from === 'onboarding' ? '/onboarding' : '/dashboard/integrations'}`);
        url.searchParams.set('provider', provider);
        url.searchParams.set('status', value.status);
        url.searchParams.set('from', value.from || 'integrations');
        if (value.workspaceId) {
            url.searchParams.set('workspace_id', value.workspaceId);
        }
        if (value.message) {
            url.searchParams.set('message', value.message);
        }
        return url.toString();
    };

    try {
        if (!ensureFirebase(res)) return;
        if (!PROVIDERS[provider]) {
            return res.redirect(status({ status: 'error', from: 'integrations', message: 'unsupported_provider' }));
        }

        const { code, state, error } = req.query;
        if (error) {
            let decoded = { from: 'integrations' };
            try {
                decoded = verifyIntegrationState(state);
            } catch {}
            return res.redirect(status({
                status: 'error',
                from: decoded.from || 'integrations',
                workspaceId: decoded.workspaceId,
                message: String(error)
            }));
        }

        const decoded = verifyIntegrationState(String(state || ''));
        if (!decoded?.userId || !decoded?.workspaceId) {
            return res.redirect(status({ status: 'error', from: decoded?.from || 'integrations', message: 'invalid_state' }));
        }

        const exchanged = await exchangeCodeForTokens(req, provider, String(code || ''));
        const { connection, syncJob } = await upsertSourceConnection({
            provider,
            workspaceId: decoded.workspaceId,
            userId: decoded.userId,
            displayName: exchanged.displayName,
            externalTeamOrOrgId: exchanged.externalId,
            scopesGranted: exchanged.scopesGranted,
            tokens: {
                accessToken: exchanged.accessToken,
                refreshToken: exchanged.refreshToken,
                expiresIn: exchanged.expiresIn
            },
            metadata: {
                provider_payload: exchanged.raw,
                onboarding_from: decoded.from || 'integrations',
                simulated: Boolean(exchanged.simulated)
            }
        });

        const connections = await listSourceConnectionsForWorkspace(decoded.workspaceId);
        await persistCompanySourceSettings(decoded.userId, connections, {
            [provider]: {
                skipped: false,
                connected: true,
                status: 'connected',
                displayName: connection.display_name || exchanged.displayName || PROVIDERS[provider].label
            }
        });
        await appendConnectionEvent(connection.id, 'oauth_callback_completed', {
            syncJobId: syncJob?.id || null,
            from: decoded.from || 'integrations'
        });

        return res.redirect(status({
            status: 'connected',
            from: decoded.from || 'integrations',
            workspaceId: decoded.workspaceId
        }));
    } catch (error) {
        console.error('Integration callback error:', error);
        let decoded = { from: 'integrations' };
        try {
            decoded = verifyIntegrationState(String(req.query.state || ''));
        } catch {}
        return res.redirect(status({
            status: 'error',
            from: decoded.from || 'integrations',
            workspaceId: decoded.workspaceId,
            message: 'callback_failed'
        }));
    }
});

router.get('/:provider/status', authenticate, async (req, res) => {
    try {
        if (!ensureFirebase(res)) return;

        const provider = String(req.params.provider || '').toLowerCase();
        if (!PROVIDERS[provider]) {
            return res.status(400).json({ success: false, message: 'Unsupported integration provider' });
        }

        const connections = await listSourceConnectionsForWorkspace(req.user.workspaceId);
        const connection = connections.find((item) => item.provider === provider) || null;

        res.json({
            success: true,
            provider,
            integration: connection
        });
    } catch (error) {
        console.error('Integration status error:', error);
        res.status(500).json({ success: false, message: 'Failed to load integration status' });
    }
});

router.post('/:provider/resync', authenticate, async (req, res) => {
    try {
        if (!ensureFirebase(res)) return;

        const provider = String(req.params.provider || '').toLowerCase();
        if (!PROVIDERS[provider]) {
            return res.status(400).json({ success: false, message: 'Unsupported integration provider' });
        }

        const snapshot = await db.collection(COLLECTIONS.SOURCE_CONNECTIONS)
            .where('workspace_id', '==', req.user.workspaceId)
            .where('provider', '==', provider)
            .limit(1)
            .get();

        if (snapshot.empty) {
            return res.status(404).json({ success: false, message: 'Integration not connected yet' });
        }

        const doc = snapshot.docs[0];
        const current = { id: doc.id, ...doc.data() };
        const now = new Date().toISOString();
        await doc.ref.update({
            last_sync_status: 'queued',
            updated_at: now
        });
        const syncJob = await createSyncJob(current, 'queued');
        await appendConnectionEvent(current.id, 'resync_requested', {
            userId: req.user.id,
            syncJobId: syncJob?.id || null
        });

        const connections = await listSourceConnectionsForWorkspace(req.user.workspaceId);
        const settings = await persistCompanySourceSettings(req.user.id, connections);

        res.json({
            success: true,
            provider,
            syncJob,
            companySources: settings.companySources
        });
    } catch (error) {
        console.error('Integration resync error:', error);
        res.status(500).json({ success: false, message: 'Failed to queue integration sync' });
    }
});

router.post('/:provider/disconnect', authenticate, async (req, res) => {
    try {
        if (!ensureFirebase(res)) return;

        const provider = String(req.params.provider || '').toLowerCase();
        if (!PROVIDERS[provider]) {
            return res.status(400).json({ success: false, message: 'Unsupported integration provider' });
        }

        const snapshot = await db.collection(COLLECTIONS.SOURCE_CONNECTIONS)
            .where('workspace_id', '==', req.user.workspaceId)
            .where('provider', '==', provider)
            .limit(1)
            .get();

        if (snapshot.empty) {
            return res.status(404).json({ success: false, message: 'Integration not connected yet' });
        }

        const doc = snapshot.docs[0];
        const now = new Date().toISOString();
        await doc.ref.update({
            status: 'disconnected',
            revoked_at: now,
            updated_at: now,
            last_sync_status: 'revoked'
        });
        await appendConnectionEvent(doc.id, 'disconnected', {
            userId: req.user.id
        });

        const connections = await listSourceConnectionsForWorkspace(req.user.workspaceId);
        const settings = await persistCompanySourceSettings(req.user.id, connections, {
            [provider]: {
                connected: false,
                status: 'disconnected',
                lastSyncStatus: 'revoked'
            }
        });

        res.json({
            success: true,
            provider,
            companySources: settings.companySources
        });
    } catch (error) {
        console.error('Integration disconnect error:', error);
        res.status(500).json({ success: false, message: 'Failed to disconnect integration' });
    }
});

module.exports = router;
