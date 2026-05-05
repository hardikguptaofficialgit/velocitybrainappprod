const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const { db, COLLECTIONS, firebaseInitialized } = require('../config/firebase');

const JWT_SECRET = process.env.JWT_SECRET || 'velocitybrain-dev-secret';
const FRONTEND_URL = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/+$/, '');
const BACKEND_PUBLIC_URL = (process.env.BACKEND_PUBLIC_URL || process.env.API_BASE_URL || process.env.HOSTED_BASE_URL || '').replace(/\/+$/, '');
const TOKEN_SECRET = crypto
    .createHash('sha256')
    .update(process.env.INTEGRATION_TOKEN_SECRET || process.env.JWT_SECRET || 'velocitybrain-integrations-dev-secret')
    .digest();

const PROVIDERS = {
    slack: {
        id: 'slack',
        label: 'Slack',
        authUrl: 'https://slack.com/oauth/v2/authorize',
        tokenUrl: 'https://slack.com/api/oauth.v2.access',
        scope: [
            'channels:history',
            'channels:read',
            'groups:history',
            'groups:read',
            'users:read',
            'team:read'
        ],
        clientIdEnv: 'SLACK_CLIENT_ID',
        clientSecretEnv: 'SLACK_CLIENT_SECRET'
    },
    google: {
        id: 'google',
        label: 'Google Workspace',
        authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        scope: [
            'https://www.googleapis.com/auth/gmail.readonly',
            'https://www.googleapis.com/auth/drive.metadata.readonly',
            'https://www.googleapis.com/auth/documents.readonly',
            'https://www.googleapis.com/auth/calendar.readonly',
            'openid',
            'email',
            'profile'
        ],
        clientIdEnv: 'GOOGLE_WORKSPACE_CLIENT_ID',
        clientSecretEnv: 'GOOGLE_WORKSPACE_CLIENT_SECRET'
    },
    github: {
        id: 'github',
        label: 'GitHub',
        authUrl: 'https://github.com/login/oauth/authorize',
        tokenUrl: 'https://github.com/login/oauth/access_token',
        scope: [
            'read:user',
            'user:email',
            'repo',
            'read:org'
        ],
        clientIdEnv: 'GITHUB_CLIENT_ID',
        clientSecretEnv: 'GITHUB_CLIENT_SECRET'
    }
};

function getBackendBaseUrl(req) {
    if (BACKEND_PUBLIC_URL) {
        return BACKEND_PUBLIC_URL;
    }
    return `${req.protocol}://${req.get('host')}`;
}

function getProviderConfig(provider) {
    return PROVIDERS[provider] || null;
}

function getProviderSecrets(provider) {
    const config = getProviderConfig(provider);
    if (!config) return null;
    return {
        clientId: process.env[config.clientIdEnv] || '',
        clientSecret: process.env[config.clientSecretEnv] || ''
    };
}

function createCallbackUrl(req, provider) {
    return `${getBackendBaseUrl(req)}/api/integrations/${provider}/callback`;
}

function signIntegrationState(payload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });
}

function verifyIntegrationState(value) {
    return jwt.verify(value, JWT_SECRET);
}

function encryptTokenBundle(payload) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', TOKEN_SECRET, iv);
    const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');
    const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    return {
        iv: iv.toString('hex'),
        authTag: cipher.getAuthTag().toString('hex'),
        ciphertext: encrypted.toString('hex')
    };
}

function decryptTokenBundle(payload) {
    if (!payload?.iv || !payload?.authTag || !payload?.ciphertext) return null;
    const decipher = crypto.createDecipheriv('aes-256-gcm', TOKEN_SECRET, Buffer.from(payload.iv, 'hex'));
    decipher.setAuthTag(Buffer.from(payload.authTag, 'hex'));
    const decrypted = Buffer.concat([
        decipher.update(Buffer.from(payload.ciphertext, 'hex')),
        decipher.final()
    ]);
    return JSON.parse(decrypted.toString('utf8'));
}

function providerScopes(provider) {
    return [...((getProviderConfig(provider)?.scope) || [])];
}

