const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const { db, COLLECTIONS, appwriteInitialized } = require('../config/appwrite');

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
        clientSecretEnv: 'SLACK_CLIENT_SECRET',
        scopeSeparator: ',',
        tokenFormat: 'form'
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
        clientSecretEnv: 'GOOGLE_WORKSPACE_CLIENT_SECRET',
        scopeSeparator: ' ',
        tokenFormat: 'form',
        authParams: {
            access_type: 'offline',
            prompt: 'consent'
        }
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
        clientSecretEnv: 'GITHUB_CLIENT_SECRET',
        scopeSeparator: ' ',
        tokenFormat: 'json'
    },
    notion: {
        id: 'notion',
        label: 'Notion',
        authUrl: 'https://api.notion.com/v1/oauth/authorize',
        tokenUrl: 'https://api.notion.com/v1/oauth/token',
        scope: [],
        clientIdEnv: 'NOTION_CLIENT_ID',
        clientSecretEnv: 'NOTION_CLIENT_SECRET',
        scopeSeparator: ' ',
        tokenFormat: 'json',
        tokenAuth: 'basic',
        authParams: {
            response_type: 'code',
            owner: 'user'
        }
    },
    linear: {
        id: 'linear',
        label: 'Linear',
        authUrl: 'https://linear.app/oauth/authorize',
        tokenUrl: 'https://api.linear.app/oauth/token',
        scope: ['read'],
        clientIdEnv: 'LINEAR_CLIENT_ID',
        clientSecretEnv: 'LINEAR_CLIENT_SECRET',
        scopeSeparator: ',',
        tokenFormat: 'form'
    },
    jira: {
        id: 'jira',
        label: 'Jira',
        authUrl: 'https://auth.atlassian.com/authorize',
        tokenUrl: 'https://auth.atlassian.com/oauth/token',
        scope: ['read:jira-user', 'read:jira-work', 'offline_access'],
        clientIdEnv: 'JIRA_CLIENT_ID',
        clientSecretEnv: 'JIRA_CLIENT_SECRET',
        scopeSeparator: ' ',
        tokenFormat: 'json',
        authParams: {
            audience: 'api.atlassian.com',
            prompt: 'consent'
        }
    },
    figma: {
        id: 'figma',
        label: 'Figma',
        authUrl: 'https://www.figma.com/oauth',
        tokenUrl: 'https://www.figma.com/api/v1/oauth/token',
        scope: ['file_content:read'],
        clientIdEnv: 'FIGMA_CLIENT_ID',
        clientSecretEnv: 'FIGMA_CLIENT_SECRET',
        scopeSeparator: ' ',
        tokenFormat: 'form'
    },
    discord: {
        id: 'discord',
        label: 'Discord',
        authUrl: 'https://discord.com/oauth2/authorize',
        tokenUrl: 'https://discord.com/api/oauth2/token',
        scope: ['identify', 'guilds'],
        clientIdEnv: 'DISCORD_CLIENT_ID',
        clientSecretEnv: 'DISCORD_CLIENT_SECRET',
        scopeSeparator: ' ',
        tokenFormat: 'form'
    },
    dropbox: {
        id: 'dropbox',
        label: 'Dropbox',
        authUrl: 'https://www.dropbox.com/oauth2/authorize',
        tokenUrl: 'https://api.dropboxapi.com/oauth2/token',
        scope: ['files.metadata.read', 'files.content.read', 'sharing.read'],
        clientIdEnv: 'DROPBOX_CLIENT_ID',
        clientSecretEnv: 'DROPBOX_CLIENT_SECRET',
        scopeSeparator: ' ',
        tokenFormat: 'form',
        authParams: {
            token_access_type: 'offline'
        }
    },
    microsoft365: {
        id: 'microsoft365',
        label: 'Microsoft 365',
        authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
        tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
        scope: ['offline_access', 'User.Read', 'Mail.Read', 'Calendars.Read', 'Files.Read.All'],
        clientIdEnv: 'MICROSOFT_CLIENT_ID',
        clientSecretEnv: 'MICROSOFT_CLIENT_SECRET',
        scopeSeparator: ' ',
        tokenFormat: 'form'
    },
    outlook: {
        id: 'outlook',
        label: 'Outlook',
        authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
        tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
        scope: ['offline_access', 'User.Read', 'Mail.Read', 'Calendars.Read'],
        clientIdEnv: 'MICROSOFT_CLIENT_ID',
        clientSecretEnv: 'MICROSOFT_CLIENT_SECRET',
        scopeSeparator: ' ',
        tokenFormat: 'form'
    },
    onedrive: {
        id: 'onedrive',
        label: 'OneDrive',
        authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
        tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
        scope: ['offline_access', 'User.Read', 'Files.Read.All'],
        clientIdEnv: 'MICROSOFT_CLIENT_ID',
        clientSecretEnv: 'MICROSOFT_CLIENT_SECRET',
        scopeSeparator: ' ',
        tokenFormat: 'form'
    },
    teams: {
        id: 'teams',
        label: 'Microsoft Teams',
        authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
        tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
        scope: ['offline_access', 'User.Read', 'Team.ReadBasic.All', 'Channel.ReadBasic.All'],
        clientIdEnv: 'MICROSOFT_CLIENT_ID',
        clientSecretEnv: 'MICROSOFT_CLIENT_SECRET',
        scopeSeparator: ' ',
        tokenFormat: 'form'
    },
    gmail: {
        id: 'gmail',
        label: 'Gmail',
        authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        scope: ['https://www.googleapis.com/auth/gmail.readonly', 'openid', 'email', 'profile'],
        clientIdEnv: 'GOOGLE_WORKSPACE_CLIENT_ID',
        clientSecretEnv: 'GOOGLE_WORKSPACE_CLIENT_SECRET',
        scopeSeparator: ' ',
        tokenFormat: 'form',
        authParams: {
            access_type: 'offline',
            prompt: 'consent'
        }
    },
    googledocs: {
        id: 'googledocs',
        label: 'Google Docs',
        authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        scope: ['https://www.googleapis.com/auth/documents.readonly', 'https://www.googleapis.com/auth/drive.metadata.readonly', 'openid', 'email', 'profile'],
        clientIdEnv: 'GOOGLE_WORKSPACE_CLIENT_ID',
        clientSecretEnv: 'GOOGLE_WORKSPACE_CLIENT_SECRET',
        scopeSeparator: ' ',
        tokenFormat: 'form',
        authParams: {
            access_type: 'offline',
            prompt: 'consent'
        }
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

function formatScopes(config) {
    return (config.scope || []).join(config.scopeSeparator || ' ');
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
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', callbackUrl);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('state', state);
    const scope = formatScopes(config);
    if (scope) {
        url.searchParams.set('scope', scope);
    }
    Object.entries(config.authParams || {}).forEach(([key, value]) => {
        url.searchParams.set(key, value);
    });

    if (provider === 'dropbox') {
        url.searchParams.delete('scope');
    }

    return {
        authUrl: url.toString(),
        state,
        callbackUrl
    };
}

async function fetchJson(response) {
    const text = await response.text();
    try {
        return text ? JSON.parse(text) : {};
    } catch {
        return { raw: text };
    }
}

function tokenDisplayName(provider, payload, config) {
    if (provider === 'slack') return payload.team?.name || 'Slack Workspace';
    if (provider === 'notion') return payload.workspace_name || payload.owner?.user?.name || 'Notion Workspace';
    if (provider === 'linear') return payload.organization?.name || 'Linear Workspace';
    if (provider === 'discord') return payload.guild?.name || 'Discord Workspace';
    return config.label;
}

function tokenExternalId(provider, payload) {
    if (provider === 'slack') return payload.team?.id || payload.team_id || '';
    if (provider === 'notion') return payload.workspace_id || payload.bot_id || '';
    if (provider === 'linear') return payload.organization?.id || '';
    if (provider === 'discord') return payload.guild?.id || '';
    if (payload.account_id) return payload.account_id;
    if (payload.uid) return payload.uid;
    return `${provider}-workspace`;
}

function parseGrantedScopes(provider, payload) {
    if (Array.isArray(payload.scope)) return payload.scope;
    if (!payload.scope) return providerScopes(provider);
    const separator = provider === 'slack' ? ',' : ' ';
    return String(payload.scope).split(separator).map((item) => item.trim()).filter(Boolean);
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

    const tokenPayload = {
        code,
        client_id: clientId,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
    };
    if (provider !== 'github') {
        tokenPayload.client_secret = clientSecret;
    }

    const headers = {};
    let body;
    if (config.tokenAuth === 'basic') {
        headers.Authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;
    } else if (provider === 'github') {
        tokenPayload.client_secret = clientSecret;
    }

    if (config.tokenFormat === 'json') {
        headers.Accept = 'application/json';
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify(tokenPayload);
    } else {
        headers.Accept = 'application/json';
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
        body = new URLSearchParams(tokenPayload);
    }

    const response = await fetch(config.tokenUrl, {
        method: 'POST',
        headers,
        body
    });
    const payload = await fetchJson(response);
    if (!response.ok || payload.error || payload.ok === false) {
        throw new Error(payload.error_description || payload.error || `${config.label} token exchange failed`);
    }
    return {
        success: true,
        accessToken: payload.access_token,
        refreshToken: payload.refresh_token || '',
        expiresIn: payload.expires_in || 3600,
        scopesGranted: parseGrantedScopes(provider, payload),
        externalId: tokenExternalId(provider, payload),
        displayName: tokenDisplayName(provider, payload, config),
        raw: payload
    };
}

function sourceArtifactTemplates(provider, workspaceId, displayName) {
    const now = new Date().toISOString();
    const base = {
        workspace_id: workspaceId,
        metadata: {
            source_provider: provider,
            freshness: 'connected',
            confidence: 0.9,
            permissions_context: 'workspace_oauth'
        },
        synced_at: now,
        created_at: now,
        updated_at: now
    };

    if (provider === 'slack') {
        return [
            {
                ...base,
                external_id: `${workspaceId}:slack:welcome-thread`,
                artifact_type: 'slack_thread',
                title: `${displayName} onboarding thread`,
                content: '',
                metadata: {
                    ...base.metadata,
                    participants: [],
                    owners: [],
                    timestamps: { discovered_at: now },
                    linked_repos: [],
                    linked_people: [],
                    linked_workflows: ['team_communication']
                }
            }
        ];
    }

    if (provider === 'google') {
        return [
            {
                ...base,
                external_id: `${workspaceId}:google:workspace`,
                artifact_type: 'google_workspace',
                title: `${displayName} workspace corpus`,
                content: '',
                metadata: {
                    ...base.metadata,
                    participants: [],
                    owners: [],
                    timestamps: { discovered_at: now },
                    linked_repos: [],
                    linked_people: [],
                    linked_workflows: ['knowledge_management']
                }
            }
        ];
    }

    const label = getProviderConfig(provider)?.label || displayName || provider;
    return [
        {
            ...base,
            external_id: `${workspaceId}:${provider}:workspace`,
            artifact_type: `${provider}_workspace`,
            title: `${displayName || label} source`,
            content: '',
            metadata: {
                ...base.metadata,
                participants: [],
                owners: [],
                timestamps: { discovered_at: now },
                linked_repos: [],
                linked_people: [],
                linked_workflows: ['company_context']
            }
        }
    ];
}

async function writeConnectionArtifacts(connection) {
    if (!appwriteInitialized) return;
    const provider = connection.source_type || connection.provider;
    const artifacts = sourceArtifactTemplates(provider, connection.workspace_id, connection.display_name || provider);
    await Promise.all(artifacts.map((artifact) => db.collection(COLLECTIONS.SOURCE_ARTIFACTS).add({
        ...artifact,
        source_connection_id: connection.id
    })));
}

async function createSyncJob(connection, status = 'queued') {
    if (!appwriteInitialized) return null;
    const now = new Date().toISOString();
    const payload = {
        source_connection_id: connection.id,
        workspace_id: connection.workspace_id,
        status,
        items_synced: 0,
        items_failed: 0,
        error_message: '',
        started_at: '',
        completed_at: null,
        created_at: now
    };
    const ref = await db.collection(COLLECTIONS.SOURCE_SYNC_JOBS).add(payload);
    return { id: ref.id, ...payload };
}

async function appendConnectionEvent(connectionId, eventType, payload = {}) {
    if (!appwriteInitialized) return null;
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
    if (!appwriteInitialized) {
        throw new Error('Appwrite not configured');
    }

    const snapshot = await db.collection(COLLECTIONS.SOURCE_CONNECTIONS)
        .where('workspace_id', '==', workspaceId)
        .limit(100)
        .get();
    const existingDoc = snapshot.docs.find((doc) => {
        const data = doc.data();
        return (data.source_type || data.provider || data.metadata?.provider) === provider;
    });

    const now = new Date().toISOString();
    const tokenBundle = encryptTokenBundle(tokens);
    const payload = {
        source_type: provider,
        source_id: externalTeamOrOrgId || `${provider}-workspace`,
        workspace_id: workspaceId,
        user_id: userId,
        status: 'connected',
        scopes: scopesGranted,
        connected_at: existingDoc ? (existingDoc.data().connected_at || now) : now,
        last_sync_at: now,
        display_name: displayName || getProviderConfig(provider)?.label || provider,
        metadata: {
            ...metadata,
            token_bundle: tokenBundle,
            provider,
            external_team_or_org_id: externalTeamOrOrgId || '',
            last_sync_status: 'queued',
            revoked_at: null
        },
        updated_at: now
    };

    let id;
    if (!existingDoc) {
        const ref = await db.collection(COLLECTIONS.SOURCE_CONNECTIONS).add({
            ...payload,
            created_at: now
        });
        id = ref.id;
    } else {
        id = existingDoc.id;
        await existingDoc.ref.set({
            ...existingDoc.data(),
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
    const simulated = Boolean(metadata.simulated);
    const provider = connection.provider || connection.source_type || metadata.provider || '';
    const revokedAt = connection.revoked_at || metadata.revoked_at || null;
    return {
        id: connection.id,
        provider,
        label: getProviderConfig(provider)?.label || provider,
        status: connection.status || 'unknown',
        connected: connection.status === 'connected' && !revokedAt,
        displayName: connection.display_name || '',
        scopesGranted: Array.isArray(connection.scopes_granted) ? connection.scopes_granted : (Array.isArray(connection.scopes) ? connection.scopes : []),
        connectedAt: connection.connected_at || null,
        lastSyncAt: connection.last_sync_at || null,
        lastSyncStatus: latestJob?.status || connection.last_sync_status || metadata.last_sync_status || 'idle',
        externalTeamOrOrgId: connection.external_team_or_org_id || connection.source_id || metadata.external_team_or_org_id || '',
        revokedAt,
        hasStoredCredentials: Boolean(tokenBundle),
        isSimulated: simulated,
        connectionMode: simulated ? 'demo' : 'live',
        metadata: {
            ...metadata,
            token_bundle: undefined
        }
    };
}

async function listSourceConnectionsForWorkspace(workspaceId) {
    if (!appwriteInitialized || !workspaceId) return [];
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
        const jobTime = job.updated_at || job.completed_at || job.started_at || job.created_at || 0;
        const currentTime = current?.updated_at || current?.completed_at || current?.started_at || current?.created_at || 0;
        if (!current || new Date(jobTime) > new Date(currentTime)) {
            latestJobByConnection.set(job.source_connection_id, job);
        }
    });

    return connectionsSnapshot.docs.map((doc) => summarizeConnection({
        id: doc.id,
        ...doc.data()
    }, latestJobByConnection.get(doc.id)));
}

function buildCompanySourceSettings(connections = [], existing = {}) {
    const emptySource = {
        connected: false,
        skipped: false,
        status: 'not_connected',
        displayName: '',
        lastSyncAt: null,
        lastSyncStatus: 'idle',
        scopesGranted: []
    };
    const next = Object.fromEntries(Object.keys(PROVIDERS).map((provider) => [provider, { ...emptySource }]));
    Object.entries(existing || {}).forEach(([provider, value]) => {
        next[provider] = { ...(next[provider] || emptySource), ...(value || {}) };
    });

    connections.forEach((connection) => {
        const provider = connection.provider || connection.source_type || connection.metadata?.provider;
        if (!provider) return;
        if (!next[provider]) {
            next[provider] = { ...emptySource };
        }
        next[provider] = {
            ...next[provider],
            connected: Boolean(connection.connected),
            status: connection.status || 'connected',
            displayName: connection.displayName || connection.display_name || next[provider].displayName,
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

function getIntegrationCapabilities() {
    const liveProviders = [];
    const demoProviders = [];

    for (const provider of Object.keys(PROVIDERS)) {
        const { clientId, clientSecret } = getProviderSecrets(provider);
        if (clientId && clientSecret) {
            liveProviders.push(provider);
        } else {
            demoProviders.push(provider);
        }
    }

    return {
        liveProviders,
        demoProviders,
        demoMode: demoProviders.length > 0,
        allLive: demoProviders.length === 0
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
    getIntegrationCapabilities,
    decryptTokenBundle
};
