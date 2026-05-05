const express = require('express');
const { db, COLLECTIONS } = require('../config/firebase');
const { authenticate } = require('../middleware/auth');
const { ACCESS_POLICY } = require('../config/access');
const { aggregateObservability } = require('../utils/observability');

const router = express.Router();
const internalUsageSecret = process.env.INTERNAL_USAGE_SECRET;

const getHourBucket = (isoDate) => {
    const date = new Date(isoDate);
    const hour = String(date.getHours()).padStart(2, '0');
    return `${hour}:00`;
};

const formatResetIn = (now) => {
    const nextReset = new Date(now);
    nextReset.setHours(24, 0, 0, 0);
    const diffMs = nextReset - now;
    const hours = Math.floor(diffMs / (60 * 60 * 1000));
    const minutes = Math.floor((diffMs % (60 * 60 * 1000)) / (60 * 1000));
    return `${hours}h ${minutes}m`;
};

// Log usage (called by core API)
router.post('/log', async (req, res) => {
    try {
        const providedSecret = req.headers['x-internal-usage-secret'];
        if (!internalUsageSecret || providedSecret !== internalUsageSecret) {
            return res.status(401).json({ success: false, message: 'Unauthorized usage log request' });
        }

        const {
            apiKeyId,
            userId,
            endpoint,
            method,
            statusCode,
            responseTimeMs,
            requestSize,
            responseSize,
            reuseHitType,
            artifactsUsed,
            avoidedInputTokens,
            estimatedCostSaved,
            estimatedLatencySavedMs,
            repoId
        } = req.body;

        const now = new Date().toISOString();
        await db.collection(COLLECTIONS.USAGE_LOGS).add({
            api_key_id: apiKeyId,
            user_id: userId,
            endpoint,
            method,
            status_code: statusCode,
            response_time_ms: responseTimeMs,
            request_size: requestSize || 0,
            response_size: responseSize || 0,
            reuse_hit_type: reuseHitType || 'none',
            artifacts_used: artifactsUsed || 0,
            avoided_input_tokens: avoidedInputTokens || 0,
            estimated_cost_saved: estimatedCostSaved || 0,
            estimated_latency_saved_ms: estimatedLatencySavedMs || 0,
            repo_id: repoId || 'default-workspace',
            created_at: now
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Usage log error:', error);
        res.status(500).json({ success: false, message: 'Failed to log usage' });
    }
});

// Get usage stats
router.get('/', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const now = new Date();
        const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);

        const [allUsageSnapshot, connectionSnapshot, apiKeysSnapshot] = await Promise.all([
            db.collection(COLLECTIONS.USAGE_LOGS)
                .where('user_id', '==', userId)
                .limit(10000)
                .get(),
            db.collection(COLLECTIONS.AGENT_CONNECTIONS)
                .where('user_id', '==', userId)
                .limit(500)
                .get(),
            db.collection(COLLECTIONS.API_KEYS)
                .where('user_id', '==', userId)
                .limit(200)
                .get()
        ]);
        const allUsageData = allUsageSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const connections = connectionSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const apiKeys = apiKeysSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const observability = aggregateObservability({ logs: allUsageData, connections, apiKeys, now });

        // Filter in memory
        const dailyUsage = allUsageData.filter(log => new Date(log.created_at) >= oneDayAgo);

        // Calculate stats
        const totalCalls = observability.summary.totalCalls;
        const callsToday = dailyUsage.length;
        const avgResponseTime = observability.summary.avgLatency;
        const savedTokensToday = dailyUsage.reduce((sum, log) => sum + (log.avoided_input_tokens || 0), 0);
        const savedCostToday = dailyUsage.reduce((sum, log) => sum + (log.estimated_cost_saved || 0), 0);
        const reuseHitsToday = dailyUsage.filter(log => (log.reuse_hit_type || 'none') !== 'none').length;

        // Real hourly distribution for the last 24 hours
        const hourlyBuckets = {};
        dailyUsage.forEach(log => {
            const bucket = getHourBucket(log.created_at);
            hourlyBuckets[bucket] = (hourlyBuckets[bucket] || 0) + 1;
        });

        const hourlyDistribution = Array.from({ length: 24 }, (_, hour) => {
            const label = `${String(hour).padStart(2, '0')}:00`;
            return {
                hour: label,
                calls: hourlyBuckets[label] || 0
            };
        });

        const peakHourEntry = hourlyDistribution.reduce((peak, entry) => (
            entry.calls > peak.calls ? entry : peak
        ), { hour: '00:00', calls: 0 });

        const avgPerMin = callsToday > 0
            ? (callsToday / Math.max(1, ((now - oneDayAgo) / (60 * 1000)))).toFixed(2)
            : '0.00';

        // Daily trend (last 7 days) - filter in memory
        const dailyTrend = [];
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

            dailyTrend.push({
                date: dateStr,
                calls: dayLogsCount
            });
        }

        res.json({
            success: true,
            stats: {
                totalCalls,
                callsToday,
                avgResponseTime,
                successRate: observability.summary.successRate,
                errorRate: observability.summary.errorRate,
                remainingQuota: Math.max(0, ACCESS_POLICY.standardQuotas.daily - callsToday),
                quotaLimit: ACCESS_POLICY.standardQuotas.daily,
                peakHour: peakHourEntry.calls > 0 ? peakHourEntry.hour : 'N/A',
                avgPerMin,
                resetIn: formatResetIn(now),
                savedTokensToday,
                savedCostToday: Number(savedCostToday.toFixed(6)),
                reuseHitRate: dailyUsage.length > 0 ? Number(((reuseHitsToday / dailyUsage.length) * 100).toFixed(1)) : 0,
                accessMessage: ACCESS_POLICY.publicAccessMessage,
                totalTokens: observability.summary.totalTokens,
                totalCostUsd: observability.summary.totalCostUsd,
                uniqueAgents: observability.summary.uniqueAgents,
                uniqueRepos: observability.summary.uniqueRepos
            },
            dailyUsage: dailyTrend,
            endpointBreakdown: observability.endpointBreakdown,
            repoBreakdown: observability.repoBreakdown,
            modelBreakdown: observability.modelBreakdown,
            agentBreakdown: observability.agentBreakdown,
            taskBreakdown: observability.taskBreakdown,
            anomalies: observability.anomalies,
            insights: observability.insights,
            timeline: observability.timeline,
            hourlyDistribution,
            recentActivity: observability.recentActivity
        });
    } catch (error) {
        console.error('Get usage stats error:', error);
        res.status(500).json({ success: false, message: error.message || 'Failed to get usage stats' });
    }
});

module.exports = router;
