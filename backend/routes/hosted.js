const express = require('express');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { db, COLLECTIONS, appwriteInitialized } = require('../config/appwrite');
const { aggregateObservability } = require('../utils/observability');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'velocitybrain-dev-secret';
const HOSTED_ACCESS_TTL_SECONDS = 3600;
const HOSTED_REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60;
const CORE_API_URL = (process.env.CORE_API_URL || '').replace(/\/+$/, '');
const skillsRoot = path.resolve(__dirname, '../../skills');

function hashApiKey(key) {
    return crypto.createHash('sha256').update(key).digest('hex');
}

function hashValue(value) {
    return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function randomToken(prefix = 'vbp', bytes = 24) {
    return `${prefix}_${crypto.randomBytes(bytes).toString('hex')}`;
}

async function validateApiKey(apiKey) {
    if (!apiKey || !appwriteInitialized) {
        return null;
    }

    const keys = await db.collection(COLLECTIONS.API_KEYS)
        .where('key_hash', '==', hashApiKey(apiKey))
        .limit(1)
        .get();

    if (keys.empty) {
        return null;
    }

    const keyDoc = keys.docs[0];
    const key = keyDoc.data();
    if (key.status !== 'active') {
        return null;
    }

    await keyDoc.ref.update({ last_used_at: new Date().toISOString() });

    return {
        apiKey,
        apiKeyId: keyDoc.id,
        userId: key.user_id,
        tier: key.tier || 'free',
        dailyQuota: key.daily_quota || 100,
        monthlyQuota: key.monthly_quota || 1000
    };
}

function issueHostedTokens(keyInfo) {
    const accessToken = jwt.sign(
        {
            api_key: keyInfo.apiKey,
            api_key_id: keyInfo.apiKeyId,
            tier: keyInfo.tier,
            rate_limit: keyInfo.dailyQuota,
            user_id: keyInfo.userId,
            type: 'access'
        },
        JWT_SECRET,
        { expiresIn: HOSTED_ACCESS_TTL_SECONDS }
    );

    const refreshToken = jwt.sign(
        {
            api_key: keyInfo.apiKey,
            api_key_id: keyInfo.apiKeyId,
            user_id: keyInfo.userId,
            type: 'refresh'
        },
        JWT_SECRET,
        { expiresIn: HOSTED_REFRESH_TTL_SECONDS }
    );

    return {
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: 'bearer',
        expires_in: HOSTED_ACCESS_TTL_SECONDS,
        credential_kind: 'api_key'
    };
}

async function loadAgentConnection(connectionId) {
    if (!appwriteInitialized || !connectionId) {
        return null;
    }

    const doc = await db.collection(COLLECTIONS.AGENT_CONNECTIONS).doc(connectionId).get();
    if (!doc.exists) {
        return null;
    }

    return {
        id: doc.id,
        ...doc.data()
    };
}

function issueAgentTokens(connection, tokenRecord = {}) {
    const accessToken = jwt.sign(
        {
            user_id: connection.user_id,
            api_key_id: connection.api_key_id || null,
            agent_connection_id: connection.id,
            agent_id: connection.agent_id,
            agent_instance_id: connection.agent_instance_id || null,
            repo_scopes: connection.repo_scopes || ['*'],
            token_kind: 'agent',
            type: 'access'
        },
        JWT_SECRET,
        { expiresIn: HOSTED_ACCESS_TTL_SECONDS }
    );

    const refreshToken = jwt.sign(
        {
            user_id: connection.user_id,
            api_key_id: connection.api_key_id || null,
            agent_connection_id: connection.id,
            token_id: tokenRecord.id || null,
            token_kind: 'agent',
            type: 'refresh'
        },
        JWT_SECRET,
        { expiresIn: HOSTED_REFRESH_TTL_SECONDS }
    );

    return {
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: 'bearer',
        expires_in: HOSTED_ACCESS_TTL_SECONDS,
        credential_kind: 'agent',
        agent_connection_id: connection.id,
        agent_id: connection.agent_id
    };
}

async function createAgentToken(connection, metadata = {}) {
    const now = new Date().toISOString();
    const record = {
        user_id: connection.user_id,
        api_key_id: connection.api_key_id || null,
        agent_connection_id: connection.id,
        status: 'active',
        refresh_token_hash: hashValue(randomToken('vbr', 12)),
        metadata,
        created_at: now,
        updated_at: now
    };

    if (!appwriteInitialized) {
        return { id: randomToken('agt', 6), ...record };
    }

    const ref = await db.collection(COLLECTIONS.AGENT_TOKENS).add(record);
    return { id: ref.id, ...record };
}

async function revokeAgentTokensForConnection(connectionId, reason = 'revoked') {
    if (!appwriteInitialized || !connectionId) {
        return;
    }

    const snapshot = await db.collection(COLLECTIONS.AGENT_TOKENS)
        .where('agent_connection_id', '==', connectionId)
        .where('status', '==', 'active')
        .limit(500)
        .get();

    await Promise.all(snapshot.docs.map((doc) => doc.ref.update({
        status: 'revoked',
        revoked_reason: reason,
        updated_at: new Date().toISOString()
    })));
}

async function authenticateHosted(req, res, next) {
    try {
        const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
        if (!token) {
            return res.status(401).json({ detail: 'Not authenticated' });
        }

        const payload = jwt.verify(token, JWT_SECRET);
        if (payload.type !== 'access') {
            return res.status(401).json({ detail: 'Invalid token type' });
        }

        if (payload.token_kind === 'agent') {
            const connection = await loadAgentConnection(payload.agent_connection_id);
            if (!connection || connection.status === 'revoked' || connection.status === 'disconnected') {
                return res.status(401).json({ detail: 'Agent connection is no longer active' });
            }
            payload.agent_connection = connection;
        }

        req.hostedUser = payload;
        return next();
    } catch (error) {
        return res.status(401).json({ detail: 'Invalid or expired token' });
    }
}

async function proxyToCoreApi(req, res, fallback) {
    if (!CORE_API_URL) {
        return fallback();
    }

    try {
        const upstream = await fetch(`${CORE_API_URL}${req.originalUrl}`, {
            method: req.method,
            headers: {
                'Content-Type': 'application/json',
                ...(req.headers.authorization ? { Authorization: req.headers.authorization } : {})
            },
            body: ['GET', 'HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body || {})
        });

        if (upstream.ok) {
            const data = await upstream.json();
            return res.status(upstream.status).json(data);
        }
    } catch (error) {
        console.warn('[HostedRoutes] Core API proxy failed, using fallback:', error.message);
    }

    return fallback();
}

function collectSkills() {
    const skills = [];

    const visit = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                visit(fullPath);
                continue;
            }
            if (!entry.isFile() || !entry.name.endsWith('.json')) {
                continue;
            }
            try {
                const parsed = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
                skills.push({
                    skill_key: parsed.skill_key || entry.name.replace(/\.json$/, ''),
                    name: parsed.name || parsed.skill_key || entry.name,
                    category: parsed.category || 'general',
                    version: parsed.version || '1.0.0'
                });
            } catch (error) {
                console.warn('[HostedRoutes] Skipping invalid skill manifest:', fullPath, error.message);
            }
        }
    };

    if (fs.existsSync(skillsRoot)) {
        visit(skillsRoot);
    }

    return skills.sort((a, b) => `${a.category}:${a.name}`.localeCompare(`${b.category}:${b.name}`));
}

