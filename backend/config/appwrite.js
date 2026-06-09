const {
  Account,
  Client,
  Databases,
  ID,
  Permission,
  Query,
  Role,
  Storage,
  Users
} = require('node-appwrite');

const endpoint = process.env.APPWRITE_ENDPOINT || 'https://fra.cloud.appwrite.io/v1';
const projectId = process.env.APPWRITE_PROJECT_ID || '69e7d0a0002573ec6840';
const databaseId = process.env.APPWRITE_DATABASE_ID || 'velocitybrain';
const apiKey = process.env.APPWRITE_API_KEY || '';

const client = new Client()
  .setEndpoint(endpoint)
  .setProject(projectId);

if (apiKey) {
  client.setKey(apiKey);
}

const databases = new Databases(client);
const storage = new Storage(client);
const users = new Users(client);
const account = new Account(client);
const appwriteInitialized = Boolean(endpoint && projectId && databaseId && apiKey);

const COLLECTIONS = {
  USERS: 'users',
  WORKSPACES: 'workspaces',
  USER_SETTINGS: 'user_settings',
  API_KEYS: 'api_keys',
  USAGE_LOGS: 'usage_logs',
  HOSTED_INGESTS: 'hosted_ingests',
  AGENT_CONNECTIONS: 'agent_connections',
  AGENT_PAIRING_SESSIONS: 'agent_pairing_sessions',
  AGENT_TOKENS: 'agent_tokens',
  AGENT_ACTIVITY_RUNS: 'agent_activity_runs',
  AGENT_ACTIVITY_STEPS: 'agent_activity_steps',
  REPO_REGISTRATIONS: 'repo_registrations',
  INSIGHT_EVENTS: 'insight_events',
  SOURCE_CONNECTIONS: 'source_connections',
  SOURCE_SYNC_JOBS: 'source_sync_jobs',
  SOURCE_ARTIFACTS: 'source_artifacts',
  SOURCE_CONNECTION_EVENTS: 'source_connection_events',
  BILLING: 'billing',
  SKILLS: 'skills'
};

const BUCKETS = {
  PROFILE_IMAGES: process.env.APPWRITE_PROFILE_IMAGES_BUCKET_ID || 'profile_images',
  WORKSPACE_IMAGES: process.env.APPWRITE_WORKSPACE_IMAGES_BUCKET_ID || 'workspace_images'
};

const JSON_FIELDS = {
  [COLLECTIONS.USER_SETTINGS]: new Set(['notifications', 'api', 'agents', 'companySources', 'onboardingSelections']),
  [COLLECTIONS.WORKSPACES]: new Set(['members', 'settings']),
  [COLLECTIONS.API_KEYS]: new Set(['scope_defaults']),
  [COLLECTIONS.AGENT_CONNECTIONS]: new Set(['metadata']),
  [COLLECTIONS.AGENT_PAIRING_SESSIONS]: new Set(['metadata']),
  [COLLECTIONS.AGENT_TOKENS]: new Set(['metadata']),
  [COLLECTIONS.AGENT_ACTIVITY_RUNS]: new Set(['plan', 'result']),
  [COLLECTIONS.REPO_REGISTRATIONS]: new Set(['metadata']),
  [COLLECTIONS.INSIGHT_EVENTS]: new Set(['payload']),
  [COLLECTIONS.SOURCE_CONNECTIONS]: new Set(['metadata']),
  [COLLECTIONS.SOURCE_ARTIFACTS]: new Set(['metadata']),
  [COLLECTIONS.SOURCE_CONNECTION_EVENTS]: new Set(['payload']),
  [COLLECTIONS.BILLING]: new Set(['metadata']),
  [COLLECTIONS.SKILLS]: new Set(['metadata'])
};

