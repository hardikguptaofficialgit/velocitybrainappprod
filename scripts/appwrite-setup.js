/**
 * Appwrite Provisioning Script for Velocity Brain
 * Creates database, collections, attributes, indexes, and storage buckets.
 * Run: node scripts/appwrite-setup.js
 */
const path = require('path');
delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
const backendDir = path.resolve(__dirname, '..', 'backend');
require(path.join(backendDir, 'node_modules', 'dotenv')).config({ path: path.join(backendDir, '.env') });

const { Client, Databases, Storage, ID, Permission, Role } = require(path.join(backendDir, 'node_modules', 'node-appwrite'));

const endpoint = process.env.APPWRITE_ENDPOINT || 'https://fra.cloud.appwrite.io/v1';
const projectId = process.env.APPWRITE_PROJECT_ID || '69e7d0a0002573ec6840';
const databaseId = process.env.APPWRITE_DATABASE_ID || 'velocitybrain';
const apiKey = process.env.APPWRITE_API_KEY;

if (!apiKey) {
  console.error('ERROR: APPWRITE_API_KEY is not set. Check backend/.env');
  process.exit(1);
}

const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
const databases = new Databases(client);
const storage = new Storage(client);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Collection definitions ──────────────────────────────────────────────────
const COLLECTIONS = {
  users: {
    attrs: [
      { key: 'email', type: 'string', size: 320, required: true },
      { key: 'name', type: 'string', size: 256, required: false, default: '' },
      { key: 'tier', type: 'string', size: 64, required: false, default: 'free' },
      { key: 'status', type: 'string', size: 64, required: false, default: 'active' },
      { key: 'account_type', type: 'string', size: 64, required: false, default: '' },
      { key: 'title', type: 'string', size: 256, required: false, default: '' },
      { key: 'company', type: 'string', size: 256, required: false, default: '' },
      { key: 'avatar_url', type: 'string', size: 1024, required: false, default: '' },
      { key: 'avatar_path', type: 'string', size: 512, required: false, default: '' },
      { key: 'avatar_file_id', type: 'string', size: 256, required: false, default: '' },
      { key: 'avatar_bucket_id', type: 'string', size: 256, required: false, default: '' },
      { key: 'workspace_id', type: 'string', size: 256, required: false, default: '' },
      { key: 'workspace_ids', type: 'string', elements: true, required: false },
      { key: 'onboarding_completed', type: 'boolean', required: false, default: false },
      { key: 'onboarding_step', type: 'string', size: 128, required: false, default: 'account_type' },
      { key: 'appwrite_user_id', type: 'string', size: 256, required: false, default: '' },
      { key: 'auth_provider', type: 'string', size: 64, required: false, default: 'appwrite' },
      { key: 'email_verified', type: 'boolean', required: false, default: false },
      { key: '2fa_secret', type: 'string', size: 256, required: false, default: null },
      { key: '2fa_enabled', type: 'boolean', required: false, default: false },
      { key: 'created_at', type: 'string', size: 64, required: false, default: '' },
      { key: 'updated_at', type: 'string', size: 64, required: false, default: '' },
      { key: 'last_login_at', type: 'string', size: 64, required: false, default: '' },
    ],
    indexes: [
      { key: 'idx_status', type: 'key', attrs: ['status'] },
      { key: 'idx_email', type: 'key', attrs: ['email'] },
      { key: 'idx_appwrite_user_id', type: 'key', attrs: ['appwrite_user_id'] },
    ],
  },
  workspaces: {
    attrs: [
      { key: 'name', type: 'string', size: 256, required: true },
      { key: 'slug', type: 'string', size: 256, required: true },
      { key: 'type', type: 'string', size: 64, required: false, default: 'individual' },
      { key: 'owner_user_id', type: 'string', size: 256, required: true },
      { key: 'member_ids', type: 'string', elements: true, required: false },
      { key: 'members', type: 'object', required: false },
      { key: 'image_url', type: 'string', size: 1024, required: false, default: '' },
      { key: 'image_path', type: 'string', size: 512, required: false, default: '' },
      { key: 'image_public_id', type: 'string', size: 512, required: false, default: '' },
      { key: 'image_file_id', type: 'string', size: 256, required: false, default: '' },
      { key: 'image_bucket_id', type: 'string', size: 256, required: false, default: '' },
      { key: 'settings', type: 'object', required: false },
      { key: 'status', type: 'string', size: 64, required: false, default: 'active' },
      { key: 'created_at', type: 'string', size: 64, required: false, default: '' },
      { key: 'updated_at', type: 'string', size: 64, required: false, default: '' },
    ],
    indexes: [
      { key: 'idx_owner', type: 'key', attrs: ['owner_user_id'] },
      { key: 'idx_slug', type: 'key', attrs: ['slug'] },
    ],
  },
  user_settings: {
    attrs: [
      { key: 'notifications', type: 'object', required: false },
      { key: 'api', type: 'object', required: false },
      { key: 'agents', type: 'object', required: false },
      { key: 'companySources', type: 'object', required: false },
      { key: 'onboardingSelections', type: 'object', required: false },
      { key: 'created_at', type: 'string', size: 64, required: false, default: '' },
      { key: 'updated_at', type: 'string', size: 64, required: false, default: '' },
    ],
    indexes: [],
  },
  api_keys: {
    attrs: [
      { key: 'user_id', type: 'string', size: 256, required: true },
      { key: 'name', type: 'string', size: 256, required: true },
      { key: 'key_hash', type: 'string', size: 256, required: true },
      { key: 'key_prefix', type: 'string', size: 64, required: false, default: '' },
      { key: 'tier', type: 'string', size: 64, required: false, default: 'free' },
      { key: 'status', type: 'string', size: 64, required: false, default: 'active' },
      { key: 'created_at', type: 'string', size: 64, required: false, default: '' },
      { key: 'updated_at', type: 'string', size: 64, required: false, default: '' },
      { key: 'last_used_at', type: 'string', size: 64, required: false, default: null },
      { key: 'last_rotated_at', type: 'string', size: 64, required: false, default: null },
      { key: 'revoked_at', type: 'string', size: 64, required: false, default: null },
      { key: 'scope_defaults', type: 'object', required: false },
      { key: 'daily_quota', type: 'integer', required: false, default: 1000 },
      { key: 'monthly_quota', type: 'integer', required: false, default: 20000 },
    ],
    indexes: [
      { key: 'idx_user_id', type: 'key', attrs: ['user_id'] },
      { key: 'idx_key_hash', type: 'key', attrs: ['key_hash'] },
      { key: 'idx_status', type: 'key', attrs: ['status'] },
    ],
  },
  usage_logs: {
    attrs: [
      { key: 'api_key_id', type: 'string', size: 256, required: false, default: null },
      { key: 'user_id', type: 'string', size: 256, required: true },
      { key: 'endpoint', type: 'string', size: 512, required: false, default: '' },
      { key: 'method', type: 'string', size: 16, required: false, default: 'GET' },
      { key: 'status_code', type: 'integer', required: false, default: 200 },
      { key: 'response_time_ms', type: 'double', required: false, default: 0 },
      { key: 'request_size', type: 'integer', required: false, default: 0 },
      { key: 'response_size', type: 'integer', required: false, default: 0 },
      { key: 'reuse_hit_type', type: 'string', size: 64, required: false, default: 'none' },
      { key: 'artifacts_used', type: 'integer', required: false, default: 0 },
      { key: 'avoided_input_tokens', type: 'integer', required: false, default: 0 },
      { key: 'estimated_cost_saved', type: 'double', required: false, default: 0 },
      { key: 'estimated_latency_saved_ms', type: 'double', required: false, default: 0 },
      { key: 'repo_id', type: 'string', size: 512, required: false, default: 'default-workspace' },
      { key: 'repo_name', type: 'string', size: 512, required: false, default: '' },
      { key: 'repo_path', type: 'string', size: 1024, required: false, default: '' },
      { key: 'branch', type: 'string', size: 256, required: false, default: '' },
      { key: 'project_id', type: 'string', size: 512, required: false, default: '' },
      { key: 'agent_id', type: 'string', size: 256, required: false, default: 'unknown-agent' },
      { key: 'agent_instance_id', type: 'string', size: 256, required: false, default: '' },
      { key: 'agent_surface', type: 'string', size: 64, required: false, default: 'mcp' },
      { key: 'model_provider', type: 'string', size: 128, required: false, default: 'unknown' },
      { key: 'model_name', type: 'string', size: 128, required: false, default: 'unknown' },
      { key: 'task_type', type: 'string', size: 128, required: false, default: 'unknown' },
      { key: 'operation_type', type: 'string', size: 128, required: false, default: 'unknown' },
      { key: 'run_id', type: 'string', size: 256, required: false, default: '' },
      { key: 'session_id', type: 'string', size: 256, required: false, default: '' },
      { key: 'request_tokens', type: 'integer', required: false, default: 0 },
      { key: 'response_tokens', type: 'integer', required: false, default: 0 },
      { key: 'total_tokens', type: 'integer', required: false, default: 0 },
      { key: 'cost_usd', type: 'double', required: false, default: 0 },
      { key: 'latency_ms', type: 'double', required: false, default: 0 },
      { key: 'status', type: 'string', size: 64, required: false, default: 'completed' },
      { key: 'error_type', type: 'string', size: 256, required: false, default: '' },
      { key: 'insight_flags', type: 'string', elements: true, required: false },
      { key: 'created_at', type: 'string', size: 64, required: false, default: '' },
    ],
    indexes: [
      { key: 'idx_user_id', type: 'key', attrs: ['user_id'] },
      { key: 'idx_api_key_id', type: 'key', attrs: ['api_key_id'] },
      { key: 'idx_created_at', type: 'key', attrs: ['created_at'] },
    ],
  },
  hosted_ingests: {
    attrs: [
      { key: 'user_id', type: 'string', size: 256, required: true },
      { key: 'source', type: 'string', size: 256, required: false, default: '' },
      { key: 'content', type: 'string', size: 65536, required: true },
      { key: 'metadata', type: 'object', required: false },
      { key: 'tags', type: 'string', elements: true, required: false },
      { key: 'created_at', type: 'string', size: 64, required: false, default: '' },
    ],
    indexes: [
      { key: 'idx_user_id', type: 'key', attrs: ['user_id'] },
    ],
  },
  agent_connections: {
    attrs: [
      { key: 'user_id', type: 'string', size: 256, required: true },
      { key: 'api_key_id', type: 'string', size: 256, required: false, default: null },
      { key: 'agent_id', type: 'string', size: 256, required: true },
      { key: 'agent_instance_id', type: 'string', size: 256, required: false, default: '' },
      { key: 'agent_surface', type: 'string', size: 64, required: false, default: 'mcp' },
      { key: 'status', type: 'string', size: 64, required: false, default: 'connected' },
      { key: 'repo_id', type: 'string', size: 512, required: false, default: 'default-workspace' },
      { key: 'repo_name', type: 'string', size: 512, required: false, default: '' },
      { key: 'repo_path', type: 'string', size: 1024, required: false, default: '' },
      { key: 'branch', type: 'string', size: 256, required: false, default: '' },
      { key: 'project_id', type: 'string', size: 512, required: false, default: '' },
      { key: 'repo_scopes', type: 'string', elements: true, required: false },
      { key: 'metadata', type: 'object', required: false },
      { key: 'revoked_at', type: 'string', size: 64, required: false, default: null },
      { key: 'created_at', type: 'string', size: 64, required: false, default: '' },
      { key: 'updated_at', type: 'string', size: 64, required: false, default: '' },
    ],
    indexes: [
      { key: 'idx_user_id', type: 'key', attrs: ['user_id'] },
      { key: 'idx_agent_id', type: 'key', attrs: ['agent_id'] },
      { key: 'idx_status', type: 'key', attrs: ['status'] },
    ],
  },
  agent_pairing_sessions: {
    attrs: [
      { key: 'user_id', type: 'string', size: 256, required: true },
      { key: 'api_key_id', type: 'string', size: 256, required: true },
      { key: 'agent_id', type: 'string', size: 256, required: true },
      { key: 'agent_surface', type: 'string', size: 64, required: false, default: 'mcp' },
      { key: 'repo_scope', type: 'string', elements: true, required: false },
      { key: 'project_id', type: 'string', size: 512, required: false, default: '' },
      { key: 'status', type: 'string', size: 64, required: false, default: 'pending' },
      { key: 'code_hash', type: 'string', size: 256, required: true },
      { key: 'expires_at', type: 'string', size: 64, required: true },
      { key: 'metadata', type: 'object', required: false },
      { key: 'completed_at', type: 'string', size: 64, required: false, default: null },
      { key: 'agent_connection_id', type: 'string', size: 256, required: false, default: null },
      { key: 'created_at', type: 'string', size: 64, required: false, default: '' },
      { key: 'updated_at', type: 'string', size: 64, required: false, default: '' },
    ],
    indexes: [
      { key: 'idx_code_hash', type: 'key', attrs: ['code_hash'] },
      { key: 'idx_user_id', type: 'key', attrs: ['user_id'] },
    ],
  },
  agent_tokens: {
    attrs: [
      { key: 'user_id', type: 'string', size: 256, required: true },
      { key: 'api_key_id', type: 'string', size: 256, required: false, default: null },
      { key: 'agent_connection_id', type: 'string', size: 256, required: true },
      { key: 'status', type: 'string', size: 64, required: false, default: 'active' },
      { key: 'refresh_token_hash', type: 'string', size: 256, required: false, default: '' },
      { key: 'revoked_reason', type: 'string', size: 256, required: false, default: null },
      { key: 'metadata', type: 'object', required: false },
      { key: 'created_at', type: 'string', size: 64, required: false, default: '' },
      { key: 'updated_at', type: 'string', size: 64, required: false, default: '' },
    ],
    indexes: [
      { key: 'idx_agent_connection_id', type: 'key', attrs: ['agent_connection_id'] },
      { key: 'idx_status', type: 'key', attrs: ['status'] },
    ],
  },
  agent_activity_runs: {
    attrs: [
      { key: 'user_id', type: 'string', size: 256, required: true },
      { key: 'run_id', type: 'string', size: 256, required: false, default: '' },
      { key: 'agent_id', type: 'string', size: 256, required: false, default: '' },
      { key: 'status', type: 'string', size: 64, required: false, default: 'pending' },
      { key: 'signal', type: 'string', size: 4096, required: false, default: '' },
      { key: 'intent', type: 'string', size: 128, required: false, default: '' },
      { key: 'plan', type: 'object', required: false },
      { key: 'result', type: 'object', required: false },
      { key: 'created_at', type: 'string', size: 64, required: false, default: '' },
      { key: 'completed_at', type: 'string', size: 64, required: false, default: null },
    ],
    indexes: [
      { key: 'idx_user_id', type: 'key', attrs: ['user_id'] },
    ],
  },
  agent_activity_steps: {
    attrs: [
      { key: 'run_id', type: 'string', size: 256, required: true },
      { key: 'step_type', type: 'string', size: 128, required: false, default: '' },
      { key: 'payload', type: 'object', required: false },
      { key: 'status', type: 'string', size: 64, required: false, default: 'pending' },
      { key: 'created_at', type: 'string', size: 64, required: false, default: '' },
    ],
    indexes: [
      { key: 'idx_run_id', type: 'key', attrs: ['run_id'] },
    ],
  },
  repo_registrations: {
    attrs: [
      { key: 'user_id', type: 'string', size: 256, required: true },
      { key: 'repo_id', type: 'string', size: 512, required: true },
      { key: 'repo_name', type: 'string', size: 512, required: false, default: '' },
      { key: 'repo_url', type: 'string', size: 1024, required: false, default: '' },
      { key: 'status', type: 'string', size: 64, required: false, default: 'registered' },
      { key: 'metadata', type: 'object', required: false },
      { key: 'created_at', type: 'string', size: 64, required: false, default: '' },
      { key: 'updated_at', type: 'string', size: 64, required: false, default: '' },
    ],
    indexes: [
      { key: 'idx_user_id', type: 'key', attrs: ['user_id'] },
    ],
  },
  insight_events: {
    attrs: [
      { key: 'user_id', type: 'string', size: 256, required: true },
      { key: 'type', type: 'string', size: 128, required: false, default: '' },
      { key: 'title', type: 'string', size: 512, required: false, default: '' },
      { key: 'description', type: 'string', size: 4096, required: false, default: '' },
      { key: 'severity', type: 'string', size: 64, required: false, default: 'info' },
      { key: 'payload', type: 'object', required: false },
      { key: 'created_at', type: 'string', size: 64, required: false, default: '' },
    ],
    indexes: [
      { key: 'idx_user_id', type: 'key', attrs: ['user_id'] },
    ],
  },
  source_connections: {
    attrs: [
      { key: 'user_id', type: 'string', size: 256, required: false, default: '' },
      { key: 'workspace_id', type: 'string', size: 256, required: false, default: '' },
      { key: 'source_type', type: 'string', size: 64, required: true },
      { key: 'source_id', type: 'string', size: 256, required: false, default: '' },
      { key: 'display_name', type: 'string', size: 256, required: false, default: '' },
      { key: 'status', type: 'string', size: 64, required: false, default: 'connected' },
      { key: 'scopes', type: 'string', elements: true, required: false },
      { key: 'metadata', type: 'object', required: false },
      { key: 'connected_at', type: 'string', size: 64, required: false, default: '' },
      { key: 'last_sync_at', type: 'string', size: 64, required: false, default: null },
      { key: 'created_at', type: 'string', size: 64, required: false, default: '' },
      { key: 'updated_at', type: 'string', size: 64, required: false, default: '' },
    ],
    indexes: [
      { key: 'idx_workspace_id', type: 'key', attrs: ['workspace_id'] },
      { key: 'idx_user_id', type: 'key', attrs: ['user_id'] },
      { key: 'idx_source_type', type: 'key', attrs: ['source_type'] },
      { key: 'idx_workspace_source', type: 'key', attrs: ['workspace_id', 'source_type'] },
    ],
  },
  source_sync_jobs: {
    attrs: [
      { key: 'source_connection_id', type: 'string', size: 256, required: true },
      { key: 'workspace_id', type: 'string', size: 256, required: false, default: '' },
      { key: 'status', type: 'string', size: 64, required: false, default: 'pending' },
      { key: 'items_synced', type: 'integer', required: false, default: 0 },
      { key: 'items_failed', type: 'integer', required: false, default: 0 },
      { key: 'error_message', type: 'string', size: 2048, required: false, default: '' },
      { key: 'started_at', type: 'string', size: 64, required: false, default: '' },
      { key: 'completed_at', type: 'string', size: 64, required: false, default: null },
      { key: 'created_at', type: 'string', size: 64, required: false, default: '' },
    ],
    indexes: [
      { key: 'idx_source_connection_id', type: 'key', attrs: ['source_connection_id'] },
      { key: 'idx_workspace_id', type: 'key', attrs: ['workspace_id'] },
    ],
  },
  source_artifacts: {
    attrs: [
      { key: 'source_connection_id', type: 'string', size: 256, required: true },
      { key: 'workspace_id', type: 'string', size: 256, required: false, default: '' },
      { key: 'artifact_type', type: 'string', size: 128, required: false, default: '' },
      { key: 'external_id', type: 'string', size: 512, required: false, default: '' },
      { key: 'title', type: 'string', size: 1024, required: false, default: '' },
      { key: 'content', type: 'string', size: 65536, required: false, default: '' },
      { key: 'metadata', type: 'object', required: false },
      { key: 'synced_at', type: 'string', size: 64, required: false, default: '' },
      { key: 'created_at', type: 'string', size: 64, required: false, default: '' },
      { key: 'updated_at', type: 'string', size: 64, required: false, default: '' },
    ],
    indexes: [
      { key: 'idx_source_connection_id', type: 'key', attrs: ['source_connection_id'] },
      { key: 'idx_workspace_id', type: 'key', attrs: ['workspace_id'] },
    ],
  },
  source_connection_events: {
    attrs: [
      { key: 'source_connection_id', type: 'string', size: 256, required: true },
      { key: 'event_type', type: 'string', size: 128, required: false, default: '' },
      { key: 'description', type: 'string', size: 2048, required: false, default: '' },
      { key: 'payload', type: 'object', required: false },
      { key: 'created_at', type: 'string', size: 64, required: false, default: '' },
    ],
    indexes: [
      { key: 'idx_source_connection_id', type: 'key', attrs: ['source_connection_id'] },
    ],
  },
  billing: {
    attrs: [
      { key: 'user_id', type: 'string', size: 256, required: true },
      { key: 'plan', type: 'string', size: 64, required: false, default: 'free' },
      { key: 'status', type: 'string', size: 64, required: false, default: 'active' },
      { key: 'period_start', type: 'string', size: 64, required: false, default: '' },
      { key: 'period_end', type: 'string', size: 64, required: false, default: '' },
      { key: 'metadata', type: 'object', required: false },
      { key: 'created_at', type: 'string', size: 64, required: false, default: '' },
      { key: 'updated_at', type: 'string', size: 64, required: false, default: '' },
    ],
    indexes: [
      { key: 'idx_user_id', type: 'key', attrs: ['user_id'] },
    ],
  },
  skills: {
    attrs: [
      { key: 'skill_key', type: 'string', size: 256, required: true },
      { key: 'name', type: 'string', size: 256, required: true },
      { key: 'category', type: 'string', size: 128, required: false, default: 'general' },
      { key: 'version', type: 'string', size: 64, required: false, default: '1.0.0' },
      { key: 'enabled', type: 'boolean', required: false, default: true },
      { key: 'metadata', type: 'object', required: false },
      { key: 'created_at', type: 'string', size: 64, required: false, default: '' },
      { key: 'updated_at', type: 'string', size: 64, required: false, default: '' },
    ],
    indexes: [
      { key: 'idx_skill_key', type: 'key', attrs: ['skill_key'] },
      { key: 'idx_category', type: 'key', attrs: ['category'] },
    ],
  },
};

