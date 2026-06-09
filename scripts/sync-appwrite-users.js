/**
 * Synchronize Appwrite Auth users into Velocity Brain database collections.
 *
 * Usage:
 *   node scripts/sync-appwrite-users.js
 *   node scripts/sync-appwrite-users.js --prune-codex-tests
 */
const path = require('path');
delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
const backendDir = path.resolve(__dirname, '..', 'backend');
const dotenv = require(path.join(backendDir, 'node_modules', 'dotenv'));
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
dotenv.config({ path: path.join(backendDir, '.env'), override: true });

const { Client, Databases, Users } = require(path.join(backendDir, 'node_modules', 'node-appwrite'));

const endpoint = process.env.APPWRITE_ENDPOINT || 'https://fra.cloud.appwrite.io/v1';
const projectId = process.env.APPWRITE_PROJECT_ID;
const databaseId = process.env.APPWRITE_DATABASE_ID || 'velocitybrain';
const apiKey = process.env.APPWRITE_API_KEY;
const pruneCodexTests = process.argv.includes('--prune-codex-tests');

if (!projectId || !apiKey) {
  console.error('APPWRITE_PROJECT_ID and APPWRITE_API_KEY are required. Check backend/.env.');
  process.exit(1);
}

const client = new Client()
  .setEndpoint(endpoint)
  .setProject(projectId)
  .setKey(apiKey);

const databases = new Databases(client);
const users = new Users(client);

const now = () => new Date().toISOString();

const defaultUserPayload = (authUser, existing = {}) => ({
  email: existing.email || String(authUser.email || '').trim().toLowerCase(),
  name: existing.name || authUser.name || String(authUser.email || '').split('@')[0] || '',
  tier: existing.tier || 'free',
  status: existing.status || 'active',
  account_type: existing.account_type || '',
  title: existing.title || '',
  company: existing.company || '',
  avatar_url: existing.avatar_url || '',
  avatar_path: existing.avatar_path || '',
  workspace_id: existing.workspace_id || '',
  workspace_ids: Array.isArray(existing.workspace_ids) ? existing.workspace_ids : [],
  onboarding_completed: Boolean(existing.onboarding_completed),
  onboarding_step: existing.onboarding_step || 'account_type',
  appwrite_user_id: authUser.$id,
  auth_provider: 'appwrite',
  email_verified: Boolean(authUser.emailVerification),
  '2fa_secret': existing['2fa_secret'] || null,
  '2fa_enabled': Boolean(existing['2fa_enabled']),
  created_at: existing.created_at || now(),
  updated_at: now(),
  last_login_at: existing.last_login_at || ''
});

const defaultSettingsPayload = (existing = {}) => ({
  notifications: {
    emailAlerts: true,
    usageWarnings: true,
    monthlyReports: false,
    productUpdates: true,
    ...(existing.notifications || {})
  },
  api: {
    responseStyle: 'normal',
    webhookUrl: '',
    allowedOrigins: [],
    ...(existing.api || {})
  },
  agents: {
    preferredAgent: 'codex',
    preferredSurface: 'mcp',
    primaryWorkflow: 'coding',
    observabilityFocus: 'repository_activity',
    pairingPreference: 'browser_assisted',
    autoOpenAgentManager: true,
    ...(existing.agents || {})
  },
  companySources: {
    slack: { connected: false, skipped: false, status: 'not_connected', displayName: '', lastSyncAt: null, lastSyncStatus: 'idle', scopesGranted: [], ...((existing.companySources || {}).slack || {}) },
    google: { connected: false, skipped: false, status: 'not_connected', displayName: '', lastSyncAt: null, lastSyncStatus: 'idle', scopesGranted: [], ...((existing.companySources || {}).google || {}) },
    github: { connected: false, skipped: false, status: 'not_connected', displayName: '', lastSyncAt: null, lastSyncStatus: 'idle', scopesGranted: [], ...((existing.companySources || {}).github || {}) }
  },
  onboardingSelections: existing.onboardingSelections || {},
  created_at: existing.created_at || now(),
  updated_at: now()
});

