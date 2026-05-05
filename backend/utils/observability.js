function asDate(value) {
    const parsed = new Date(value || 0);
    return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed;
}

function safeNumber(value, fallback = 0) {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
}

function clampList(values, limit = 10) {
    return values.slice(0, Math.max(0, limit));
}

function buildDescription(log) {
    const taskType = log.task_type || log.operation_type;
    if (taskType && log.repo_name) {
        return `${taskType} on ${log.repo_name}`;
    }
    if (taskType) {
        return taskType;
    }
    return `${log.method || 'POST'} ${log.endpoint || '/unknown'}`;
}

function collectInsightFlags(log) {
    if (Array.isArray(log.insight_flags)) {
        return log.insight_flags.filter(Boolean);
    }
    if (typeof log.insight_flags === 'string' && log.insight_flags.trim()) {
        return log.insight_flags.split(',').map((item) => item.trim()).filter(Boolean);
    }
    return [];
}

function aggregateObservability({
    logs = [],
    connections = [],
    apiKeys = [],
    now = new Date()
} = {}) {
    const activeApiKeys = apiKeys.filter((key) => (key.status || 'active') === 'active');
    const totalCalls = logs.length;
    const totalSavedTokens = logs.reduce((sum, log) => sum + safeNumber(log.avoided_input_tokens), 0);
    const totalSavedUsd = logs.reduce((sum, log) => sum + safeNumber(log.estimated_cost_saved), 0);
    const totalTokens = logs.reduce((sum, log) => sum + safeNumber(log.total_tokens, safeNumber(log.request_tokens) + safeNumber(log.response_tokens)), 0);
    const totalCostUsd = logs.reduce((sum, log) => sum + safeNumber(log.cost_usd), 0);
    const avgLatency = totalCalls > 0
        ? Math.round(logs.reduce((sum, log) => sum + safeNumber(log.latency_ms, safeNumber(log.response_time_ms)), 0) / totalCalls)
        : 0;

    const errorCount = logs.filter((log) => safeNumber(log.status_code, 200) >= 400 || log.status === 'error').length;
    const successRate = totalCalls > 0 ? Number((((totalCalls - errorCount) / totalCalls) * 100).toFixed(1)) : 100;
    const errorRate = totalCalls > 0 ? Number(((errorCount / totalCalls) * 100).toFixed(1)) : 0;
    const reuseHitCount = logs.filter((log) => (log.reuse_hit_type || 'none') !== 'none').length;
    const reuseHitRate = totalCalls > 0 ? Number(((reuseHitCount / totalCalls) * 100).toFixed(1)) : 0;

    const agentMap = new Map();
    const modelMap = new Map();
    const repoMap = new Map();
    const taskMap = new Map();
    const endpointMap = new Map();
    const timeline = [];
    const anomalyEvents = [];
    const repeatedWasteMap = new Map();

    for (const log of logs) {
        const latency = safeNumber(log.latency_ms, safeNumber(log.response_time_ms));
        const agentId = log.agent_id || log.metadata?.agent_id || 'unknown-agent';
        const repoId = log.repo_id || 'default-workspace';
        const repoName = log.repo_name || repoId;
        const branch = log.branch || log.metadata?.branch || 'unknown';
        const modelProvider = log.model_provider || 'unknown';
        const modelName = log.model_name || 'unknown';
        const modelKey = `${modelProvider}:${modelName}`;
        const taskType = log.task_type || log.operation_type || 'unknown';
        const endpoint = log.endpoint || '/unknown';
        const savedTokens = safeNumber(log.avoided_input_tokens);
        const costUsd = safeNumber(log.cost_usd);
        const totalTokensForLog = safeNumber(log.total_tokens, safeNumber(log.request_tokens) + safeNumber(log.response_tokens));
        const timestamp = log.created_at || now.toISOString();
        const flags = collectInsightFlags(log);

        endpointMap.set(endpoint, (endpointMap.get(endpoint) || 0) + 1);

        const repeatedWasteKey = `${agentId}:${repoId}:${taskType}`;
        if (savedTokens <= 0) {
            repeatedWasteMap.set(repeatedWasteKey, (repeatedWasteMap.get(repeatedWasteKey) || 0) + 1);
        }

        if (!agentMap.has(agentId)) {
            agentMap.set(agentId, {
                agentId,
                calls: 0,
                totalTokens: 0,
                costUsd: 0,
                avgLatencyMs: 0,
                latencySum: 0,
                repoIds: new Set(),
                modelKeys: new Set(),
                taskTypes: new Set(),
                lastSeen: null
            });
        }
        const agent = agentMap.get(agentId);
        agent.calls += 1;
        agent.totalTokens += totalTokensForLog;
        agent.costUsd += costUsd;
        agent.latencySum += latency;
        agent.repoIds.add(repoId);
        agent.modelKeys.add(modelKey);
        agent.taskTypes.add(taskType);
        agent.lastSeen = !agent.lastSeen || asDate(timestamp) > asDate(agent.lastSeen) ? timestamp : agent.lastSeen;

        if (!modelMap.has(modelKey)) {
            modelMap.set(modelKey, {
                modelKey,
                provider: modelProvider,
                model: modelName,
                calls: 0,
                totalTokens: 0,
                costUsd: 0,
                latencySum: 0
            });
        }
        const model = modelMap.get(modelKey);
        model.calls += 1;
        model.totalTokens += totalTokensForLog;
        model.costUsd += costUsd;
        model.latencySum += latency;

        const repoKey = `${repoId}:${branch}`;
        if (!repoMap.has(repoKey)) {
            repoMap.set(repoKey, {
                repoId,
                repoName,
                repoPath: log.repo_path || '',
                branch,
                calls: 0,
                savedTokens: 0,
                savedCost: 0,
                totalTokens: 0,
                agents: new Set(),
                taskTypes: new Set(),
                lastSeen: null
            });
        }
        const repo = repoMap.get(repoKey);
        repo.calls += 1;
        repo.savedTokens += savedTokens;
        repo.savedCost += safeNumber(log.estimated_cost_saved);
        repo.totalTokens += totalTokensForLog;
        repo.agents.add(agentId);
        repo.taskTypes.add(taskType);
        repo.lastSeen = !repo.lastSeen || asDate(timestamp) > asDate(repo.lastSeen) ? timestamp : repo.lastSeen;

        if (!taskMap.has(taskType)) {
            taskMap.set(taskType, {
                taskType,
                calls: 0,
                costUsd: 0,
                totalTokens: 0
            });
        }
        const task = taskMap.get(taskType);
        task.calls += 1;
        task.costUsd += costUsd;
        task.totalTokens += totalTokensForLog;

        if (latency > 4000 || flags.includes('anomaly')) {
            anomalyEvents.push({
                type: 'latency_spike',
                severity: latency > 7000 ? 'high' : 'medium',
                agentId,
                repoId,
                model: modelKey,
                value: latency,
                timestamp,
                message: `Latency spike detected for ${agentId} on ${repoName}`
            });
        }
        if (safeNumber(log.status_code, 200) >= 500 || flags.includes('repeated_failure')) {
            anomalyEvents.push({
                type: 'failure_cluster',
                severity: 'high',
                agentId,
                repoId,
                model: modelKey,
                value: safeNumber(log.status_code, 500),
                timestamp,
                message: `Repeated failure detected for ${agentId} on ${repoName}`
            });
        }

        timeline.push({
            id: log.run_id || log.session_id || `${timestamp}:${endpoint}:${agentId}`,
            timestamp,
            status: safeNumber(log.status_code, 200) >= 400 || log.status === 'error' ? 'failed' : 'completed',
            description: buildDescription(log),
            endpoint,
            agentId,
            agentSurface: log.agent_surface || 'unknown',
            modelProvider,
            modelName,
            repoId,
            repoName,
            branch,
            taskType,
            operationType: log.operation_type || null,
            avoidedInputTokens: savedTokens,
            totalTokens: totalTokensForLog,
            costUsd,
            latencyMs: latency,
            insightFlags: flags
        });
    }

    repeatedWasteMap.forEach((count, key) => {
        if (count >= 3) {
            const [agentId, repoId, taskType] = key.split(':');
            anomalyEvents.push({
                type: 'repeated_context_waste',
                severity: 'medium',
                agentId,
                repoId,
                taskType,
                value: count,
                timestamp: now.toISOString(),
                message: `${agentId} repeated ${taskType} on ${repoId} without reuse savings ${count} times`
            });
        }
    });

    const agentBreakdown = Array.from(agentMap.values())
        .map((agent) => ({
            agentId: agent.agentId,
            calls: agent.calls,
            totalTokens: agent.totalTokens,
            costUsd: Number(agent.costUsd.toFixed(6)),
            avgLatencyMs: agent.calls > 0 ? Math.round(agent.latencySum / agent.calls) : 0,
            repoCount: agent.repoIds.size,
            modelCount: agent.modelKeys.size,
            taskTypes: Array.from(agent.taskTypes).sort(),
            lastSeen: agent.lastSeen
        }))
        .sort((a, b) => b.calls - a.calls);

    const modelBreakdown = Array.from(modelMap.values())
        .map((model) => ({
            modelKey: model.modelKey,
            provider: model.provider,
            model: model.model,
            calls: model.calls,
            totalTokens: model.totalTokens,
            costUsd: Number(model.costUsd.toFixed(6)),
            avgLatencyMs: model.calls > 0 ? Math.round(model.latencySum / model.calls) : 0
        }))
        .sort((a, b) => b.calls - a.calls);

    const repoBreakdown = Array.from(repoMap.values())
        .map((repo) => ({
            repoId: repo.repoId,
            repoName: repo.repoName,
            repoPath: repo.repoPath,
            branch: repo.branch,
            calls: repo.calls,
            savedTokens: repo.savedTokens,
            savedCost: Number(repo.savedCost.toFixed(6)),
            totalTokens: repo.totalTokens,
            agents: Array.from(repo.agents).sort(),
            taskTypes: Array.from(repo.taskTypes).sort(),
            lastSeen: repo.lastSeen
        }))
        .sort((a, b) => b.calls - a.calls);

    const taskBreakdown = Array.from(taskMap.values())
        .map((task) => ({
            taskType: task.taskType,
            calls: task.calls,
            costUsd: Number(task.costUsd.toFixed(6)),
            totalTokens: task.totalTokens
        }))
        .sort((a, b) => b.calls - a.calls);

    const endpointBreakdown = Array.from(endpointMap.entries())
        .map(([endpoint, calls]) => ({
            endpoint,
            calls,
            percentage: totalCalls > 0 ? Math.round((calls / totalCalls) * 100) : 0
        }))
        .sort((a, b) => b.calls - a.calls);

    const sortedTimeline = timeline.sort((a, b) => asDate(b.timestamp) - asDate(a.timestamp));
    const anomalies = clampList(
        anomalyEvents.sort((a, b) => asDate(b.timestamp) - asDate(a.timestamp)),
        12
    );

    const insights = [];
    if (reuseHitRate < 25 && totalCalls >= 5) {
        insights.push({
            type: 'optimization',
            title: 'Low reuse hit rate',
            body: 'Velocity Brain is seeing limited memory reuse. Capture more repo/task metadata and route repeat tasks through run/query flows with stable repo identifiers.'
        });
    }
    if (modelBreakdown[0]?.costUsd > 0 && modelBreakdown.length > 1) {
        const dominant = modelBreakdown[0];
        if (dominant.costUsd > totalCostUsd * 0.75) {
            insights.push({
                type: 'cost',
                title: `Model concentration on ${dominant.model}`,
                body: `${dominant.model} is driving most spend. Review whether lighter models can handle repetitive coding tasks.`
            });
        }
    }
    if (anomalies.some((item) => item.type === 'repeated_context_waste')) {
        insights.push({
            type: 'efficiency',
            title: 'Repeated context waste detected',
            body: 'Some agents are repeating coding tasks without reuse savings. Consider stronger run metadata, repo scoping, or cached artifact writeback.'
        });
    }

    const connectionSummary = {
        totalConnections: connections.length,
        activeConnections: connections.filter((item) => (item.status || 'connected') === 'connected').length,
        uniqueAgents: new Set(connections.map((item) => item.agent_id).filter(Boolean)).size,
        uniqueRepos: new Set(connections.map((item) => item.repo_id).filter(Boolean)).size
    };

    return {
        summary: {
            totalCalls,
            totalSavedTokens,
            totalSavedUsd: Number(totalSavedUsd.toFixed(6)),
            totalTokens,
            totalCostUsd: Number(totalCostUsd.toFixed(6)),
            avgLatency,
            successRate,
            errorRate,
            reuseHitRate,
            activeApiKeys: activeApiKeys.length,
            uniqueAgents: agentBreakdown.length,
            uniqueRepos: new Set(repoBreakdown.map((repo) => repo.repoId)).size,
            connectionSummary
        },
        endpointBreakdown,
        modelBreakdown,
        agentBreakdown,
        repoBreakdown,
        taskBreakdown,
        recentActivity: clampList(sortedTimeline, 20),
        timeline: clampList(sortedTimeline, 100),
        anomalies,
        insights
    };
}

module.exports = {
    aggregateObservability
};