// ── Storage buckets ─────────────────────────────────────────────────────────
const BUCKETS = [
  { id: 'profile_images', name: 'Profile Images' },
  { id: 'workspace_images', name: 'Workspace Images' },
];

// ── Helper: create attribute ────────────────────────────────────────────────
async function createAttr(dbId, colId, attr) {
  const { key, type, size, required, default: def, elements } = attr;
  const isRequired = required === true;
  try {
    switch (type) {
      case 'string':
        if (elements) {
          await databases.createStringAttribute(dbId, colId, key, size || 256, isRequired, undefined, true);
        } else if (def === null || def === undefined) {
          await databases.createStringAttribute(dbId, colId, key, size || 256, isRequired);
        } else {
          await databases.createStringAttribute(dbId, colId, key, size || 256, isRequired, String(def));
        }
        break;
      case 'integer':
        await databases.createIntegerAttribute(dbId, colId, key, isRequired, def != null ? Number(def) : undefined);
        break;
      case 'double':
        await databases.createFloatAttribute(dbId, colId, key, isRequired, def != null ? Number(def) : undefined);
        break;
      case 'boolean':
        await databases.createBooleanAttribute(dbId, colId, key, isRequired, def != null ? Boolean(def) : undefined);
        break;
      case 'object':
        // Appwrite Databases stores structured app payloads as text here.
        // The backend adapter JSON-serializes/deserializes these fields.
        await databases.createTextAttribute(dbId, colId, key, isRequired);
        break;
      default:
        console.warn(`  Unknown attribute type: ${type} for ${key}`);
        return;
    }
    await sleep(300);
  } catch (err) {
    if (err?.code === 409 || err?.message?.includes('already exists')) {
      console.log(`  [skip] ${key} already exists`);
    } else {
      console.warn(`  [warn] ${key}: ${err?.message || err}`);
    }
  }
}

