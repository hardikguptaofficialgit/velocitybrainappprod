const express = require('express');
const { db, COLLECTIONS } = require('../config/firebase');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

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

module.exports = router;
