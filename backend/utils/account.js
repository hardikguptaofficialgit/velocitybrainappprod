const ACCOUNT_TYPES = new Set(['company', 'individual']);
const WORKSPACE_IMAGE_TARGET = 'workspace';
const PROFILE_IMAGE_TARGET = 'profile';
const DICEBEAR_BASE_URL = 'https://api.dicebear.com/9.x';

const CURATED_AVATAR_DEFINITIONS = [
    { style: 'bottts-neutral', seed: 'Studio Spark', background: 'f59e0b' },
    { style: 'shapes', seed: 'Orbit Signal', background: 'fb7185' },
    { style: 'identicon', seed: 'Pixel Drift', background: '38bdf8' },
    { style: 'rings', seed: 'Cinder Loop', background: 'a78bfa' },
    { style: 'thumbs', seed: 'Nova Echo', background: '34d399' },
    { style: 'bottts-neutral', seed: 'Glow Circuit', background: 'f97316' },
    { style: 'shapes', seed: 'Mosaic Wave', background: '22c55e' },
    { style: 'identicon', seed: 'Quiet Comet', background: 'e879f9' }
];

const DEFAULT_NOTIFICATION_SETTINGS = {
    emailAlerts: true,
    usageWarnings: true,
    monthlyReports: false,
    productUpdates: true
};

const DEFAULT_API_SETTINGS = {
    responseStyle: 'normal',
    webhookUrl: '',
    allowedOrigins: []
};

const DEFAULT_AGENT_SETTINGS = {
    preferredAgent: 'codex',
    preferredSurface: 'mcp',
    primaryWorkflow: 'coding',
    observabilityFocus: 'repository_activity',
    pairingPreference: 'browser_assisted',
    autoOpenAgentManager: true
};

const DEFAULT_COMPANY_SOURCE_ENTRY = {
    connected: false,
    skipped: false,
    status: 'not_connected',
    displayName: '',
    lastSyncAt: null,
    lastSyncStatus: 'idle',
    scopesGranted: []
};

const DEFAULT_COMPANY_SOURCES = {
    slack: { ...DEFAULT_COMPANY_SOURCE_ENTRY },
    google: { ...DEFAULT_COMPANY_SOURCE_ENTRY },
    github: { ...DEFAULT_COMPANY_SOURCE_ENTRY }
};

const DEFAULT_WORKSPACE_SETTINGS = {
    timezone: 'UTC',
    industry: '',
    companySize: '',
    website: '',
    description: '',
    primaryUseCase: ''
};

const sanitizeText = (value, maxLength = 160) => {
    if (typeof value !== 'string') return '';
    return value.trim().replace(/\s+/g, ' ').slice(0, maxLength);
};

const sanitizeLongText = (value, maxLength = 1200) => {
    if (typeof value !== 'string') return '';
    return value.trim().slice(0, maxLength);
};

const buildDicebearAvatarUrl = ({ style, seed, background }) => (
    `${DICEBEAR_BASE_URL}/${style}/svg?seed=${encodeURIComponent(seed)}&backgroundColor=${encodeURIComponent(background)}`
);

const CURATED_AVATAR_URLS = new Set(CURATED_AVATAR_DEFINITIONS.map(buildDicebearAvatarUrl));

const isHostedAvatarUrl = (value) => {
    const normalized = sanitizeText(value, 400);
    if (!normalized) return false;
    try {
        const parsed = new URL(normalized);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
            return false;
        }
        if (parsed.hostname === 'api.dicebear.com' && parsed.pathname.startsWith('/9.x/')) {
            return true;
        }
        return false;
    } catch {
        return false;
    }
};

const sanitizeAvatarUrl = (value) => {
    const normalized = sanitizeText(value, 400);
    if (!normalized) return '';
    if (CURATED_AVATAR_URLS.has(normalized) || isHostedAvatarUrl(normalized)) {
        return normalized;
    }
    return '';
};

const slugify = (value) => sanitizeText(value, 120)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);

const sanitizeUrl = (value) => {
    const text = sanitizeText(value, 240);
    if (!text) return '';
    try {
        const normalized = text.startsWith('http://') || text.startsWith('https://')
            ? text
            : `https://${text}`;
        const parsed = new URL(normalized);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
            return '';
        }
        return parsed.toString();
    } catch {
        return '';
    }
};

const sanitizeAllowedOrigins = (value) => {
    const items = Array.isArray(value)
        ? value
        : typeof value === 'string'
            ? value.split(/\r?\n|,/)
            : [];

    const unique = new Set();
    for (const item of items) {
        const origin = sanitizeText(item, 200).replace(/\/+$/, '');
        if (!origin) continue;
        if (origin === '*') {
            unique.add('*');
            continue;
        }
        try {
            const parsed = new URL(origin);
            unique.add(`${parsed.protocol}//${parsed.host}`);
        } catch {
            continue;
        }
    }
    return Array.from(unique).slice(0, 20);
};

const inferWorkspaceName = ({ name, email, accountType, companyName }) => {
    if (accountType === 'company' && companyName) {
        return sanitizeText(companyName, 120);
    }
    if (name) {
        return `${sanitizeText(name, 100)}'s Workspace`.slice(0, 120);
    }
    if (email) {
        return `${String(email).split('@')[0]}'s Workspace`.slice(0, 120);
    }
    return 'Workspace';
};

const buildUserDefaults = ({ email, name = '', tier = 'free' }) => ({
    email,
    name: sanitizeText(name, 120),
    tier,
    status: 'active',
    account_type: '',
    title: '',
    company: '',
    avatar_url: '',
    avatar_path: '',
    workspace_id: '',
    workspace_ids: [],
    onboarding_completed: false,
    onboarding_step: 'account_type',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
});