async function buildUsageSummary(userId) {
    if (!appwriteInitialized) {
        return {
            total_runs: 0,
            repeat_rate: 0,
            reuse_hit_rate: 0,
            avg_token_savings: 0
        };
    }

    const snapshot = await db.collection(COLLECTIONS.USAGE_LOGS)
        .where('user_id', '==', userId)
        .limit(10000)
        .get();

    const logs = snapshot.docs.map((doc) => doc.data());
    const totalRuns = logs.length;
    const reuseHits = logs.filter((log) => (log.reuse_hit_type || 'none') !== 'none');
    const repeatCandidates = new Set(
        logs
            .map((log) => `${log.method || 'GET'}:${log.endpoint || ''}:${log.repo_id || 'default-workspace'}`)
            .filter(Boolean)
    );
    const savedTokens = logs.reduce((sum, log) => sum + Number(log.avoided_input_tokens || 0), 0);

    return {
        total_runs: totalRuns,
        repeat_rate: totalRuns > 0 ? Number(((totalRuns - repeatCandidates.size) / totalRuns).toFixed(3)) : 0,
        reuse_hit_rate: totalRuns > 0 ? Number((reuseHits.length / totalRuns).toFixed(3)) : 0,
        avg_token_savings: totalRuns > 0 ? Number((savedTokens / totalRuns).toFixed(2)) : 0
    };
}

