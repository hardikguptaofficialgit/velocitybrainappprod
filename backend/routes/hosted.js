const express = require('express');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const { db, COLLECTIONS, firebaseInitialized } = require('../config/firebase');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'velocitybrain-dev-secret';
const HOSTED_ACCESS_TTL_SECONDS = 3600;
const HOSTED_REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60;
const CORE_API_URL = (process.env.CORE_API_URL || '').replace(/\/+$/, '');
const skillsRoot = path.resolve(__dirname, '../../skills');

function hashApiKey(key) {
    return require('crypto').createHash('sha256').update(key).digest('hex');
}

async function validateApiKey(apiKey) {
    if (!apiKey || !firebaseInitialized) {
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
        expires_in: HOSTED_ACCESS_TTL_SECONDS
    };
}

function authenticateHosted(req, res, next) {
    try {
        const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
        if (!token) {
            return res.status(401).json({ detail: 'Not authenticated' });
        }

        const payload = jwt.verify(token, JWT_SECRET);
        if (payload.type !== 'access') {
            return res.status(401).json({ detail: 'Invalid token type' });
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
    if (!firebaseInitialized) {
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

        const keyInfo = await validateApiKey(payload.api_key);
        if (!keyInfo) {
            return res.status(401).json({ detail: 'API key no longer valid' });
        }

        return res.json(issueHostedTokens(keyInfo));
    } catch (error) {
        return res.status(401).json({ detail: 'Invalid or expired refresh token' });
    }
});

router.get('/usage', authenticateHosted, async (req, res) => {
    return proxyToCoreApi(req, res, async () => {
        const usage = await buildUsageSummary(req.hostedUser.user_id);
        return res.json(usage);
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
        const responseStyle = req.body?.response_style || 'normal';
        return res.json({
            answer: 'The internal brain does not currently contain sufficient data for this question.',
            confidence: 0,
            sources: [],
            reasoning_summary: 'Hosted compatibility mode returned a safe empty response because no dedicated retrieval backend is configured.',
            response_style: responseStyle
        });
    });
});

router.post('/run', authenticateHosted, async (req, res) => {
    return proxyToCoreApi(req, res, async () => {
        const task = req.body?.task || '';
        if (!task.trim()) {
            return res.status(400).json({ detail: 'Task is required' });
        }
        return res.json(buildFallbackRun(task, req.body?.metadata || {}));
    });
});

module.exports = router;
