const request = require('supertest');

process.env.INTERNAL_USAGE_SECRET = 'test-usage-secret';

jest.mock('../config/firebase', () => {
    const state = {
        firebaseInitialized: true,
        users: [],
        apiKeys: [],
        usageLogs: []
    };

    const collectionMap = {
        users: 'users',
        api_keys: 'apiKeys',
        usage_logs: 'usageLogs'
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
                bucket.push({ id, data: payload });
                return { id };
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
        auth: {
            verifyIdToken: jest.fn(async (token) => {
                if (token === 'valid-id-token') {
                    return {
                        uid: 'firebase-user-1',
                        email: 'firebase@example.com',
                        name: 'Firebase User'
                    };
                }

                const error = new Error('Invalid Firebase token');
                error.code = 'auth/argument-error';
                throw error;
            })
        },
        db,
        COLLECTIONS: {
            USERS: 'users',
            API_KEYS: 'api_keys',
            USAGE_LOGS: 'usage_logs'
        },
        initializeDatabase: jest.fn(async () => ({ ok: true })),
        get firebaseInitialized() {
            return state.firebaseInitialized;
        },
        __setFirebaseInitialized(value) {
            state.firebaseInitialized = value;
        },
        __setMockData(data) {
            state.users = data.users || [];
            state.apiKeys = data.apiKeys || [];
            state.usageLogs = data.usageLogs || [];
            state.firebaseInitialized = data.firebaseInitialized ?? state.firebaseInitialized;
        }
    };
});

jest.mock('../middleware/auth', () => {
    let mockUser = {
        id: 'user-1',
        email: 'user@example.com',
        name: 'Test User',
        tier: 'free'
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

const firebase = require('../config/firebase');
const auth = require('../middleware/auth');
const { app } = require('../server');

describe('Backend API', () => {
    beforeEach(() => {
        firebase.__setFirebaseInitialized(true);
        firebase.__setMockData({
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
            tier: 'free'
        });
    });

    test('health endpoint is public', async () => {
        const response = await request(app).get('/health');

        expect(response.statusCode).toBe(200);
        expect(response.body.status).toBe('healthy');
    });

    test('auth register creates a user payload with limited-time access metadata', async () => {
        const response = await request(app)
            .post('/api/auth/register')
            .send({
                email: 'new@example.com',
                password: 'supersecret123',
                name: 'New User'
            });

        expect(response.statusCode).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.user.email).toBe('new@example.com');
        expect(response.body.access.label).toBe('Limited-time free access');
    });

    test('auth me returns the authenticated user payload', async () => {
        const response = await request(app)
            .get('/api/auth/me')
            .set('Authorization', 'Bearer test-token');

        expect(response.statusCode).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.user.email).toBe('user@example.com');
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
        expect(listResponse.body).toHaveLength(1);
        expect(listResponse.body[0].name).toBe('Primary Key');
    });

    test('usage route summarizes request activity', async () => {
        const now = new Date().toISOString();
        firebase.__setMockData({
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
        firebase.__setMockData({
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
        expect(response.body.stats.documentsProcessed).toBe(1);
        expect(response.body.recentActivity).toHaveLength(1);
    });

    test('firebase session requires a verified Firebase ID token', async () => {
        const response = await request(app)
            .post('/api/auth/firebase-session')
            .send({ idToken: 'invalid-token' });

        expect(response.statusCode).toBe(401);
        expect(response.body.success).toBe(false);
    });

    test('firebase session syncs a verified Firebase user', async () => {
        const response = await request(app)
            .post('/api/auth/firebase-session')
            .send({ idToken: 'valid-id-token' });

        expect(response.statusCode).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.user.email).toBe('firebase@example.com');
        expect(response.body.token).toBeTruthy();
    });

    test('api key delete blocks access to another user key', async () => {
        firebase.__setMockData({
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