async function logHostedUsage({
    userId,
    apiKeyId,
    endpoint,
    method,
    statusCode = 200,
    responseTimeMs = 0,
    reuseHitType = 'none',
    artifactsUsed = 0,
    avoidedInputTokens = 0,
    estimatedCostSaved = 0,
    estimatedLatencySavedMs = 0,
    repoId = 'default-workspace',
    repoName = 'default-workspace',
    repoPath = '',
    branch = '',
    projectId = '',
    agentId = 'unknown-agent',
    agentInstanceId = '',
    agentSurface = 'mcp',
    modelProvider = 'unknown',
    modelName = 'unknown',
    taskType = 'unknown',
    operationType = 'unknown',
    runId = '',
    sessionId = '',
    requestTokens = 0,
    responseTokens = 0,
    totalTokens = 0,
    costUsd = 0,
    status = 'completed',
    errorType = '',
    insightFlags = []
}) {
    if (!appwriteInitialized) {
        return;
    }

    await db.collection(COLLECTIONS.USAGE_LOGS).add({
        api_key_id: apiKeyId || null,
        user_id: userId,
        endpoint,
        method,
        status_code: statusCode,
        response_time_ms: responseTimeMs,
        request_size: 0,
        response_size: 0,
        reuse_hit_type: reuseHitType || 'none',
        artifacts_used: artifactsUsed || 0,
        avoided_input_tokens: avoidedInputTokens || 0,
        estimated_cost_saved: estimatedCostSaved || 0,
        estimated_latency_saved_ms: estimatedLatencySavedMs || 0,
        repo_id: repoId || 'default-workspace',
        repo_name: repoName || repoId || 'default-workspace',
        repo_path: repoPath || '',
        branch: branch || '',
        project_id: projectId || repoId || 'default-workspace',
        agent_id: agentId || 'unknown-agent',
        agent_instance_id: agentInstanceId || '',
        agent_surface: agentSurface || 'mcp',
        model_provider: modelProvider || 'unknown',
        model_name: modelName || 'unknown',
        task_type: taskType || 'unknown',
        operation_type: operationType || 'unknown',
        run_id: runId || '',
        session_id: sessionId || '',
        request_tokens: requestTokens || 0,
        response_tokens: responseTokens || 0,
        total_tokens: totalTokens || ((requestTokens || 0) + (responseTokens || 0)),
        cost_usd: costUsd || 0,
        latency_ms: responseTimeMs || 0,
        status: status || 'completed',
        error_type: errorType || '',
        insight_flags: Array.isArray(insightFlags) ? insightFlags : [],
        created_at: new Date().toISOString()
    });
}

async function upsertAgentConnection(userId, payload = {}) {
    const agentId = String(payload.agent_id || '').trim();
    if (!agentId) {
        return null;
    }

    const repoId = String(payload.repo_id || 'default-workspace').trim() || 'default-workspace';
    const record = {
        user_id: userId,
        api_key_id: payload.api_key_id || null,
        agent_id: agentId,
        agent_instance_id: String(payload.agent_instance_id || `${agentId}-${repoId}`).trim(),
        agent_surface: String(payload.agent_surface || 'mcp').trim(),
        status: String(payload.status || 'connected'),
        repo_id: repoId,
        repo_name: String(payload.repo_name || repoId),
        repo_path: String(payload.repo_path || ''),
        branch: String(payload.branch || ''),
        project_id: String(payload.project_id || repoId),
        repo_scopes: Array.isArray(payload.repo_scopes) && payload.repo_scopes.length > 0 ? payload.repo_scopes : [repoId],
        metadata: payload.metadata || {},
        updated_at: new Date().toISOString()
    };

    if (!appwriteInitialized) {
        return {
            id: `${agentId}:${repoId}`,
            ...record
        };
    }

    const snapshot = await db.collection(COLLECTIONS.AGENT_CONNECTIONS)
        .where('user_id', '==', userId)
        .where('agent_id', '==', agentId)
        .where('repo_id', '==', repoId)
        .limit(1)
        .get();

    if (snapshot.empty) {
        const created = {
            ...record,
            created_at: record.updated_at
        };
        const ref = await db.collection(COLLECTIONS.AGENT_CONNECTIONS).add(created);
        return { id: ref.id, ...created };
    }

    const doc = snapshot.docs[0];
    await doc.ref.update(record);
    return {
        id: doc.id,
        ...doc.data(),
        ...record
    };
}

