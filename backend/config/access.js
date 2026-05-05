const isUserApproved = (email) => Boolean((email || '').trim().toLowerCase());

const ACCESS_POLICY = {
    publicAccessMessage: 'Anyone can create an account and start using Velocity Brain.',
    limitedAccessLabel: 'Open signup',
    defaultUserTier: 'free',
    allowPublicSignup: true,
    standardQuotas: {
        daily: 1000,
        monthly: 20000
    },
    isUserApproved
};

const getStandardQuota = () => ({
    daily: ACCESS_POLICY.standardQuotas.daily,
    monthly: ACCESS_POLICY.standardQuotas.monthly
});

module.exports = {
    ACCESS_POLICY,
    getStandardQuota
};
