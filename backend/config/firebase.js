const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

let db, auth;
let firebaseInitialized = false;

try {
  const configuredServiceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  const serviceAccountPath = configuredServiceAccountPath
    ? path.resolve(configuredServiceAccountPath)
    : path.join(__dirname, '../firebase-service-account.json');
  
  // Try to load from file first
  let serviceAccount;
  if (configuredServiceAccountPath && fs.existsSync(serviceAccountPath)) {
    serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
  } else {
    // Fallback to environment variables
    serviceAccount = {
      type: 'service_account',
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID,
      auth_uri: 'https://accounts.google.com/o/oauth2/auth',
      token_uri: 'https://oauth2.googleapis.com/token',
      auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
      client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${process.env.FIREBASE_CLIENT_EMAIL}`
    };
    
    if (!serviceAccount.project_id || !serviceAccount.private_key || !serviceAccount.client_email) {
      console.warn('Firebase credentials not found in environment variables');
      console.warn('Server will start without Firebase. Please configure Firebase to enable database features.');
      firebaseInitialized = false;
    }
  }

  if (serviceAccount.project_id && serviceAccount.private_key && serviceAccount.client_email) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: process.env.FIREBASE_DATABASE_URL
    });

    db = admin.firestore();
    auth = admin.auth();
    firebaseInitialized = true;
    console.log('Firebase initialized successfully');
  }
} catch (error) {
  console.warn('Firebase initialization failed:', error.message);
  console.warn('Server will start without Firebase. Please configure Firebase to enable database features.');
  firebaseInitialized = false;
}

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

async function initializeDatabase() {
  if (!firebaseInitialized) {
    console.warn('Firebase not initialized - skipping database initialization');
    return { ok: false, skipped: true };
  }

  try {
    // Firestore collections are created automatically when documents are added
    // We just need to verify connection
    await db.collection(COLLECTIONS.USERS).limit(1).get();
    console.log('Firebase Firestore connection verified');
    
    // Create indexes if needed (this would typically be done via Firebase Console)
    console.log('Firebase schema initialization complete');
    return { ok: true };
  } catch (error) {
    console.error('Firebase initialization error:', error);
    throw error;
  }
}

module.exports = {
  admin,
  db,
  auth,
  COLLECTIONS,
  initializeDatabase,
  firebaseInitialized
};