const defaultBillingPayload = (userId, existing = {}) => ({
  user_id: userId,
  plan: existing.plan || 'free',
  status: existing.status || 'active',
  period_start: existing.period_start || '',
  period_end: existing.period_end || '',
  metadata: existing.metadata || {},
  created_at: existing.created_at || now(),
  updated_at: now()
});

const stringifyJsonFields = (payload, fields) => {
  const next = { ...payload };
  for (const field of fields) {
    if (
      Object.prototype.hasOwnProperty.call(next, field) &&
      next[field] !== null &&
      typeof next[field] !== 'undefined' &&
      typeof next[field] !== 'string'
    ) {
      next[field] = JSON.stringify(next[field]);
    }
  }
  return next;
};

async function getDocument(collectionId, id) {
  try {
    return await databases.getDocument(databaseId, collectionId, id);
  } catch (error) {
    if (error?.code === 404) return null;
    throw error;
  }
}

async function upsertDocument(collectionId, id, payload) {
  const existing = await getDocument(collectionId, id);
  if (existing) {
    await databases.updateDocument(databaseId, collectionId, id, payload);
    return 'updated';
  }
  await databases.createDocument(databaseId, collectionId, id, payload);
  return 'created';
}

async function listAllDocuments(collectionId) {
  const response = await databases.listDocuments(databaseId, collectionId);
  return response.documents || [];
}

async function main() {
  const authUsers = await users.list();
  const authIds = new Set(authUsers.users.map((user) => user.$id));
  const results = [];

  for (const authUser of authUsers.users) {
    const existingUser = await getDocument('users', authUser.$id);
    const userAction = await upsertDocument(
      'users',
      authUser.$id,
      defaultUserPayload(authUser, existingUser || {})
    );

    const existingSettings = await getDocument('user_settings', authUser.$id);
    const settingsAction = await upsertDocument(
      'user_settings',
      authUser.$id,
      stringifyJsonFields(
        defaultSettingsPayload(existingSettings || {}),
        ['notifications', 'api', 'agents', 'companySources', 'onboardingSelections']
      )
    );

    const existingBilling = await getDocument('billing', authUser.$id);
    const billingAction = await upsertDocument(
      'billing',
      authUser.$id,
      stringifyJsonFields(defaultBillingPayload(authUser.$id, existingBilling || {}), ['metadata'])
    );

    results.push({
      id: authUser.$id,
      email: authUser.email,
      user: userAction,
      settings: settingsAction,
      billing: billingAction
    });
  }

  const pruned = [];
  if (pruneCodexTests) {
    const dbUsers = await listAllDocuments('users');
    for (const doc of dbUsers) {
      const isCodexTest = String(doc.email || '').startsWith('codex-sync-test') || String(doc.name || '').startsWith('Codex Sync Test');
      if (!authIds.has(doc.$id) && isCodexTest) {
        await databases.deleteDocument(databaseId, 'users', doc.$id);
        try {
          await databases.deleteDocument(databaseId, 'billing', doc.$id);
        } catch (error) {
          if (error?.code !== 404) throw error;
        }
        try {
          await databases.deleteDocument(databaseId, 'user_settings', doc.$id);
        } catch (error) {
          if (error?.code !== 404) throw error;
        }
        pruned.push({ id: doc.$id, email: doc.email });
      }
    }

    const billingDocs = await listAllDocuments('billing');
    for (const doc of billingDocs) {
      const isCodexTestBilling = String(doc.user_id || '').startsWith('test-sync-user');
      const isDuplicateForAuthUser = authIds.has(doc.user_id) && doc.$id !== doc.user_id;
      if (isCodexTestBilling || isDuplicateForAuthUser) {
        await databases.deleteDocument(databaseId, 'billing', doc.$id);
        pruned.push({ id: doc.$id, user_id: doc.user_id, collection: 'billing' });
      }
    }
  }

  console.log(JSON.stringify({
    ok: true,
    authUsers: authUsers.total,
    synced: results,
    pruned
  }, null, 2));
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