async function createPairingSession(userId, payload = {}) {
    const apiKeyId = String(payload.api_key_id || '').trim();
    const agentId = String(payload.agent_id || '').trim();
    if (!apiKeyId || !agentId) {
        return null;
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + (10 * 60 * 1000)).toISOString();
    const pairCode = randomToken('vbp', 8);
    const record = {
        user_id: userId,
        api_key_id: apiKeyId,
        agent_id: agentId,
        agent_surface: String(payload.agent_surface || 'mcp'),
        repo_scope: Array.isArray(payload.repo_scope) && payload.repo_scope.length > 0 ? payload.repo_scope : ['*'],
        project_id: String(payload.project_id || ''),
        status: 'pending',
        code_hash: hashValue(pairCode),
        expires_at: expiresAt,
        metadata: payload.metadata || {},
        created_at: now.toISOString(),
        updated_at: now.toISOString()
    };

    if (!appwriteInitialized) {
        return { id: pairCode, pair_code: pairCode, ...record };
    }

    const ref = await db.collection(COLLECTIONS.AGENT_PAIRING_SESSIONS).add(record);
    return { id: ref.id, pair_code: pairCode, ...record };
}

async function loadPairingSession(pairCode) {
    if (!pairCode || !appwriteInitialized) {
        return null;
    }

    const snapshot = await db.collection(COLLECTIONS.AGENT_PAIRING_SESSIONS)
        .where('code_hash', '==', hashValue(pairCode))
        .limit(1)
        .get();

    if (snapshot.empty) {
        return null;
    }

    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() };
}

async function recordInsightEvent(userId, insight = {}) {
    if (!appwriteInitialized || !userId || !insight?.type) {
        return;
    }

    await db.collection(COLLECTIONS.INSIGHT_EVENTS).add({
        user_id: userId,
        ...insight,
        created_at: insight.timestamp || new Date().toISOString()
    });
}

async function collectHostedIntelligence(userId) {
    if (!appwriteInitialized) {
        return aggregateObservability({ logs: [], connections: [], apiKeys: [] });
    }

    const [logsSnapshot, connectionsSnapshot, apiKeysSnapshot] = await Promise.all([
        db.collection(COLLECTIONS.USAGE_LOGS).where('user_id', '==', userId).limit(10000).get(),
        db.collection(COLLECTIONS.AGENT_CONNECTIONS).where('user_id', '==', userId).limit(500).get(),
        db.collection(COLLECTIONS.API_KEYS).where('user_id', '==', userId).limit(200).get()
    ]);

    return aggregateObservability({
        logs: logsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
        connections: connectionsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
        apiKeys: apiKeysSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
    });
}

async function listAgentConnections(userId) {
    if (!appwriteInitialized) {
        return [];
    }

    const snapshot = await db.collection(COLLECTIONS.AGENT_CONNECTIONS)
        .where('user_id', '==', userId)
        .limit(500)
        .get();

    return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
    }));
}

async function storeHostedIngest(userId, body = {}) {
    const record = {
        user_id: userId,
        source: String(body.source || 'codex'),
        content: String(body.content || '').trim(),
        metadata: body.metadata || {},
        tags: Array.isArray(body.tags) ? body.tags.slice(0, 25) : [],
        created_at: new Date().toISOString()
    };

    if (!record.content) {
        return null;
    }

    if (!appwriteInitialized) {
        return {
            id: `doc_${Date.now()}`,
            ...record
        };
    }

    const ref = await db.collection(COLLECTIONS.HOSTED_INGESTS).add(record);
    return {
        id: ref.id,
        ...record
    };
}

async function loadHostedIngests(userId, limit = 50) {
    if (!appwriteInitialized) {
        return [];
    }

    const snapshot = await db.collection(COLLECTIONS.HOSTED_INGESTS)
        .where('user_id', '==', userId)
        .limit(Math.max(1, Math.min(limit, 100)))
        .get();

    return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
    }));
}

function scoreHostedIngest(doc, question) {
    const haystack = `${doc.source || ''}\n${doc.content || ''}\n${JSON.stringify(doc.metadata || {})}`.toLowerCase();
    const tokens = String(question || '')
        .toLowerCase()
        .split(/[^a-z0-9]+/i)
        .filter((token) => token.length >= 3);

    if (!tokens.length) {
        return 0;
    }

    return tokens.reduce((sum, token) => sum + (haystack.includes(token) ? 1 : 0), 0);
}