const parseJsonField = (value) => {
  if (value === null || typeof value === 'undefined' || typeof value !== 'string') {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const normalizeDocumentFromAppwrite = (collectionId, document = {}) => {
  const result = { ...document };
  const jsonFields = JSON_FIELDS[collectionId] || new Set();
  for (const field of jsonFields) {
    if (Object.prototype.hasOwnProperty.call(result, field)) {
      result[field] = parseJsonField(result[field]);
    }
  }
  return result;
};

const serializeDocumentForAppwrite = (collectionId, payload = {}) => {
  const result = { ...payload };
  const jsonFields = JSON_FIELDS[collectionId] || new Set();
  for (const field of jsonFields) {
    if (
      Object.prototype.hasOwnProperty.call(result, field) &&
      result[field] !== null &&
      typeof result[field] !== 'undefined' &&
      typeof result[field] !== 'string'
    ) {
      result[field] = JSON.stringify(result[field]);
    }
  }
  return result;
};

const stripSystemFields = (document = {}) => {
  const result = { ...document };
  for (const key of Object.keys(result)) {
    if (key.startsWith('$')) {
      delete result[key];
    }
  }
  return result;
};

const createDocumentSnapshot = (collectionId, id, document) => {
  const exists = Boolean(document);
  const data = exists ? stripSystemFields(normalizeDocumentFromAppwrite(collectionId, document)) : undefined;

  return {
    id,
    exists,
    data: () => data,
    ref: createDocumentReference(collectionId, id)
  };
};

const normalizeQueries = (filters = [], limitCount = null) => {
  const queries = filters.map((filter) => {
    if (filter.operator !== '==') {
      throw new Error(`Unsupported Appwrite adapter operator: ${filter.operator}`);
    }
    return Query.equal(filter.field, filter.value);
  });

  if (typeof limitCount === 'number') {
    queries.push(Query.limit(limitCount));
  }

  return queries;
};

const createQueryBuilder = (collectionId, filters = [], limitCount = null) => ({
  where(field, operator, value) {
    return createQueryBuilder(collectionId, [...filters, { field, operator, value }], limitCount);
  },
  limit(count) {
    return createQueryBuilder(collectionId, filters, count);
  },
  async get() {
    const response = await databases.listDocuments(
      databaseId,
      collectionId,
      normalizeQueries(filters, limitCount)
    );
    const docs = (response.documents || []).map((document) =>
      createDocumentSnapshot(collectionId, document.$id, document)
    );
    return {
      docs,
      empty: docs.length === 0,
      size: docs.length
    };
  }
});

function createDocumentReference(collectionId, id) {
  return {
    async get() {
      try {
        const document = await databases.getDocument(databaseId, collectionId, id);
        return createDocumentSnapshot(collectionId, id, document);
      } catch (error) {
        if (error?.code === 404) {
          return createDocumentSnapshot(collectionId, id, null);
        }
        throw error;
      }
    },
    async set(payload) {
      const existing = await this.get();
      const serialized = serializeDocumentForAppwrite(collectionId, payload);
      if (existing.exists) {
        return databases.updateDocument(databaseId, collectionId, id, serialized);
      }
      return databases.createDocument(databaseId, collectionId, id, serialized);
    },
    async update(updates) {
      return databases.updateDocument(databaseId, collectionId, id, serializeDocumentForAppwrite(collectionId, updates));
    },
    async delete() {
      return databases.deleteDocument(databaseId, collectionId, id);
    }
  };
}

const db = {
  collection(collectionId) {
    return {
      where(field, operator, value) {
        return createQueryBuilder(collectionId, [{ field, operator, value }]);
      },
      limit(count) {
        return createQueryBuilder(collectionId, [], count);
      },
      async get() {
        return createQueryBuilder(collectionId).get();
      },
      async add(payload) {
        const serialized = serializeDocumentForAppwrite(collectionId, payload);
        const document = await databases.createDocument(
          databaseId,
          collectionId,
          ID.unique(),
          serialized
        );
        return {
          id: document.$id,
          async get() {
            return createDocumentSnapshot(collectionId, document.$id, document);
          }
        };
      },
      doc(id) {
        return createDocumentReference(collectionId, id);
      }
    };
  }
};

const createJwtAccount = (jwt) => {
  const jwtClient = new Client()
    .setEndpoint(endpoint)
    .setProject(projectId)
    .setJWT(jwt);
  return new Account(jwtClient);
};

async function initializeDatabase() {
  if (!appwriteInitialized) {
    console.warn('Appwrite is not fully configured - database features will not be available');
    return { ok: false, skipped: true };
  }

  try {
    await databases.listDocuments(databaseId, COLLECTIONS.USERS, [Query.limit(1)]);
    console.log('Appwrite database connection verified');
    return { ok: true };
  } catch (error) {
    console.error('Appwrite initialization error:', error.message || error);
    throw error;
  }
}

async function getDatabaseHealth() {
  if (!appwriteInitialized) {
    return {
      connected: false,
      status: 'not_configured',
      databaseId,
      collections: 0
    };
  }

  try {
    const response = await databases.listDocuments(databaseId, COLLECTIONS.USERS, [Query.limit(1)]);
    return {
      connected: true,
      status: 'connected',
      databaseId,
      collections: Object.keys(COLLECTIONS).length,
      usersVisible: typeof response.total === 'number' ? response.total : undefined
    };
  } catch (error) {
    return {
      connected: false,
      status: 'error',
      databaseId,
      collections: 0,
      error: error.message || String(error)
    };
  }
}

module.exports = {
  account,
  appwriteInitialized,
  BUCKETS,
  client,
  COLLECTIONS,
  createJwtAccount,
  databaseId,
  databases,
  db,
  endpoint,
  ID,
  Permission,
  projectId,
  Query,
  Role,
  storage,
  users,
  getDatabaseHealth,
  initializeDatabase
};