function buildAuthUrl(req, provider, statePayload) {
    const config = getProviderConfig(provider);
    if (!config) {
        throw new Error(`Unsupported provider: ${provider}`);
    }

    const { clientId } = getProviderSecrets(provider);
    const callbackUrl = createCallbackUrl(req, provider);
    const state = signIntegrationState(statePayload);

    if (!clientId) {
        const simulatedUrl = new URL(callbackUrl);
        simulatedUrl.searchParams.set('code', `simulated-${provider}-code`);
        simulatedUrl.searchParams.set('state', state);
        return {
            authUrl: simulatedUrl.toString(),
            state,
            callbackUrl,
            simulated: true
        };
    }

    const url = new URL(config.authUrl);

    if (provider === 'slack') {
        url.searchParams.set('client_id', clientId);
        url.searchParams.set('scope', config.scope.join(','));
        url.searchParams.set('redirect_uri', callbackUrl);
        url.searchParams.set('state', state);
    } else if (provider === 'google') {
        url.searchParams.set('client_id', clientId);
        url.searchParams.set('redirect_uri', callbackUrl);
        url.searchParams.set('response_type', 'code');
        url.searchParams.set('access_type', 'offline');
        url.searchParams.set('prompt', 'consent');
        url.searchParams.set('scope', config.scope.join(' '));
        url.searchParams.set('state', state);
    } else if (provider === 'github') {
        url.searchParams.set('client_id', clientId);
        url.searchParams.set('redirect_uri', callbackUrl);
        url.searchParams.set('scope', config.scope.join(' '));
        url.searchParams.set('state', state);
    }

    return {
        authUrl: url.toString(),
        state,
        callbackUrl
    };
}

async function exchangeCodeForTokens(req, provider, code) {
    const config = getProviderConfig(provider);
    const { clientId, clientSecret } = getProviderSecrets(provider);
    const redirectUri = createCallbackUrl(req, provider);

    if (!clientId || !clientSecret) {
        return {
            success: true,
            simulated: true,
            accessToken: `simulated_${provider}_access`,
            refreshToken: `simulated_${provider}_refresh`,
            expiresIn: 3600,
            scopesGranted: providerScopes(provider),
            externalId: `simulated-${provider}-workspace`,
            displayName: `${config.label} Workspace`,
            raw: { simulated: true, code }
        };
    }

    let response;
    if (provider === 'slack') {
        response = await fetch(config.tokenUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code,
                client_id: clientId,
                client_secret: clientSecret,
                redirect_uri: redirectUri
            })
        });
        const payload = await response.json();
        if (!response.ok || !payload.ok) {
            throw new Error(payload.error || 'Slack token exchange failed');
        }
        return {
            success: true,
            accessToken: payload.access_token,
            refreshToken: payload.refresh_token || '',
            expiresIn: payload.expires_in || 3600,
            scopesGranted: payload.scope ? String(payload.scope).split(',').filter(Boolean) : providerScopes(provider),
            externalId: payload.team?.id || payload.team_id || '',
            displayName: payload.team?.name || 'Slack Workspace',
            raw: payload
        };
    }

    if (provider === 'google') {
        response = await fetch(config.tokenUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code,
                client_id: clientId,
                client_secret: clientSecret,
                redirect_uri: redirectUri,
                grant_type: 'authorization_code'
            })
        });
        const payload = await response.json();
        if (!response.ok || payload.error) {
            throw new Error(payload.error_description || payload.error || 'Google token exchange failed');
        }
        return {
            success: true,
            accessToken: payload.access_token,
            refreshToken: payload.refresh_token || '',
            expiresIn: payload.expires_in || 3600,
            scopesGranted: payload.scope ? String(payload.scope).split(' ').filter(Boolean) : providerScopes(provider),
            externalId: 'google-workspace',
            displayName: 'Google Workspace',
            raw: payload
        };
    }

    response = await fetch(config.tokenUrl, {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri
        })
    });
    const payload = await response.json();
    if (!response.ok || payload.error) {
        throw new Error(payload.error_description || payload.error || 'GitHub token exchange failed');
    }
    return {
        success: true,
        accessToken: payload.access_token,
        refreshToken: '',
        expiresIn: 3600,
        scopesGranted: payload.scope ? String(payload.scope).split(',').filter(Boolean) : providerScopes(provider),
        externalId: 'github-org',
        displayName: 'GitHub Workspace',
        raw: payload
    };
}