async function hostedFallbackQuery(userId, question, responseStyle) {
    const docs = await loadHostedIngests(userId, 75);
    const scored = docs
        .map((doc) => ({ doc, score: scoreHostedIngest(doc, question) }))
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score);

    if (!scored.length) {
        return {
            answer: 'The internal brain does not currently contain sufficient data for this question.',
            confidence: 0,
            sources: [],
            reasoning_summary: 'Hosted fallback query completed with zero user-memory matches. No hallucinated answer returned.',
            response_style: responseStyle
        };
    }

    const top = scored[0].doc;
    return {
        answer: `${top.source || 'note'}: ${String(top.content || '').slice(0, 400)}`,
        confidence: Math.min(0.95, 0.35 + (scored[0].score * 0.1)),
        sources: scored.slice(0, 5).map(({ doc }) => ({
            type: 'note',
            id: doc.id,
            title: doc.source || 'note',
            created_at: doc.created_at || null
        })),
        reasoning_summary: `Hosted fallback query matched ${scored.length} user-ingested notes and used the top-ranked note for synthesis.`,
        response_style: responseStyle
    };
}

function buildFallbackRun(task, metadata = {}) {
    const repoId = metadata.repo_id || metadata.workspace_id || 'unknown-repo';
    const contextPaths = Array.isArray(metadata.context_paths) ? metadata.context_paths : [];
    const sections = [
        `[task]\n${task}`,
        `[repo]\n${repoId}`
    ];

    if (contextPaths.length > 0) {
        for (const currentPath of contextPaths.slice(0, 8)) {
            sections.push(`[${currentPath}]\ncontext was requested for this path`);
        }
    } else {
        sections.push('[context]\nhosted backend is available but no reusable artifact has been recorded yet');
    }

    return {
        result: sections.join('\n\n'),
        reused: false,
        reuse_confidence: 0,
        tokens_saved: 0,
        percent_saved: 0
    };
}

router.get('/health', (_req, res) => {
    res.json({
        status: 'ok',
        service: 'velocitybrain-hosted-compat',
        timestamp: new Date().toISOString()
    });
});

router.post('/auth/authorize', async (req, res) => {
    try {
        const keyInfo = await validateApiKey(req.body?.api_key);
        if (!keyInfo) {
            return res.status(401).json({ detail: 'Invalid API key' });
        }
        return res.json(issueHostedTokens(keyInfo));
    } catch (error) {
        console.error('[HostedRoutes] authorize failed:', error);
        return res.status(500).json({ detail: 'Authorization failed' });
    }
});

router.post('/auth/refresh', async (req, res) => {
    try {
        const payload = jwt.verify(req.body?.refresh_token || '', JWT_SECRET);
        if (payload.type !== 'refresh') {
            return res.status(401).json({ detail: 'Invalid refresh token' });
        }

        if (payload.token_kind === 'agent') {
            const connection = await loadAgentConnection(payload.agent_connection_id);
            if (!connection || connection.status === 'revoked' || connection.status === 'disconnected') {
                return res.status(401).json({ detail: 'Agent connection is no longer active' });
            }

            const tokenRecord = await createAgentToken(connection, { refreshed: true });
            return res.json(issueAgentTokens(connection, tokenRecord));
        }

        const keyInfo = await validateApiKey(payload.api_key);
        if (!keyInfo) {
            return res.status(401).json({ detail: 'API key no longer valid' });
        }

        return res.json(issueHostedTokens(keyInfo));
    } catch (error) {
        return res.status(401).json({ detail: 'Invalid or expired refresh token' });
    }
});

