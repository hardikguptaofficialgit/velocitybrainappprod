const parseCsv = (value) => (value || '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

const publicSignupEnabled = process.env.ALLOW_PUBLIC_SIGNUP !== 'false';
const approvedEmails = new Set(parseCsv(process.env.APPROVED_USER_EMAILS));
const approvedDomains = new Set(
    parseCsv(process.env.APPROVED_USER_DOMAINS).map((domain) => domain.replace(/^@/, ''))
);

const isUserApproved = (email) => {
    const normalizedEmail = (email || '').trim().toLowerCase();
    if (!normalizedEmail) {
        return false;
    }

    if (publicSignupEnabled) {
        return true;
    }

    if (approvedEmails.has(normalizedEmail)) {
        return true;
    }

    const domain = normalizedEmail.split('@')[1];
    return Boolean(domain && approvedDomains.has(domain));
};

const ACCESS_POLICY = {
    publicAccessMessage: publicSignupEnabled
        ? 'Anyone can create an account and start using Velocity Brain.'
        : 'Velocity Brain access is restricted to approved accounts.',
    limitedAccessLabel: publicSignupEnabled ? 'Open signup' : 'Approved accounts only',
    defaultUserTier: 'free',
    allowPublicSignup: publicSignupEnabled,
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