function sourceArtifactTemplates(provider, workspaceId, displayName) {
    const base = {
        workspace_id: workspaceId,
        source_provider: provider,
        freshness: 'connected',
        confidence: 0.9,
        permissions_context: 'workspace_oauth'
    };

    if (provider === 'slack') {
        return [
            {
                ...base,
                source_object_id: `${workspaceId}:slack:welcome-thread`,
                type: 'slack_thread',
                title: `${displayName} onboarding thread`,
                participants: [],
                owners: [],
                timestamps: { discovered_at: new Date().toISOString() },
                linked_repos: [],
                linked_people: [],
                linked_workflows: ['team_communication']
            }
        ];
    }

    if (provider === 'google') {
        return [
            {
                ...base,
                source_object_id: `${workspaceId}:google:workspace`,
                type: 'google_workspace',
                title: `${displayName} workspace corpus`,
                participants: [],
                owners: [],
                timestamps: { discovered_at: new Date().toISOString() },
                linked_repos: [],
                linked_people: [],
                linked_workflows: ['knowledge_management']
            }
        ];
    }

    return [
        {
            ...base,
            source_object_id: `${workspaceId}:github:org`,
            type: 'github_workspace',
            title: `${displayName} repositories`,
            participants: [],
            owners: [],
            timestamps: { discovered_at: new Date().toISOString() },
            linked_repos: [],
            linked_people: [],
            linked_workflows: ['engineering_delivery']
        }
    ];
}

async function writeConnectionArtifacts(connection) {
    if (!firebaseInitialized) return;
    const artifacts = sourceArtifactTemplates(connection.provider, connection.workspace_id, connection.display_name || connection.provider);
    await Promise.all(artifacts.map((artifact) => db.collection(COLLECTIONS.SOURCE_ARTIFACTS).add({
        ...artifact,
        source_connection_id: connection.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    })));
}

async function createSyncJob(connection, status = 'queued') {
    if (!firebaseInitialized) return null;
    const now = new Date().toISOString();
    const payload = {
        source_connection_id: connection.id,
        provider: connection.provider,
        workspace_id: connection.workspace_id,
        user_id: connection.user_id,
        stage: 'initial_backfill',
        status,
        created_at: now,
        updated_at: now
    };
    const ref = await db.collection(COLLECTIONS.SOURCE_SYNC_JOBS).add(payload);
    return { id: ref.id, ...payload };
}

async function appendConnectionEvent(connectionId, eventType, payload = {}) {
    if (!firebaseInitialized) return null;
    const event = {
        source_connection_id: connectionId,
        event_type: eventType,
        payload,
        created_at: new Date().toISOString()
    };
    const ref = await db.collection(COLLECTIONS.SOURCE_CONNECTION_EVENTS).add(event);
    return { id: ref.id, ...event };
}

async function upsertSourceConnection({
    provider,
    workspaceId,
    userId,
    displayName,
    externalTeamOrOrgId,
    scopesGranted,
    tokens,
    metadata = {}
}) {
    if (!firebaseInitialized) {
        throw new Error('Firebase not configured');
    }

    const snapshot = await db.collection(COLLECTIONS.SOURCE_CONNECTIONS)
        .where('workspace_id', '==', workspaceId)
        .where('provider', '==', provider)
        .limit(1)
        .get();

    const now = new Date().toISOString();
    const tokenBundle = encryptTokenBundle(tokens);
    const payload = {
        provider,
        workspace_id: workspaceId,
        user_id: userId,
        status: 'connected',
        scopes_granted: scopesGranted,
        connected_at: snapshot.empty ? now : (snapshot.docs[0].data().connected_at || now),
        last_sync_at: now,
        last_sync_status: 'queued',
        external_team_or_org_id: externalTeamOrOrgId || '',
        display_name: displayName || getProviderConfig(provider)?.label || provider,
        metadata: {
            ...metadata,
            token_bundle: tokenBundle
        },
        revoked_at: null,
        updated_at: now
    };

    let id;
    if (snapshot.empty) {
        const ref = await db.collection(COLLECTIONS.SOURCE_CONNECTIONS).add({
            ...payload,
            created_at: now
        });
        id = ref.id;
    } else {
        id = snapshot.docs[0].id;
        await snapshot.docs[0].ref.set({
            ...snapshot.docs[0].data(),
            ...payload
        });
    }

    const connection = { id, ...payload };
    await appendConnectionEvent(id, 'connected', {
        provider,
        externalTeamOrOrgId,
        scopesGranted
    });
    const syncJob = await createSyncJob(connection, 'queued');
    await writeConnectionArtifacts(connection);
    return { connection, syncJob };
}