router.post('/agent/pairings/complete', async (req, res) => {
    try {
        const pairCode = String(req.body?.pair_code || '').trim();
        const agentInstanceId = String(req.body?.agent_instance_id || '').trim();
        const repoId = String(req.body?.repo_id || 'default-workspace').trim() || 'default-workspace';
        const repoName = String(req.body?.repo_name || repoId).trim() || repoId;
        const repoPath = String(req.body?.repo_path || '').trim();
        const branch = String(req.body?.branch || '').trim();
        const projectId = String(req.body?.project_id || repoId).trim() || repoId;
        const metadata = req.body?.metadata || {};

        const session = await loadPairingSession(pairCode);
        if (!session) {
            return res.status(404).json({ detail: 'Pairing session not found' });
        }
        if (session.status !== 'pending') {
            return res.status(409).json({ detail: 'Pairing session is no longer pending' });
        }
        if (new Date(session.expires_at) <= new Date()) {
            if (appwriteInitialized) {
                await db.collection(COLLECTIONS.AGENT_PAIRING_SESSIONS).doc(session.id).update({
                    status: 'expired',
                    updated_at: new Date().toISOString()
                });
            }
            return res.status(410).json({ detail: 'Pairing session expired' });
        }

        const connection = await upsertAgentConnection(session.user_id, {
            api_key_id: session.api_key_id,
            agent_id: session.agent_id,
            agent_instance_id: agentInstanceId || `${session.agent_id}-${repoId}`,
            agent_surface: session.agent_surface || 'mcp',
            status: 'connected',
            repo_id: repoId,
            repo_name: repoName,
            repo_path: repoPath,
            branch,
            project_id: projectId,
            repo_scopes: session.repo_scope || ['*'],
            metadata: {
                ...session.metadata,
                ...metadata,
                paired_via: 'pair_code',
                pairing_session_id: session.id
            }
        });

        if (appwriteInitialized) {
            await db.collection(COLLECTIONS.AGENT_PAIRING_SESSIONS).doc(session.id).update({
                status: 'completed',
                completed_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                agent_connection_id: connection.id
            });
        }

        const tokenRecord = await createAgentToken(connection, {
            paired_via: 'pair_code',
            pairing_session_id: session.id
        });

        return res.json({
            success: true,
            connection,
            ...issueAgentTokens(connection, tokenRecord)
        });
    } catch (error) {
        console.error('[HostedRoutes] pairing completion failed:', error);
        return res.status(500).json({ detail: 'Failed to complete pairing' });
    }
});

router.get('/usage', authenticateHosted, async (req, res) => {
    return proxyToCoreApi(req, res, async () => {
        const usage = await buildUsageSummary(req.hostedUser.user_id);
        return res.json(usage);
    });
});

router.get('/integrations', authenticateHosted, async (req, res) => {
    return proxyToCoreApi(req, res, async () => {
        const integrations = await listAgentConnections(req.hostedUser.user_id);
        return res.json({
            integrations
        });
    });
});

router.get('/intelligence', authenticateHosted, async (req, res) => {
    return proxyToCoreApi(req, res, async () => {
        const intelligence = await collectHostedIntelligence(req.hostedUser.user_id);
        await Promise.all((intelligence.anomalies || []).slice(0, 5).map((insight) =>
            recordInsightEvent(req.hostedUser.user_id, insight)
        ));
        return res.json(intelligence);
    });
});

router.post('/integrations/report', authenticateHosted, async (req, res) => {
    return proxyToCoreApi(req, res, async () => {
        const saved = await upsertAgentConnection(req.hostedUser.user_id, {
            ...(req.body || {}),
            api_key_id: req.hostedUser.api_key_id || req.hostedUser.agent_connection?.api_key_id || null,
            agent_id: req.body?.agent_id || req.hostedUser.agent_id || req.hostedUser.agent_connection?.agent_id,
            agent_instance_id: req.body?.agent_instance_id || req.hostedUser.agent_instance_id || req.hostedUser.agent_connection?.agent_instance_id,
            agent_surface: req.body?.agent_surface || req.hostedUser.agent_connection?.agent_surface || 'mcp'
        });
        if (!saved) {
            return res.status(400).json({ detail: 'agent_id is required' });
        }
        return res.json({
            success: true,
            connection: saved
        });
    });
});

router.post('/integrations/:id/revoke', authenticateHosted, async (req, res) => {
    return proxyToCoreApi(req, res, async () => {
        const connection = await loadAgentConnection(req.params.id);
        if (!connection || connection.user_id !== req.hostedUser.user_id) {
            return res.status(404).json({ detail: 'Connection not found' });
        }
        if (appwriteInitialized) {
            await db.collection(COLLECTIONS.AGENT_CONNECTIONS).doc(connection.id).update({
                status: 'revoked',
                updated_at: new Date().toISOString(),
                revoked_at: new Date().toISOString()
            });
        }
        await revokeAgentTokensForConnection(connection.id, 'user_revoked');
        return res.json({ success: true, connection_id: connection.id, status: 'revoked' });
    });
});

