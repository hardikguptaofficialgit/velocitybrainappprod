const express = require('express');
const fs = require('fs');
const path = require('path');
const { db, COLLECTIONS } = require('../config/firebase');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const repoRoot = path.resolve(__dirname, '../..');

const detectFile = (...segments) => {
    const target = path.join(repoRoot, ...segments);
    return {
        exists: fs.existsSync(target),
        path: path.relative(repoRoot, target).replace(/\\/g, '/')
    };
};

const detectFirstExisting = (candidateSets = []) => {
    for (const segments of candidateSets) {
        const result = detectFile(...segments);
        if (result.exists) {
            return result;
        }
    }

    const fallback = candidateSets[0] || [];
    return {
        exists: false,
        path: fallback.length ? path.join(...fallback).replace(/\\/g, '/') : ''
    };
};

const listFiles = (...segments) => {
    const target = path.join(repoRoot, ...segments);
    if (!fs.existsSync(target)) {
        return [];
    }

    return fs.readdirSync(target, { withFileTypes: true }).map((entry) => ({
        name: entry.name,
        type: entry.isDirectory() ? 'directory' : 'file',
        path: path.relative(repoRoot, path.join(target, entry.name)).replace(/\\/g, '/')
    }));
};

const buildAgentRuntimeStatus = () => {
    const agentsMd = detectFile('AGENTS.md');
    const agentsDir = detectFile('.agents');
    const claudeHooks = detectFile('integrations', 'claude', 'hooks');
    const mcpRoot = detectFile('integrations', 'mcp');
    const mcpRuntime = detectFirstExisting([
        ['src', 'mcp'],
        ['velocitybrain-open-source', 'src', 'mcp']
    ]);
    const setupScript = detectFile('scripts', 'setup_mcp_plugin.ps1');
    const verifyScript = detectFile('scripts', 'verify_mcp_integrations.ps1');
    const installClaudeHooksScript = detectFile('scripts', 'install_claude_caveman_hooks.ps1');
    const integrationDocs = [
        detectFile('docs', 'CLIENT_INTEGRATIONS.md'),
        detectFile('docs', 'AGENT_INTEGRATIONS.md'),
        detectFile('docs', 'TOKEN_EFFICIENCY.md')
    ];
    const templateFiles = [
        detectFile('integrations', 'mcp', 'claude-code', 'mcpServers.velocitybrain.json'),
        detectFile('integrations', 'mcp', 'codex', 'config.velocitybrain.toml'),
        detectFile('integrations', 'mcp', 'openclaw', 'mcpServers.velocitybrain.json'),
        detectFile('integrations', 'mcp', 'README.md')
    ];

    const agentDefinitions = [
        {
            id: 'claude-code',
            name: 'Claude Code',
            surface: 'MCP',
            setup: 'claude mcp add velocitybrain -- velocitybrain serve mcp',
            summary: 'Repo-aware coding with memory lookup before action.',
            strengths: ['Repo-aware coding', 'Fast memory retrieval', 'Great planning handoff'],
            templateCandidates: [
                ['integrations', 'mcp', 'claude-code', 'mcpServers.velocitybrain.json']
            ],
            workspaceCandidates: [
                ['.claude'],
                ['.claude', 'settings.json'],
                ['.claude', 'mcp.json'],
                ['.claude.json']
            ],
            extraCandidates: [
                ['integrations', 'claude', 'hooks', 'README.md'],
                ['scripts', 'install_claude_caveman_hooks.ps1']
            ]
        },
        {
            id: 'codex',
            name: 'OpenAI Codex',
            surface: 'MCP',
            setup: 'codex mcp add velocitybrain -- velocitybrain serve mcp',
            summary: 'Strong fit for edit-heavy workflows that need prepared context.',
            strengths: ['Automatic repo memory lookups', 'Background retrieval before action', 'Token-efficient coding'],
            templateCandidates: [
                ['integrations', 'mcp', 'codex', 'config.velocitybrain.toml']
            ],
            workspaceCandidates: [
                ['.codex'],
                ['.codex', 'config.toml'],
                ['.codex', 'config.json']
            ],
            extraCandidates: [
                ['AGENTS.md'],
                ['scripts', 'setup_mcp_plugin.ps1']
            ]
        },
        {
            id: 'gemini-cli',
            name: 'Gemini CLI',
            surface: 'MCP',
            setup: 'velocitybrain serve mcp',
            summary: 'Good for mixed planning, research, and execution flows.',
            strengths: ['Cross-tool interoperability', 'Simple JSON config', 'Good for mixed task flows'],
            templateCandidates: [
                ['integrations', 'mcp', 'README.md']
            ],
            workspaceCandidates: [
                ['.gemini'],
                ['.gemini', 'settings.json'],
                ['.gemini', 'mcp.json'],
                ['.gemini.json']
            ],
            extraCandidates: [
                ['docs', 'CLIENT_INTEGRATIONS.md']
            ]
        },
        {
            id: 'openclaw',
            name: 'OpenClaw',
            surface: 'MCP',
            setup: 'velocitybrain openclaw',
            summary: 'Exports an OpenClaw-ready profile and capability summary.',
            strengths: ['Profile export', 'Capability discovery endpoints', 'Smoke-flow ready'],
            templateCandidates: [
                ['integrations', 'mcp', 'openclaw', 'mcpServers.velocitybrain.json']
            ],
            workspaceCandidates: [
                ['.openclaw'],
                ['.openclaw', 'mcp.json'],
                ['.openclaw', 'config.json']
            ],
            extraCandidates: [
                ['identity.spec.json'],
                ['scripts', 'verify_mcp_integrations.ps1']
            ]
        },
        {
            id: 'cline',
            name: 'Cline',
            surface: 'MCP',
            setup: 'velocitybrain serve mcp',
            summary: 'Lightweight MCP wiring with the same shared memory layer.',
            strengths: ['Simple MCP wiring', 'Shared tool surface', 'Same security defaults'],
            templateCandidates: [
                ['integrations', 'mcp', 'README.md']
            ],
            workspaceCandidates: [
                ['.cline'],
                ['.cline', 'mcp.json'],
                ['.cline', 'config.json']
            ],
            extraCandidates: [
                ['docs', 'CLIENT_INTEGRATIONS.md']
            ]
        }
    ];

    const supportedAgents = agentDefinitions.map((agent) => {
        const template = detectFirstExisting(agent.templateCandidates);
        const workspaceConfig = detectFirstExisting(agent.workspaceCandidates);
        const extras = (agent.extraCandidates || []).map((candidate) => detectFirstExisting([candidate]));
        const templateReady = Boolean(template?.exists);
        const workspaceConfigured = Boolean(workspaceConfig?.exists);
        const extraReadyCount = extras.filter((item) => item?.exists).length;
        const readinessScore = [templateReady, workspaceConfigured].filter(Boolean).length + extraReadyCount;

        let status = 'Not detected';
        if (workspaceConfigured) {
            status = 'Workspace config found';
        } else if (templateReady) {
            status = 'Template ready';
        }

        return {
            ...agent,
            template,
            workspaceConfig,
            extras,
            status,
            templateReady,
            workspaceConfigured,
            extraReadyCount,
            readinessScore
        };
    });

    const workspaceFiles = [
        ...(agentsMd.exists ? [{ label: 'AGENTS.md', path: agentsMd.path, type: 'instruction' }] : []),
        ...(claudeHooks.exists ? listFiles('integrations', 'claude', 'hooks').map((item) => ({ label: item.name, path: item.path, type: 'hook' })) : []),
        ...(mcpRoot.exists ? listFiles('integrations', 'mcp').map((item) => ({ label: item.name, path: item.path, type: item.type })) : []),
        ...(setupScript.exists ? [{ label: 'setup_mcp_plugin.ps1', path: setupScript.path, type: 'script' }] : []),
        ...(verifyScript.exists ? [{ label: 'verify_mcp_integrations.ps1', path: verifyScript.path, type: 'script' }] : []),
        ...(installClaudeHooksScript.exists ? [{ label: 'install_claude_caveman_hooks.ps1', path: installClaudeHooksScript.path, type: 'script' }] : []),
        ...(agentsDir.exists ? listFiles('.agents').map((item) => ({ label: item.name, path: item.path, type: item.type })) : [])
    ];

    return {
        workspace: {
            repoRoot: repoRoot,
            agentsMdPresent: agentsMd.exists,
            agentsDirectoryPresent: agentsDir.exists,
            claudeHooksPresent: claudeHooks.exists,
            mcpRuntimePresent: mcpRuntime.exists,
            mcpTemplatesPresent: templateFiles.filter((item) => item.exists).length,
            integrationDocsPresent: integrationDocs.filter((item) => item.exists).length,
            setupScriptsPresent: [setupScript, verifyScript, installClaudeHooksScript].filter((item) => item.exists).length,
            workspaceConfigCount: supportedAgents.filter((agent) => agent.workspaceConfigured).length,
            readyAgentCount: supportedAgents.filter((agent) => agent.templateReady).length
        },
        agents: supportedAgents,
        workspaceFiles
    };
};