function summarizeConnection(connection, latestJob = null) {
    const metadata = connection.metadata || {};
    const tokenBundle = metadata.token_bundle;
    return {
        id: connection.id,
        provider: connection.provider,
        label: getProviderConfig(connection.provider)?.label || connection.provider,
        status: connection.status || 'unknown',
        connected: connection.status === 'connected' && !connection.revoked_at,
        displayName: connection.display_name || '',
        scopesGranted: Array.isArray(connection.scopes_granted) ? connection.scopes_granted : [],
        connectedAt: connection.connected_at || null,
        lastSyncAt: connection.last_sync_at || null,
        lastSyncStatus: latestJob?.status || connection.last_sync_status || 'idle',
        externalTeamOrOrgId: connection.external_team_or_org_id || '',
        revokedAt: connection.revoked_at || null,
        hasStoredCredentials: Boolean(tokenBundle),
        metadata: {
            ...metadata,
            token_bundle: undefined
        }
    };
}

async function listSourceConnectionsForWorkspace(workspaceId) {
    if (!firebaseInitialized || !workspaceId) return [];
    const [connectionsSnapshot, jobsSnapshot] = await Promise.all([
        db.collection(COLLECTIONS.SOURCE_CONNECTIONS)
            .where('workspace_id', '==', workspaceId)
            .limit(100)
            .get(),
        db.collection(COLLECTIONS.SOURCE_SYNC_JOBS)
            .where('workspace_id', '==', workspaceId)
            .limit(500)
            .get()
    ]);
    const jobs = jobsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    const latestJobByConnection = new Map();
    jobs.forEach((job) => {
        const current = latestJobByConnection.get(job.source_connection_id);
        if (!current || new Date(job.updated_at || 0) > new Date(current.updated_at || 0)) {
            latestJobByConnection.set(job.source_connection_id, job);
        }
    });

    return connectionsSnapshot.docs.map((doc) => summarizeConnection({
        id: doc.id,
        ...doc.data()
    }, latestJobByConnection.get(doc.id)));
}

function buildCompanySourceSettings(connections = [], existing = {}) {
    const next = {
        slack: { connected: false, skipped: false, status: 'not_connected', displayName: '', lastSyncAt: null, lastSyncStatus: 'idle', scopesGranted: [] },
        google: { connected: false, skipped: false, status: 'not_connected', displayName: '', lastSyncAt: null, lastSyncStatus: 'idle', scopesGranted: [] },
        github: { connected: false, skipped: false, status: 'not_connected', displayName: '', lastSyncAt: null, lastSyncStatus: 'idle', scopesGranted: [] }
    };
    Object.entries(existing || {}).forEach(([provider, value]) => {
        if (next[provider]) {
            next[provider] = { ...next[provider], ...(value || {}) };
        }
    });

    connections.forEach((connection) => {
        if (!next[connection.provider]) return;
        next[connection.provider] = {
            ...next[connection.provider],
            connected: Boolean(connection.connected),
            status: connection.status || 'connected',
            displayName: connection.displayName || next[connection.provider].displayName,
            lastSyncAt: connection.lastSyncAt || null,
            lastSyncStatus: connection.lastSyncStatus || 'idle',
            scopesGranted: connection.scopesGranted || []
        };
    });
    return next;
}

function summarizeWorkspaceCoverage(connections = []) {
    const connected = connections.filter((item) => item.connected);
    return {
        connectedSourceCount: connected.length,
        connectedSources: connected.map((item) => item.provider),
        sourceCoverageSummary: connected.length > 0
            ? `${connected.length} company source${connected.length === 1 ? '' : 's'} connected`
            : 'No company sources connected yet'
    };
}

module.exports = {
    PROVIDERS,
    getProviderConfig,
    getProviderSecrets,
    providerScopes,
    createCallbackUrl,
    buildAuthUrl,
    verifyIntegrationState,
    exchangeCodeForTokens,
    upsertSourceConnection,
    listSourceConnectionsForWorkspace,
    appendConnectionEvent,
    createSyncJob,
    summarizeConnection,
    buildCompanySourceSettings,
    summarizeWorkspaceCoverage,
    decryptTokenBundle
};