router.post('/telemetry/runs', authenticateHosted, async (req, res) => {
    return proxyToCoreApi(req, res, async () => {
        const body = req.body || {};
        const metadata = body.metadata || {};
        await logHostedUsage({
            userId: req.hostedUser.user_id,
            apiKeyId: req.hostedUser.api_key_id || req.hostedUser.agent_connection?.api_key_id || null,
            endpoint: body.endpoint || '/v1/telemetry/runs',
            method: body.method || 'POST',
            statusCode: body.status_code || 200,
            responseTimeMs: body.latency_ms || body.response_time_ms || 0,
            reuseHitType: body.reuse_hit_type || 'none',
            artifactsUsed: body.artifacts_used || 0,
            avoidedInputTokens: body.avoided_input_tokens || 0,
            estimatedCostSaved: body.estimated_cost_saved || 0,
            estimatedLatencySavedMs: body.estimated_latency_saved_ms || 0,
            repoId: body.repo_id || metadata.repo_id || 'default-workspace',
            repoName: body.repo_name || metadata.repo_name || body.repo_id || metadata.repo_id || 'default-workspace',
            repoPath: body.repo_path || metadata.repo_path || '',
            branch: body.branch || metadata.branch || '',
            projectId: body.project_id || metadata.project_id || body.repo_id || metadata.repo_id || 'default-workspace',
            agentId: body.agent_id || req.hostedUser.agent_id || req.hostedUser.agent_connection?.agent_id || 'unknown-agent',
            agentInstanceId: body.agent_instance_id || req.hostedUser.agent_instance_id || req.hostedUser.agent_connection?.agent_instance_id || '',
            agentSurface: body.agent_surface || req.hostedUser.agent_connection?.agent_surface || 'mcp',
            modelProvider: body.model_provider || metadata.model_provider || 'unknown',
            modelName: body.model_name || metadata.model_name || 'unknown',
            taskType: body.task_type || metadata.task_type || 'unknown',
            operationType: body.operation_type || metadata.operation_type || 'unknown',
            runId: body.run_id || metadata.run_id || '',
            sessionId: body.session_id || metadata.session_id || '',
            requestTokens: body.request_tokens || 0,
            responseTokens: body.response_tokens || 0,
            totalTokens: body.total_tokens || 0,
            costUsd: body.cost_usd || 0,
            status: body.status || 'completed',
            errorType: body.error_type || '',
            insightFlags: body.insight_flags || metadata.insight_flags || []
        });
        return res.json({ success: true });
    });
});

router.get('/skills', authenticateHosted, async (req, res) => {
    return proxyToCoreApi(req, res, async () => {
        const skills = collectSkills();
        return res.json({
            skills,
            total: skills.length,
            categories: [...new Set(skills.map((skill) => skill.category))].sort()
        });
    });
});

router.post('/query', authenticateHosted, async (req, res) => {
    return proxyToCoreApi(req, res, async () => {
        const startedAt = Date.now();
        const responseStyle = req.body?.response_style || 'normal';
        const question = String(req.body?.question || '').trim();
        if (!question) {
            return res.status(400).json({ detail: 'Question is required' });
        }
        const response = await hostedFallbackQuery(req.hostedUser.user_id, question, responseStyle);
        const metadata = req.body?.metadata || {};
        await logHostedUsage({
            userId: req.hostedUser.user_id,
            apiKeyId: req.hostedUser.api_key_id || req.hostedUser.agent_connection?.api_key_id || null,
            endpoint: '/v1/query',
            method: 'POST',
            statusCode: 200,
            responseTimeMs: Date.now() - startedAt,
            reuseHitType: response.sources?.length ? 'memory' : 'none',
            artifactsUsed: response.sources?.length || 0,
            avoidedInputTokens: response.sources?.length ? 1200 : 0,
            estimatedCostSaved: response.sources?.length ? 0.0009 : 0,
            estimatedLatencySavedMs: response.sources?.length ? 220 : 0,
            repoId: metadata.repo_id || req.body?.filters?.repo_id || 'default-workspace',
            repoName: metadata.repo_name || metadata.repo_id || 'default-workspace',
            repoPath: metadata.repo_path || '',
            branch: metadata.branch || '',
            projectId: metadata.project_id || metadata.repo_id || 'default-workspace',
            agentId: req.hostedUser.agent_id || req.hostedUser.agent_connection?.agent_id || 'unknown-agent',
            agentInstanceId: req.hostedUser.agent_instance_id || req.hostedUser.agent_connection?.agent_instance_id || '',
            agentSurface: req.hostedUser.agent_connection?.agent_surface || 'mcp',
            modelProvider: metadata.model_provider || 'unknown',
            modelName: metadata.model_name || 'unknown',
            taskType: metadata.task_type || 'memory_lookup',
            operationType: metadata.operation_type || 'query',
            runId: metadata.run_id || '',
            sessionId: metadata.session_id || '',
            insightFlags: response.sources?.length ? ['memory_hit'] : []
        });
        return res.json(response);
    });
});