// ── Helper: create index ────────────────────────────────────────────────────
async function createIdx(dbId, colId, idx) {
  try {
    const orders = idx.attrs.map(() => 'ASC');
    await databases.createIndex(dbId, colId, idx.key, idx.type, idx.attrs, orders);
    console.log(`  [idx] ${idx.key}`);
    await sleep(200);
  } catch (err) {
    if (err?.code === 409 || err?.message?.includes('already exists')) {
      console.log(`  [skip] index ${idx.key} already exists`);
    } else {
      console.warn(`  [warn] index ${idx.key}: ${err?.message || err}`);
    }
  }
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n=== Velocity Brain Appwrite Setup ===`);
  console.log(`Endpoint: ${endpoint}`);
  console.log(`Project:  ${projectId}`);
  console.log(`Database: ${databaseId}\n`);

  // 1. Ensure database exists
  try {
    await databases.get(databaseId);
    console.log(`[OK] Database "${databaseId}" exists\n`);
  } catch (err) {
    if (err?.code === 404) {
      console.log(`Creating database "${databaseId}"...`);
      await databases.create(databaseId, 'Velocity Brain');
      console.log(`[OK] Database created\n`);
      await sleep(1000);
    } else {
      throw err;
    }
  }

  // 2. Create collections
  const colNames = Object.keys(COLLECTIONS);
  console.log(`Creating ${colNames.length} collections...\n`);

  for (const colId of colNames) {
    const col = COLLECTIONS[colId];
    let exists = false;
    try {
      await databases.getCollection(databaseId, colId);
      exists = true;
      console.log(`[OK] ${colId} (exists)`);
    } catch (err) {
      if (err?.code === 404) {
        // Create with open permissions — auth is handled at the application layer
        await databases.createCollection(
          databaseId,
          colId,
          colId.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
          [
            Permission.read(Role.any()),
            Permission.write(Role.any()),
            Permission.create(Role.any()),
            Permission.update(Role.any()),
            Permission.delete(Role.any()),
          ]
        );
        console.log(`[+] ${colId} created`);
        await sleep(500);
      } else {
        console.error(`[ERR] ${colId}: ${err?.message || err}`);
        continue;
      }
    }

    // Create attributes
    for (const attr of col.attrs) {
      await createAttr(databaseId, colId, attr);
    }

    // Wait for attributes to be provisioned before creating indexes
    if (!exists) {
      await sleep(1500);
    }

    // Create indexes
    for (const idx of col.indexes) {
      await createIdx(databaseId, colId, idx);
    }
    console.log('');
  }

  // 3. Create storage buckets
  console.log(`Creating ${BUCKETS.length} storage buckets...\n`);
  for (const bucket of BUCKETS) {
    try {
      await storage.getBucket(bucket.id);
      console.log(`[OK] Bucket "${bucket.name}" (${bucket.id}) exists`);
    } catch (err) {
      if (err?.code === 404) {
        await storage.createBucket(
          bucket.id,        // bucketId
          bucket.name,      // name
          [                 // permissions
            Permission.read(Role.any()),
            Permission.write(Role.any()),
            Permission.create(Role.any()),
            Permission.update(Role.any()),
            Permission.delete(Role.any()),
          ],
          false,  // fileSecurity
          true,   // enabled
          5 * 1024 * 1024,  // maximumFileSize (5MB)
          ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml'] // allowedFileExtensions
        );
        console.log(`[+] Bucket "${bucket.name}" (${bucket.id}) created`);
      } else {
        console.warn(`[warn] Bucket ${bucket.id}: ${err?.message || err}`);
      }
    }
  }

  // 4. Verify connection
  console.log('\n=== Verification ===');
  try {
    const { Query } = require(path.join(backendDir, 'node_modules', 'node-appwrite'));
    const result = await databases.listDocuments(databaseId, 'users', [Query.limit(1)]);
    console.log(`[OK] Query on "users" collection succeeded (${result.total} docs)`);
  } catch (err) {
    console.warn(`[warn] Query test: ${err?.message || err}`);
  }

  console.log('\n=== Setup Complete ===');
  console.log('You can now start the backend: cd backend && npm start\n');
}

main().catch((err) => {
  console.error('Setup failed:', err?.message || err);
  process.exit(1);
});
