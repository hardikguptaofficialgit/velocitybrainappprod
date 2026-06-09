const request = require('supertest');
const OTPAuth = require('otpauth');

process.env.INTERNAL_USAGE_SECRET = 'test-usage-secret';
process.env.ALLOW_PUBLIC_SIGNUP = 'false';
process.env.APPROVED_USER_DOMAINS = 'example.com';

jest.mock('../config/appwrite', () => {
    const state = {
        appwriteInitialized: true,
        users: [],
        workspaces: [],
        userSettings: [],
        apiKeys: [],
        usageLogs: [],
        hostedIngests: [],
        agentConnections: [],
        agentPairingSessions: [],
        agentTokens: [],
        insightEvents: [],
        sourceConnections: [],
        sourceSyncJobs: [],
        sourceArtifacts: [],
        sourceConnectionEvents: []
    };

    const collectionMap = {
        users: 'users',
        workspaces: 'workspaces',
        user_settings: 'userSettings',
        api_keys: 'apiKeys',
        usage_logs: 'usageLogs',
        hosted_ingests: 'hostedIngests',
        agent_connections: 'agentConnections',
        agent_pairing_sessions: 'agentPairingSessions',
        agent_tokens: 'agentTokens',
        insight_events: 'insightEvents',
        source_connections: 'sourceConnections',
        source_sync_jobs: 'sourceSyncJobs',
        source_artifacts: 'sourceArtifacts',
        source_connection_events: 'sourceConnectionEvents'
    };

    const getBucket = (collectionName) => state[collectionMap[collectionName]] || [];

    const makeRef = (collectionName, id) => ({
        update: jest.fn(async (updates) => {
            const record = getBucket(collectionName).find((entry) => entry.id === id);
            if (record) {
                Object.assign(record.data, updates);
            }
        }),
        delete: jest.fn(async () => {
            const bucket = getBucket(collectionName);
            const index = bucket.findIndex((entry) => entry.id === id);
            if (index >= 0) {
                bucket.splice(index, 1);
            }
        }),
        set: jest.fn(async (payload) => {
            const bucket = getBucket(collectionName);
            const existing = bucket.find((entry) => entry.id === id);
            if (existing) {
                existing.data = payload;
            } else {
                bucket.push({ id, data: payload });
            }
        })
    });

    const makeDoc = (collectionName, record) => ({
        id: record.id,
        exists: true,
        data: () => record.data,
        ref: makeRef(collectionName, record.id)
    });

    const emptyDoc = (collectionName, id) => ({
        id,
        exists: false,
        data: () => undefined,
        ref: makeRef(collectionName, id)
    });

    const runQuery = (collectionName, filters = [], limitCount = null) => {
        let records = [...getBucket(collectionName)];
        for (const filter of filters) {
            records = records.filter((entry) => entry.data[filter.field] === filter.value);
        }
        if (typeof limitCount === 'number') {
            records = records.slice(0, limitCount);
        }

        return {
            docs: records.map((record) => makeDoc(collectionName, record)),
            empty: records.length === 0
        };
    };

    const queryBuilder = (collectionName, filters = [], limitCount = null) => ({
        where(field, _operator, value) {
            return queryBuilder(collectionName, [...filters, { field, value }], limitCount);
        },
        limit(count) {
            return queryBuilder(collectionName, filters, count);
        },
        async get() {
            return runQuery(collectionName, filters, limitCount);
        }
    });

    const db = {
        collection: jest.fn((collectionName) => ({
            where(field, _operator, value) {
                return queryBuilder(collectionName, [{ field, value }]);
            },
            limit(count) {
                return queryBuilder(collectionName, [], count);
            },
            async get() {
                return runQuery(collectionName);
            },
            async add(payload) {
                const bucket = getBucket(collectionName);
                const id = `${collectionName}-${bucket.length + 1}`;
                const record = { id, data: payload };
                bucket.push(record);
                return {
                    id,
                    async get() {
                        return makeDoc(collectionName, record);
                    }
                };
            },
            doc(id) {
                return {
                    async get() {
                        const record = getBucket(collectionName).find((entry) => entry.id === id);
                        return record ? makeDoc(collectionName, record) : emptyDoc(collectionName, id);
                    },
                    async update(updates) {
                        await makeRef(collectionName, id).update(updates);
                    },
                    async delete() {
                        await makeRef(collectionName, id).delete();
                    },
                    async set(payload) {
                        await makeRef(collectionName, id).set(payload);
                    }
                };
            }
        }))
    };

    return {
        db,
        endpoint: 'https://fra.cloud.appwrite.io/v1',
        projectId: '69e7d0a0002573ec6840',
        ID: { unique: jest.fn(() => 'unique-file-id') },
        Permission: { read: jest.fn((role) => `read:${role}`) },
        Role: { any: jest.fn(() => 'any') },
        BUCKETS: {
            PROFILE_IMAGES: 'profile_images',
            WORKSPACE_IMAGES: 'workspace_images'
        },
        storage: {
            createFile: jest.fn(async ({ fileId }) => ({ $id: fileId || 'uploaded-file' })),
            deleteFile: jest.fn(async () => ({}))
        },
        COLLECTIONS: {
            USERS: 'users',
            WORKSPACES: 'workspaces',
            USER_SETTINGS: 'user_settings',
            API_KEYS: 'api_keys',
            USAGE_LOGS: 'usage_logs',
            HOSTED_INGESTS: 'hosted_ingests',
            AGENT_CONNECTIONS: 'agent_connections',
            AGENT_PAIRING_SESSIONS: 'agent_pairing_sessions',
            AGENT_TOKENS: 'agent_tokens',
            INSIGHT_EVENTS: 'insight_events',
            SOURCE_CONNECTIONS: 'source_connections',
            SOURCE_SYNC_JOBS: 'source_sync_jobs',
            SOURCE_ARTIFACTS: 'source_artifacts',
            SOURCE_CONNECTION_EVENTS: 'source_connection_events'
        },
        initializeDatabase: jest.fn(async () => ({ ok: true })),
        getDatabaseHealth: jest.fn(async () => ({
            connected: true,
            status: 'connected',
            databaseId: 'velocitybrain',
            collections: 19
        })),
        get appwriteInitialized() {
            return state.appwriteInitialized;
        },
        __setAppwriteInitialized(value) {
            state.appwriteInitialized = value;
        },
        __setMockData(data) {
            state.users = data.users || [];
            state.workspaces = data.workspaces || [];
            state.userSettings = data.userSettings || [];
            state.apiKeys = data.apiKeys || [];
            state.usageLogs = data.usageLogs || [];
            state.hostedIngests = data.hostedIngests || [];
            state.agentConnections = data.agentConnections || [];
            state.agentPairingSessions = data.agentPairingSessions || [];
            state.agentTokens = data.agentTokens || [];
            state.insightEvents = data.insightEvents || [];
            state.sourceConnections = data.sourceConnections || [];
            state.sourceSyncJobs = data.sourceSyncJobs || [];
            state.sourceArtifacts = data.sourceArtifacts || [];
            state.sourceConnectionEvents = data.sourceConnectionEvents || [];
            state.appwriteInitialized = data.appwriteInitialized ?? state.appwriteInitialized;
        }
    };
});