router.post('/ingest', authenticateHosted, async (req, res) => {
    return proxyToCoreApi(req, res, async () => {
        const startedAt = Date.now();
        const saved = await storeHostedIngest(req.hostedUser.user_id, req.body || {});
        if (!saved) {
            return res.status(400).json({ detail: 'Content is required' });
        }
        const metadata = req.body?.metadata || {};
        await logHostedUsage({
            userId: req.hostedUser.user_id,
            apiKeyId: req.hostedUser.api_key_id || req.hostedUser.agent_connection?.api_key_id || null,
            endpoint: '/v1/ingest',
            method: 'POST',
            statusCode: 200,
            responseTimeMs: Date.now() - startedAt,
            reuseHitType: 'writeback',
            artifactsUsed: 1,
            repoId: metadata.repo_id || 'default-workspace',
            repoName: metadata.repo_name || metadata.repo_id || 'default-workspace',
            repoPath: metadata.repo_path || '',
            branch: metadata.branch || '',
            projectId: metadata.project_id || metadata.repo_id || 'default-workspace',
            agentId: req.hostedUser.agent_id || req.hostedUser.agent_connection?.agent_id || 'unknown-agent',
            agentInstanceId: req.hostedUser.agent_instance_id || req.hostedUser.agent_connection?.agent_instance_id || '',
            agentSurface: req.hostedUser.agent_connection?.agent_surface || 'mcp',
            modelProvider: metadata.model_provider || 'unknown',
            modelName: metadata.model_name || 'unknown',
            taskType: metadata.task_type || 'writeback',
            operationType: metadata.operation_type || 'ingest',
            runId: metadata.run_id || '',
            sessionId: metadata.session_id || '',
            insightFlags: ['writeback']
        });
        return res.json({
            success: true,
            document_id: saved.id,
            processing_time: 0,
            message: 'Content ingested successfully'
        });
    });
});

router.post('/run', authenticateHosted, async (req, res) => {
    return proxyToCoreApi(req, res, async () => {
        const startedAt = Date.now();
        const task = req.body?.task || '';
        if (!task.trim()) {
            return res.status(400).json({ detail: 'Task is required' });
        }
        const metadata = req.body?.metadata || {};
        const response = buildFallbackRun(task, metadata);
        await logHostedUsage({
            userId: req.hostedUser.user_id,
            apiKeyId: req.hostedUser.api_key_id || req.hostedUser.agent_connection?.api_key_id || null,
            endpoint: '/v1/run',
            method: 'POST',
            statusCode: 200,
            responseTimeMs: Date.now() - startedAt,
            reuseHitType: response.reused ? 'repo_context' : 'none',
            artifactsUsed: response.reused ? 1 : 0,
            avoidedInputTokens: response.tokens_saved || 0,
            estimatedCostSaved: Number((((response.tokens_saved || 0) / 1000000) * 0.75).toFixed(6)),
            estimatedLatencySavedMs: response.reused ? 280 : 0,
            repoId: metadata.repo_id || 'default-workspace',
            repoName: metadata.repo_name || metadata.repo_id || 'default-workspace',
            repoPath: metadata.repo_path || '',
            branch: metadata.branch || '',
            projectId: metadata.project_id || metadata.repo_id || 'default-workspace',
            agentId: req.hostedUser.agent_id || req.hostedUser.agent_connection?.agent_id || 'unknown-agent',
            agentInstanceId: req.hostedUser.agent_instance_id || req.hostedUser.agent_connection?.agent_instance_id || '',
            agentSurface: req.hostedUser.agent_connection?.agent_surface || 'mcp',
            modelProvider: metadata.model_provider || 'unknown',
            modelName: metadata.model_name || 'unknown',
            taskType: metadata.task_type || 'coding_task',
            operationType: metadata.operation_type || 'run',
            runId: metadata.run_id || '',
            sessionId: metadata.session_id || '',
            requestTokens: metadata.request_tokens || 0,
            responseTokens: metadata.response_tokens || 0,
            totalTokens: metadata.total_tokens || 0,
            costUsd: metadata.cost_usd || 0,
            insightFlags: response.reused ? ['reuse_hit'] : []
        });
        return res.json(response);
    });
});

module.exports = router;
