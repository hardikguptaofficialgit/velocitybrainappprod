const ACCESS_POLICY = {
    publicAccessMessage: 'Velocity Brain is free for everyone for a limited time, with usage limits in place.',
    limitedAccessLabel: 'Limited-time free access',
    defaultUserTier: 'free',
    standardQuotas: {
        daily: 1000,
        monthly: 20000
    }
};

const getStandardQuota = () => ({
    daily: ACCESS_POLICY.standardQuotas.daily,
    monthly: ACCESS_POLICY.standardQuotas.monthly
});

module.exports = {
    ACCESS_POLICY,
    getStandardQuota
};