const buildDefaultUserSettings = () => ({
    notifications: { ...DEFAULT_NOTIFICATION_SETTINGS },
    api: { ...DEFAULT_API_SETTINGS },
    agents: { ...DEFAULT_AGENT_SETTINGS },
    companySources: {
        slack: { ...DEFAULT_COMPANY_SOURCE_ENTRY },
        google: { ...DEFAULT_COMPANY_SOURCE_ENTRY },
        github: { ...DEFAULT_COMPANY_SOURCE_ENTRY }
    },
    onboardingSelections: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
});

const mergeSettings = (settings = {}) => ({
    notifications: {
        ...DEFAULT_NOTIFICATION_SETTINGS,
        ...(settings.notifications || {})
    },
    api: {
        ...DEFAULT_API_SETTINGS,
        ...(settings.api || {})
    },
    agents: {
        ...DEFAULT_AGENT_SETTINGS,
        ...(settings.agents || {})
    },
    companySources: {
        slack: {
            ...DEFAULT_COMPANY_SOURCE_ENTRY,
            ...((settings.companySources || {}).slack || {})
        },
        google: {
            ...DEFAULT_COMPANY_SOURCE_ENTRY,
            ...((settings.companySources || {}).google || {})
        },
        github: {
            ...DEFAULT_COMPANY_SOURCE_ENTRY,
            ...((settings.companySources || {}).github || {})
        }
    },
    onboardingSelections: {
        ...(settings.onboardingSelections || {})
    },
    created_at: settings.created_at || new Date().toISOString(),
    updated_at: settings.updated_at || new Date().toISOString()
});

const buildWorkspacePayload = ({
    name,
    ownerUser,
    accountType,
    industry = '',
    companySize = '',
    website = '',
    description = '',
    primaryUseCase = '',
    timezone = 'UTC',
    imageUrl = '',
    imagePath = '',
    imagePublicId = ''
}) => {
    const workspaceName = sanitizeText(name, 120) || inferWorkspaceName({
        name: ownerUser.name,
        email: ownerUser.email,
        accountType,
        companyName: accountType === 'company' ? name : ''
    });
    const now = new Date().toISOString();
    return {
        name: workspaceName,
        slug: slugify(workspaceName) || `workspace-${ownerUser.id}`,
        type: ACCOUNT_TYPES.has(accountType) ? accountType : 'individual',
        owner_user_id: ownerUser.id,
        member_ids: [ownerUser.id],
        members: [{
            user_id: ownerUser.id,
            email: ownerUser.email,
            name: ownerUser.name || '',
            role: 'owner'
        }],
        image_url: imageUrl,
        image_path: imagePath,
        image_public_id: imagePublicId,
        settings: {
            ...DEFAULT_WORKSPACE_SETTINGS,
            industry: sanitizeText(industry, 80),
            companySize: sanitizeText(companySize, 40),
            website: sanitizeUrl(website),
            description: sanitizeLongText(description, 1000),
            primaryUseCase: sanitizeLongText(primaryUseCase, 400),
            timezone: sanitizeText(timezone, 80) || 'UTC'
        },
        status: 'active',
        created_at: now,
        updated_at: now
    };
};

const sanitizeWorkspaceUpdate = (input = {}) => ({
    name: sanitizeText(input.name, 120),
    imageUrl: sanitizeAvatarUrl(input.imageUrl),
    settings: {
        industry: sanitizeText(input.industry, 80),
        companySize: sanitizeText(input.companySize, 40),
        website: sanitizeUrl(input.website),
        description: sanitizeLongText(input.description, 1000),
        primaryUseCase: sanitizeLongText(input.primaryUseCase, 400),
        timezone: sanitizeText(input.timezone, 80) || 'UTC'
    }
});

const toPublicUser = (id, user = {}) => ({
    id,
    email: user.email || '',
    name: user.name || '',
    tier: user.tier || 'free',
    title: user.title || '',
    company: user.company || '',
    accountType: user.account_type || '',
    avatarUrl: user.avatar_url || '',
    twoFactorEnabled: Boolean(user['2fa_enabled']),
    workspaceId: user.workspace_id || '',
    workspaceIds: Array.isArray(user.workspace_ids) ? user.workspace_ids : [],
    onboardingCompleted: Boolean(user.onboarding_completed),
    onboardingStep: user.onboarding_step || 'account_type'
});

const toPublicWorkspace = (id, workspace = {}) => ({
    id,
    name: workspace.name || '',
    slug: workspace.slug || '',
    type: workspace.type || 'individual',
    imageUrl: workspace.image_url || '',
    ownerUserId: workspace.owner_user_id || '',
    members: Array.isArray(workspace.members) ? workspace.members : [],
    settings: {
        ...DEFAULT_WORKSPACE_SETTINGS,
        ...(workspace.settings || {})
    },
    status: workspace.status || 'active'
});

module.exports = {
    ACCOUNT_TYPES,
    WORKSPACE_IMAGE_TARGET,
    PROFILE_IMAGE_TARGET,
    DEFAULT_NOTIFICATION_SETTINGS,
    DEFAULT_API_SETTINGS,
    DEFAULT_AGENT_SETTINGS,
    DEFAULT_COMPANY_SOURCES,
    DEFAULT_WORKSPACE_SETTINGS,
    sanitizeText,
    sanitizeLongText,
    sanitizeAvatarUrl,
    sanitizeUrl,
    sanitizeAllowedOrigins,
    slugify,
    inferWorkspaceName,
    buildUserDefaults,
    buildDefaultUserSettings,
    mergeSettings,
    buildWorkspacePayload,
    sanitizeWorkspaceUpdate,
    toPublicUser,
    toPublicWorkspace,
    CURATED_AVATAR_URLS
};
