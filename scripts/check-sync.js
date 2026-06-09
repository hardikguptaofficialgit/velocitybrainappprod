const path = require('path');
delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
const backendDir = path.resolve(__dirname, '..', 'backend');
const dotenv = require(path.join(backendDir, 'node_modules', 'dotenv'));
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
dotenv.config({ path: path.join(backendDir, '.env'), override: true });
const { Client, Databases, Users } = require(path.join(backendDir, 'node_modules', 'node-appwrite'));

const c = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT)
  .setProject(process.env.APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(c);
const auth = new Users(c);
const dbId = process.env.APPWRITE_DATABASE_ID;

async function check() {
  const authUserList = await auth.list();

  // Check users collection has synced data
  const users = await databases.listDocuments(dbId, 'users');
  console.log(`\n=== USERS COLLECTION (${users.documents.length}) ===`);
  users.documents.forEach(u => {
    console.log(`  - ${u.name || 'N/A'} <${u.email}> | Tier: ${u.tier} | Provider: ${u.auth_provider} | Status: ${u.status}`);
  });

  // Check user_settings collection
  const settings = await databases.listDocuments(dbId, 'user_settings');
  console.log(`\n=== USER SETTINGS (${settings.documents.length}) ===`);
  settings.documents.forEach(s => {
    console.log(`  - ${s.$id}: response_style=${s.response_style || 'default'}`);
  });

  // Check billing collection
  const billing = await databases.listDocuments(dbId, 'billing');
  console.log(`\n=== BILLING (${billing.documents.length}) ===`);
  billing.documents.forEach(b => {
    console.log(`  - User: ${b.user_id} | Plan: ${b.plan || 'N/A'} | Status: ${b.status || 'N/A'}`);
  });

  console.log('\n=== SYNC CHECK ===');
  const authUsers = authUserList.total;
  const dbUsers = users.documents.length;
  console.log(`  Auth users: ${authUsers} | DB users: ${dbUsers} | Synced: ${authUsers === dbUsers ? 'YES' : 'MISMATCH'}`);
  
  const settingsCount = settings.documents.length;
  console.log(`  User settings created: ${settingsCount} | Expected: ${authUsers} | OK: ${settingsCount >= authUsers ? 'YES' : 'NO'}`);
}

check().catch(e => console.error('Fatal:', e));
