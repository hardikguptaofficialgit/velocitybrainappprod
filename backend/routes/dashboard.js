const express = require('express');
const fs = require('fs');
const path = require('path');
const { db, COLLECTIONS, firebaseInitialized } = require('../config/firebase');
const { authenticate } = require('../middleware/auth');
const { aggregateObservability } = require('../utils/observability');

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
    const claudeHooks = detectFirstExisting([
        ['integrations', 'claude', 'hooks'],
        ['velocitybrain-open-source', 'integrations', 'claude']
    ]);
    const mcpRoot = detectFirstExisting([
        ['integrations', 'mcp'],
        ['velocitybrain-open-source', 'integrations', 'mcp']
    ]);
    const mcpRuntime = detectFirstExisting([
        ['src', 'mcp'],
        ['velocitybrain-open-source', 'src', 'velocitybrain_client', 'mcp']
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
        detectFirstExisting([
            ['integrations', 'mcp', 'claude-code', 'mcpServers.velocitybrain.json'],
            ['velocitybrain-open-source', 'integrations', 'mcp', 'mcpServers.velocitybrain.json']
        ]),
        detectFirstExisting([
            ['integrations', 'mcp', 'codex', 'config.velocitybrain.toml'],
            ['docs', 'CLIENT_INTEGRATIONS.md']
        ]),
        detectFirstExisting([
            ['integrations', 'mcp', 'openclaw', 'mcpServers.velocitybrain.json'],
            ['velocitybrain-open-source', 'integrations', 'openclaw', 'mcpServers.json']
        ]),
        detectFirstExisting([
            ['velocitybrain-open-source', 'integrations', 'hermes', 'config.velocitybrain.yaml'],
            ['docs', 'CLIENT_INTEGRATIONS.md']
        ]),
        detectFirstExisting([
            ['integrations', 'mcp', 'README.md'],
            ['docs', 'CLIENT_INTEGRATIONS.md']
        ])
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
                ['integrations', 'mcp', 'claude-code', 'mcpServers.velocitybrain.json'],
                ['velocitybrain-open-source', 'integrations', 'mcp', 'mcpServers.velocitybrain.json']
            ],
            workspaceCandidates: [
                ['.claude'],
                ['.claude', 'settings.json'],
                ['.claude', 'mcp.json'],
                ['.claude.json']
            ],
            extraCandidates: [
                ['integrations', 'claude', 'hooks', 'README.md'],
                ['velocitybrain-open-source', 'integrations', 'claude', 'setup.sh'],
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
                ['integrations', 'mcp', 'codex', 'config.velocitybrain.toml'],
                ['docs', 'CLIENT_INTEGRATIONS.md']
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
                ['integrations', 'mcp', 'README.md'],
                ['velocitybrain-open-source', 'integrations', 'mcp', 'mcpServers.velocitybrain.json']
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
            id: 'hermes',
            name: 'Hermes Agent',
            surface: 'MCP',
            setup: 'velocitybrain connect hermes --apply',
            summary: 'Native Hermes MCP wiring with a narrow Velocity Brain tool surface.',
            strengths: ['Native MCP support', 'Tool allowlisting', 'Good fit for chat and long-running agents'],
            templateCandidates: [
                ['velocitybrain-open-source', 'integrations', 'hermes', 'config.velocitybrain.yaml'],
                ['docs', 'CLIENT_INTEGRATIONS.md']
            ],
            workspaceCandidates: [
                ['.hermes', 'config.yaml']
            ],
            extraCandidates: [
                ['docs', 'CLIENT_INTEGRATIONS.md'],
                ['scripts', 'setup_mcp_plugin.ps1']
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
                ['integrations', 'mcp', 'openclaw', 'mcpServers.velocitybrain.json'],
                ['velocitybrain-open-source', 'integrations', 'openclaw', 'mcpServers.json']
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
                ['integrations', 'mcp', 'README.md'],
                ['velocitybrain-open-source', 'integrations', 'mcp', 'mcpServers.velocitybrain.json']
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
        ...(claudeHooks.exists ? listFiles(...claudeHooks.path.split('/')).map((item) => ({ label: item.name, path: item.path, type: 'hook' })) : []),
        ...(mcpRoot.exists ? listFiles(...mcpRoot.path.split('/')).map((item) => ({ label: item.name, path: item.path, type: item.type })) : []),
        ...(detectFile('velocitybrain-open-source', 'integrations', 'hermes').exists ? listFiles('velocitybrain-open-source', 'integrations', 'hermes').map((item) => ({ label: item.name, path: item.path, type: item.type })) : []),
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
        const allUsageData = allUsageSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const connectionSnapshot = firebaseInitialized
            ? await db.collection(COLLECTIONS.AGENT_CONNECTIONS).where('user_id', '==', userId).limit(500).get()
            : { docs: [] };
        const connectionDocs = connectionSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        const observability = aggregateObservability({
            logs: allUsageData,
            connections: connectionDocs,
            apiKeys: apiKeys.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
            now
        });

        // Filter to last 30 days in memory
        const usageLogsData = allUsageData.filter(log => new Date(log.created_at) >= thirtyDaysAgo);

        // Calculate hosted reuse and savings stats
        const totalApiCalls = observability.summary.totalCalls;
        const activeApiKeys = apiKeysData.filter(k => k.status === 'active').length;
        const savedTokens = observability.summary.totalSavedTokens;
        const savedCost = observability.summary.totalSavedUsd;
        const reuseHits = usageLogsData.filter(log => (log.reuse_hit_type || 'none') !== 'none');
        const averageSavedPercent = totalApiCalls > 0
            ? Math.round((reuseHits.reduce((sum, log) => sum + ((log.avoided_input_tokens || 0) > 0 ? 1 : 0), 0) / totalApiCalls) * 100)
            : 0;
        const reuseHitRate = totalApiCalls > 0
            ? Number(((reuseHits.length / totalApiCalls) * 100).toFixed(1))
            : 0;

        // Success rate
        const successfulCalls = usageLogsData.filter(
            log => log.status_code >= 200 && log.status_code < 300
        ).length;
        const successRate = observability.summary.successRate;

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

        // Usage by reuse hit type
        const usageByEndpoint = observability.endpointBreakdown;
        const topReusableRepos = observability.repoBreakdown
            .slice(0, 5)
            .map((repo) => ({
                repoId: repo.repoId,
                repoName: repo.repoName,
                branch: repo.branch,
                saved: repo.savedTokens,
                calls: repo.calls,
                agents: repo.agents
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
        const recentActivity = observability.recentActivity
            .slice(0, 10)
            .map((item) => ({
                type: item.status === 'failed' ? 'error' : 'success',
                description: item.description,
                timestamp: item.timestamp,
                status: item.status,
                reuseHitType: item.insightFlags?.includes('memory_hit') ? 'memory' : 'none',
                avoidedInputTokens: item.avoidedInputTokens || 0,
                estimatedCostSaved: item.costUsd || 0,
                estimatedLatencySavedMs: item.latencyMs || 0,
                repoId: item.repoId,
                branch: item.branch,
                modelName: item.modelName,
                agentId: item.agentId
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
                totalSavedTokens: savedTokens,
                apiCallsChange: 18.4,
                activeApiKeys,
                apiKeysChange: 0,
                documentsProcessed: Number(savedCost.toFixed(6)),
                totalSavedUsd: Number(savedCost.toFixed(6)),
                documentsChange: 11.2,
                successRate: reuseHitRate,
                successRateChange: 6.8,
                averageSavedPercent,
                requestSuccessRate: Number(successRate),
                totalTokens: observability.summary.totalTokens,
                connectedAgents: observability.summary.uniqueAgents,
                connectedRepos: observability.summary.uniqueRepos
            },
            apiCallsOverTime,
            hourlyDistribution,
            usageByEndpoint,
            recentActivity,
            topReusableRepos,
            modelBreakdown: observability.modelBreakdown,
            agentBreakdown: observability.agentBreakdown,
            anomalies: observability.anomalies,
            insights: observability.insights
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
        const userId = req.user.id;

        let connectionDocs = [];
        let apiKeyDocs = [];
        let usageDocs = [];
        if (firebaseInitialized) {
            const snapshot = await db.collection(COLLECTIONS.AGENT_CONNECTIONS)
                .where('user_id', '==', userId)
                .limit(500)
                .get();
            connectionDocs = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data()
            }));

            const apiKeysSnapshot = await db.collection(COLLECTIONS.API_KEYS)
                .where('user_id', '==', userId)
                .limit(200)
                .get();
            apiKeyDocs = apiKeysSnapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data()
            }));

            const usageSnapshot = await db.collection(COLLECTIONS.USAGE_LOGS)
                .where('user_id', '==', userId)
                .limit(10000)
                .get();
            usageDocs = usageSnapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data()
            }));
        }

        const observability = aggregateObservability({
            logs: usageDocs,
            connections: connectionDocs,
            apiKeys: apiKeyDocs
        });
        const usageByAgent = new Map(observability.agentBreakdown.map((item) => [item.agentId, item]));
        const recentByAgent = new Map();
        observability.recentActivity.forEach((item) => {
            const list = recentByAgent.get(item.agentId) || [];
            if (list.length < 5) {
                list.push(item);
            }
            recentByAgent.set(item.agentId, list);
        });

        const apiKeyMap = new Map(
            apiKeyDocs.map((key) => [
                key.id,
                {
                    id: key.id,
                    name: key.name || 'Unnamed key',
                    keyPrefix: key.key_prefix || '',
                    status: key.status || 'unknown',
                    createdAt: key.created_at || null,
                    lastUsedAt: key.last_used_at || null
                }
            ])
        );

        const connectionsByAgent = new Map();
        connectionDocs.forEach((record) => {
            const list = connectionsByAgent.get(record.agent_id) || [];
            list.push(record);
            connectionsByAgent.set(record.agent_id, list);
        });

        const enrichedAgents = payload.agents.map((agent) => {
            const connections = (connectionsByAgent.get(agent.id) || [])
                .sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0));
            const latestConnection = connections[0] || null;
            const connectedRepos = connections.map((connection) => ({
                id: connection.id,
                repoId: connection.repo_id || 'default-workspace',
                repoName: connection.repo_name || connection.repo_id || 'default-workspace',
                repoPath: connection.repo_path || '',
                status: connection.status || 'connected',
                updatedAt: connection.updated_at || connection.created_at || null,
                metadata: connection.metadata || {},
                apiKey: connection.api_key_id ? (apiKeyMap.get(connection.api_key_id) || {
                    id: connection.api_key_id,
                    name: 'Unknown key',
                    keyPrefix: '',
                    status: 'unknown'
                }) : null
            }));

            return {
                ...agent,
                accountConnected: connections.length > 0,
                connectionCount: connections.length,
                latestConnectionAt: latestConnection?.updated_at || latestConnection?.created_at || null,
                observability: usageByAgent.get(agent.id) || {
                    calls: 0,
                    totalTokens: 0,
                    costUsd: 0,
                    avgLatencyMs: 0,
                    repoCount: 0,
                    modelCount: 0,
                    taskTypes: []
                },
                connectedRepos,
                recentRuns: recentByAgent.get(agent.id) || [],
                apiKeys: Array.from(new Map(
                    connections
                        .filter((connection) => connection.api_key_id)
                        .map((connection) => {
                            const key = apiKeyMap.get(connection.api_key_id) || {
                                id: connection.api_key_id,
                                name: 'Unknown key',
                                keyPrefix: '',
                                status: 'unknown'
                            };
                            return [key.id, key];
                        })
                ).values())
            };
        });

        const allRepos = Object.values(enrichedAgents.reduce((acc, agent) => {
            (agent.connectedRepos || []).forEach((repo) => {
                const key = `${repo.repoId}:${repo.repoPath}`;
                if (!acc[key] || new Date(repo.updatedAt || 0) > new Date(acc[key].updatedAt || 0)) {
                    acc[key] = repo;
                }
            });
            return acc;
        }, {}));

        res.json({
            success: true,
            workspace: {
                ...payload.workspace,
                connectedAgentCount: enrichedAgents.filter((agent) => agent.accountConnected).length,
                connectedRepoCount: allRepos.length
            },
            agents: enrichedAgents,
            workspaceFiles: payload.workspaceFiles,
            apiKeys: apiKeyDocs.map((key) => ({
                id: key.id,
                name: key.name || 'Unnamed key',
                keyPrefix: key.key_prefix || '',
                status: key.status || 'unknown',
                createdAt: key.created_at || null,
                lastUsedAt: key.last_used_at || null
            })),
            connections: {
                repos: allRepos.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0)),
                recent: connectionDocs
                    .sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0))
                    .slice(0, 20)
            }
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