jest.mock('../middleware/auth', () => {
    let mockUser = {
        id: 'user-1',
        email: 'user@example.com',
        name: 'Test User',
        tier: 'free',
        onboardingCompleted: false,
        workspaceId: '',
        workspaceIds: []
    };

    return {
        generateToken: jest.fn((userId) => `token-for-${userId}`),
        authenticate: jest.fn((req, res, next) => {
            if (!mockUser) {
                return res.status(401).json({ success: false, message: 'Access token required' });
            }
            req.user = mockUser;
            next();
        }),
        optionalAuth: jest.fn((req, _res, next) => next()),
        tierRateLimit: jest.fn(() => (_req, _res, next) => next()),
        __setMockUser(user) {
            mockUser = user;
        }
    };
});

const appwrite = require('../config/appwrite');
const auth = require('../middleware/auth');
const { app } = require('../server');

describe('Backend API', () => {
    beforeEach(() => {
        appwrite.__setAppwriteInitialized(true);
        appwrite.__setMockData({
            users: [
                {
                    id: 'user-1',
                    data: {
                        email: 'user@example.com',
                        name: 'Test User',
                        tier: 'free',
                        status: 'active'
                    }
                }
            ],
            apiKeys: [],
            usageLogs: []
        });
        auth.__setMockUser({
            id: 'user-1',
            email: 'user@example.com',
            name: 'Test User',
            tier: 'free',
            onboardingCompleted: false,
            workspaceId: '',
            workspaceIds: []
        });
    });

    test('health endpoint is public', async () => {
        const response = await request(app).get('/health');

        expect(response.statusCode).toBe(200);
        expect(response.body.status).toBe('healthy');
        expect(response.body.database.connected).toBe(true);
    });

    test('auth register is delegated to Appwrite Auth', async () => {
        const response = await request(app)
            .post('/api/auth/register')
            .send({
                email: 'new@example.com',
                password: 'supersecret123',
                name: 'New User'
            });

        expect(response.statusCode).toBe(410);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toMatch(/Appwrite Auth/);
    });

    test('auth login is delegated to Appwrite Auth', async () => {
        const response = await request(app)
            .post('/api/auth/login')
            .send({
                email: 'password@example.com',
                password: 'supersecret123'
            });

        expect(response.statusCode).toBe(410);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toMatch(/Appwrite Auth/);
    });

    test('auth two-factor challenge completion issues a product session token', async () => {
        const twoFactorSecret = new OTPAuth.Secret().base32;
        appwrite.__setMockData({
            users: [
                {
                    id: 'two-factor-user-1',
                    data: {
                        email: 'twofactor@example.com',
                        name: 'Two Factor User',
                        tier: 'free',
                        status: 'active',
                        onboarding_completed: true,
                        '2fa_enabled': true,
                        '2fa_secret': twoFactorSecret
                    }
                }
            ],
            apiKeys: [],
            usageLogs: []
        });

        const totp = new OTPAuth.TOTP({
            issuer: 'VelocityBrain',
            label: 'twofactor@example.com',
            secret: twoFactorSecret
        });
        const challengeToken = require('jsonwebtoken').sign({
            userId: 'two-factor-user-1',
            purpose: '2fa-auth',
            channel: 'appwrite'
        }, process.env.JWT_SECRET || 'velocitybrain-dev-secret', { expiresIn: '10m' });

        const completeResponse = await request(app)
            .post('/api/auth/2fa/complete')
            .send({
                challengeToken,
                token: totp.generate()
            });

        expect(completeResponse.statusCode).toBe(200);
        expect(completeResponse.body.success).toBe(true);
        expect(completeResponse.body.user.email).toBe('twofactor@example.com');
        expect(completeResponse.body.user.twoFactorEnabled).toBe(true);
        expect(completeResponse.body.token).toBe('token-for-two-factor-user-1');
    });

    test('auth me returns the authenticated user payload', async () => {
        const response = await request(app)
            .get('/api/auth/me')
            .set('Authorization', 'Bearer test-token');

        expect(response.statusCode).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.user.email).toBe('user@example.com');
    });

    test('settings route returns persisted user settings payload', async () => {
        const response = await request(app)
            .get('/api/settings')
            .set('Authorization', 'Bearer test-token');

        expect(response.statusCode).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.user.email).toBe('user@example.com');
        expect(response.body.settings.notifications.emailAlerts).toBe(true);
    });

    test('settings onboarding creates an Appwrite workspace and completes the user profile', async () => {
        const response = await request(app)
            .post('/api/settings/onboarding')
            .set('Authorization', 'Bearer test-token')
            .send({
                accountType: 'individual',
                name: 'Test User',
                workspaceName: 'Test Workspace',
                timezone: 'Asia/Calcutta',
                avatarUrl: 'https://api.dicebear.com/9.x/bottts-neutral/svg?seed=Test',
                workspaceImageUrl: 'https://api.dicebear.com/9.x/shapes/svg?seed=Workspace',
                notifications: {
                    emailAlerts: true,
                    weeklyDigest: true
                },
                api: {
                    responseStyle: 'normal',
                    allowedOrigins: []
                },
                agents: {
                    preferredAgent: 'codex',
                    preferredSurface: 'mcp',
                    primaryWorkflow: 'coding',
                    observabilityFocus: 'repository_activity',
                    pairingPreference: 'browser_assisted',
                    autoOpenAgentManager: true
                },
                companySources: {
                    github: { connected: false, skipped: false }
                },
                onboardingSelections: {
                    integrationsSkipped: true,
                    infoCollectionMode: 'manual'
                }
            });

        expect(response.statusCode).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.user.onboardingCompleted).toBe(true);
        expect(response.body.user.workspaceId).toBe('workspaces-1');
        expect(response.body.workspace.name).toBe('Test Workspace');
        expect(response.body.workspace.members).toHaveLength(1);
        expect(response.body.settings.notifications.emailAlerts).toBe(true);
        expect(response.body.settings.api.responseStyle).toBe('normal');
    });

    test('2FA setup and verify flow works', async () => {
        const setupResponse = await request(app)
            .post('/api/auth/2fa/setup')
            .set('Authorization', 'Bearer test-token');

        expect(setupResponse.statusCode).toBe(200);
        expect(setupResponse.body.success).toBe(true);
        expect(setupResponse.body.secret).toBeTruthy();
        expect(setupResponse.body.qrCode.startsWith('data:image/png;base64,')).toBe(true);
        expect(setupResponse.body.user.twoFactorEnabled).toBe(false);

        const totp = new OTPAuth.TOTP({
            issuer: 'VelocityBrain',
            label: 'user@example.com',
            secret: setupResponse.body.secret
        });

        const verifyResponse = await request(app)
            .post('/api/auth/2fa/verify')
            .set('Authorization', 'Bearer test-token')
            .send({ token: totp.generate() });

        expect(verifyResponse.statusCode).toBe(200);
        expect(verifyResponse.body.success).toBe(true);
        expect(verifyResponse.body.user.twoFactorEnabled).toBe(true);
    });

    test('api key routes can create and list keys', async () => {
        const createResponse = await request(app)
            .post('/api/api-keys')
            .set('Authorization', 'Bearer test-token')
            .send({ name: 'Primary Key' });

        expect(createResponse.statusCode).toBe(200);
        expect(createResponse.body.success).toBe(true);
        expect(createResponse.body.key.startsWith('vb-')).toBe(true);
        expect(createResponse.body.apiKey.dailyQuota).toBe(1000);

        const listResponse = await request(app)
            .get('/api/api-keys')
            .set('Authorization', 'Bearer test-token');

        expect(listResponse.statusCode).toBe(200);
        expect(Array.isArray(listResponse.body.keys)).toBe(true);
        expect(listResponse.body.keys).toHaveLength(1);
        expect(listResponse.body.keys[0].name).toBe('Primary Key');
        expect(Array.isArray(listResponse.body.insights)).toBe(true);
        expect(Array.isArray(listResponse.body.anomalies)).toBe(true);
    });

    test('usage route summarizes request activity', async () => {
        const now = new Date().toISOString();
        appwrite.__setMockData({
            users: [
                {
                    id: 'user-1',
                    data: {
                        email: 'user@example.com',
                        name: 'Test User',
                        tier: 'free',
                        status: 'active'
                    }
                }
            ],
            usageLogs: [
                {
                    id: 'usage-1',
                    data: {
                        user_id: 'user-1',
                        endpoint: '/v1/query',
                        method: 'POST',
                        status_code: 200,
                        response_time_ms: 120,
                        created_at: now
                    }
                },
                {
                    id: 'usage-2',
                    data: {
                        user_id: 'user-1',
                        endpoint: '/v1/ingest',
                        method: 'POST',
                        status_code: 500,
                        response_time_ms: 240,
                        created_at: now
                    }
                }
            ]
        });

        const response = await request(app)
            .get('/api/usage')
            .set('Authorization', 'Bearer test-token');

        expect(response.statusCode).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.stats.totalCalls).toBe(2);
        expect(response.body.stats.errorRate).toBe(50);
        expect(response.body.hourlyDistribution).toHaveLength(24);
    });

    test('dashboard route returns aggregated stats', async () => {
        const now = new Date().toISOString();
        appwrite.__setMockData({
            users: [
                {
                    id: 'user-1',
                    data: {
                        email: 'user@example.com',
                        name: 'Test User',
                        tier: 'free',
                        status: 'active'
                    }
                }
            ],
            apiKeys: [
                {
                    id: 'key-1',
                    data: {
                        user_id: 'user-1',
                        name: 'Primary Key',
                        status: 'active'
                    }
                }
            ],
            usageLogs: [
                {
                    id: 'usage-1',
                    data: {
                        user_id: 'user-1',
                        endpoint: '/v1/ingest/file',
                        method: 'POST',
                        status_code: 201,
                        avoided_input_tokens: 420,
                        estimated_cost_saved: 0.00126,
                        reuse_hit_type: 'repo_context',
                        created_at: now
                    }
                }
            ]
        });

        const response = await request(app)
            .get('/api/dashboard/stats')
            .set('Authorization', 'Bearer test-token');

        expect(response.statusCode).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.stats.activeApiKeys).toBe(1);
        expect(response.body.stats.totalApiCalls).toBe(1);
        expect(response.body.stats.totalSavedTokens).toBe(420);
        expect(response.body.stats.documentsProcessed).toBe(0.00126);
        expect(response.body.stats.successRate).toBe(100);
        expect(response.body.stats.reuseHitRate).toBe(100);
        expect(response.body.recentActivity).toHaveLength(1);
    });

    test('dashboard agents returns repo-backed agent runtime status', async () => {
        const response = await request(app)
            .get('/api/dashboard/agents')
            .set('Authorization', 'Bearer test-token');

        expect(response.statusCode).toBe(200);
        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.agents)).toBe(true);
        expect(response.body.agents.length).toBeGreaterThan(0);
        expect(response.body.workspace.agentsMdPresent).toBe(true);
        expect(response.body.workspace.mcpRuntimePresent).toBe(true);
        expect(response.body.workspace.integrationDocsPresent).toBeGreaterThan(0);
        expect(response.body.workspace.setupScriptsPresent).toBeGreaterThan(0);
        expect(response.body.workspace.readyAgentCount).toBeGreaterThan(0);
        expect(response.body.agents.some((agent) => agent.templateReady)).toBe(true);
        expect(response.body.agents.some((agent) => Array.isArray(agent.extras) && agent.extras.length > 0)).toBe(true);
        expect(Array.isArray(response.body.workspaceFiles)).toBe(true);
    });

    test('auth me returns the Appwrite-backed profile payload', async () => {
        const response = await request(app)
            .get('/api/auth/me')
            .set('Authorization', 'Bearer appwrite-jwt');

        expect(response.statusCode).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.user.email).toBe('user@example.com');
        expect(response.body.access.label).toBe('Open signup');
    });

    test('api key delete blocks access to another user key', async () => {
        appwrite.__setMockData({
            users: [
                {
                    id: 'user-1',
                    data: {
                        email: 'user@example.com',
                        name: 'Test User',
                        tier: 'free',
                        status: 'active'
                    }
                }
            ],
            apiKeys: [
                {
                    id: 'key-foreign',
                    data: {
                        user_id: 'user-2',
                        name: 'Foreign Key',
                        status: 'active'
                    }
                }
            ],
            usageLogs: []
        });

        const response = await request(app)
            .delete('/api/api-keys/key-foreign')
            .set('Authorization', 'Bearer test-token');

        expect(response.statusCode).toBe(403);
        expect(response.body.success).toBe(false);
    });

    test('usage log endpoint requires the internal usage secret', async () => {
        const unauthorized = await request(app)
            .post('/api/usage/log')
            .send({ userId: 'user-1', endpoint: '/v1/query', method: 'POST', statusCode: 200 });

        expect(unauthorized.statusCode).toBe(401);

        const authorized = await request(app)
            .post('/api/usage/log')
            .set('x-internal-usage-secret', 'test-usage-secret')
            .send({ userId: 'user-1', endpoint: '/v1/query', method: 'POST', statusCode: 200 });

        expect(authorized.statusCode).toBe(200);
        expect(authorized.body.success).toBe(true);
    });
});