// Dashboard stats
router.get('/stats', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        console.info('[DashboardRoute] Stats request received', {
            userId,
            email: req.user.email
        });
        const now = new Date();
        const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

        // Get API keys count (single field query - no composite index needed)
        const apiKeys = await db.collection(COLLECTIONS.API_KEYS).where('user_id', '==', userId).get();
        const apiKeysData = apiKeys.docs.map(doc => doc.data());

        // Get all usage logs for user (single field query - no composite index needed)
        const allUsageSnapshot = await db.collection(COLLECTIONS.USAGE_LOGS)
            .where('user_id', '==', userId)
            .limit(10000)
            .get();
        const allUsageData = allUsageSnapshot.docs.map(doc => doc.data());

        // Filter to last 30 days in memory
        const usageLogsData = allUsageData.filter(log => new Date(log.created_at) >= thirtyDaysAgo);

        // Calculate stats
        const totalApiCalls = usageLogsData.length;
        const activeApiKeys = apiKeysData.filter(k => k.status === 'active').length;
        
        // Documents processed (ingest endpoint calls)
        const documentsProcessed = usageLogsData.filter(
            log => log.endpoint.includes('ingest')
        ).length;

        // Success rate
        const successfulCalls = usageLogsData.filter(
            log => log.status_code >= 200 && log.status_code < 300
        ).length;
        const successRate = totalApiCalls > 0 
            ? ((successfulCalls / totalApiCalls) * 100).toFixed(1)
            : 0;

        // API calls over time (last 7 days) - filter in memory
        const apiCallsOverTime = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            
            const dayStart = new Date(date);
            dayStart.setHours(0, 0, 0, 0);
            const dayEnd = new Date(date);
            dayEnd.setHours(23, 59, 59, 999);

            const dayLogsCount = allUsageData.filter(log => {
                const logDate = new Date(log.created_at);
                return logDate >= dayStart && logDate <= dayEnd;
            }).length;

            apiCallsOverTime.push({
                date: dateStr,
                calls: dayLogsCount
            });
        }

        // Usage by endpoint
        const endpointStats = {};
        usageLogsData.forEach(log => {
            const endpoint = log.endpoint.split('/').pop() || log.endpoint;
            endpointStats[endpoint] = (endpointStats[endpoint] || 0) + 1;
        });

        const usageByEndpoint = Object.entries(endpointStats).map(([endpoint, calls]) => ({
            endpoint,
            calls
        }));

        const hourlyDistribution = Array.from({ length: 24 }, (_, hour) => ({
            hour: `${String(hour).padStart(2, '0')}:00`,
            calls: 0
        }));

        usageLogsData.forEach((log) => {
            const hour = new Date(log.created_at).getHours();
            hourlyDistribution[hour].calls += 1;
        });

        // Recent activity - sort in memory
        const recentActivity = allUsageData
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .slice(0, 10)
            .map(log => ({
                type: log.status_code >= 400 ? 'error' : 'success',
                description: `${log.method} ${log.endpoint}`,
                timestamp: log.created_at,
                status: log.status_code >= 400 ? 'failed' : 'completed'
            }));

        console.info('[DashboardRoute] Stats response ready', {
            userId,
            totalApiCalls,
            activeApiKeys,
            usageLogCount: usageLogsData.length,
            recentActivityCount: recentActivity.length
        });

        res.json({
            success: true,
            stats: {
                totalApiCalls,
                apiCallsChange: 12.5,
                activeApiKeys,
                apiKeysChange: 0,
                documentsProcessed,
                documentsChange: 8.3,
                successRate: parseFloat(successRate),
                successRateChange: -0.2
            },
            apiCallsOverTime,
            hourlyDistribution,
            usageByEndpoint,
            recentActivity
        });
    } catch (error) {
        console.error('[DashboardRoute] Dashboard stats error', {
            userId: req.user?.id,
            error
        });
        res.status(500).json({ success: false, message: error.message || 'Failed to get dashboard stats' });
    }
});

router.get('/agents', authenticate, async (req, res) => {
    try {
        const payload = buildAgentRuntimeStatus();

        res.json({
            success: true,
            ...payload
        });
    } catch (error) {
        console.error('[DashboardRoute] Agent runtime status error', {
            userId: req.user?.id,
            error
        });
        res.status(500).json({ success: false, message: error.message || 'Failed to get agent runtime status' });
    }
});

module.exports = router;
