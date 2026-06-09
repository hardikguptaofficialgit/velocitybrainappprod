const path = require('path');
delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
const backendDir = path.resolve(__dirname, '..', 'backend');
const dotenv = require(path.join(backendDir, 'node_modules', 'dotenv'));
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
dotenv.config({ path: path.join(backendDir, '.env'), override: true });
const { Client, Storage, Databases } = require(path.join(backendDir, 'node_modules', 'node-appwrite'));

const c = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT)
  .setProject(process.env.APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);

const storage = new Storage(c);
const db = new Databases(c);

async function check() {
  // 1. Storage buckets
  const buckets = await storage.listBuckets();
  console.log(`\n=== STORAGE BUCKETS (${buckets.buckets.length}) ===`);
  buckets.buckets.forEach(b => console.log(`  - ${b.name} (${b.$id})`));

  // 2. All collections
  const collections = [
    'users', 'workspaces', 'user_settings', 'api_keys', 'usage_logs',
    'hosted_ingests', 'agent_connections', 'agent_pairing_sessions',
    'agent_tokens', 'agent_activity_runs', 'agent_activity_steps',
    'repo_registrations', 'insight_events', 'source_connections',
    'source_sync_jobs', 'source_artifacts', 'source_connection_events',
    'billing', 'skills'
  ];

  console.log(`\n=== COLLECTIONS (${collections.length} expected) ===`);
  let ok = 0;
  for (const col of collections) {
    try {
      const result = await db.listDocuments(process.env.APPWRITE_DATABASE_ID, col);
      console.log(`  OK  ${col} (${result.documents.length} docs)`);
      ok++;
    } catch (e) {
      console.log(`  ERR ${col}: ${e.message}`);
    }
  }
  console.log(`\n  ${ok}/${collections.length} collections accessible`);

  // 3. Health check
  try {
    const backendUrl = process.env.BACKEND_PUBLIC_URL || `http://localhost:${process.env.PORT || 5004}`;
    const health = await fetch(`${backendUrl.replace(/\/+$/, '')}/health`);
    const data = await health.json();
    console.log(`\n=== BACKEND HEALTH ===`);
    console.log(`  Status: ${data.status}`);
    console.log(`  Database: ${data.database?.status}`);
    console.log(`  Collections: ${data.database?.collections} ready`);
    console.log(`  Appwrite: ${data.database?.connected ? 'connected' : 'not connected'}`);
  } catch (e) {
    console.log(`\n=== BACKEND HEALTH ===`);
    console.log(`  Backend not reachable: ${e.message}`);
    console.log(`  (Start with: cd backend && npm start)`);
  }
}

check().catch(e => console.error('Fatal:', e));
