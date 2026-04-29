-- Additional constraints and indexes for production readiness
-- This file should be applied after the main schema.sql

-- Add CHECK constraints for data integrity
ALTER TABLE entities 
ADD CONSTRAINT chk_entities_access_level 
CHECK (access_level IN ('private', 'restricted', 'public'));

ALTER TABLE entities 
ADD CONSTRAINT chk_entities_confidence 
CHECK (confidence >= 0.0 AND confidence <= 1.0);

ALTER TABLE entity_versions 
ADD CONSTRAINT chk_entity_versions_confidence_before 
CHECK (confidence_before >= 0.0 AND confidence_before <= 1.0);

ALTER TABLE entity_versions 
ADD CONSTRAINT chk_entity_versions_confidence_after 
CHECK (confidence_after >= 0.0 AND confidence_after <= 1.0);

ALTER TABLE facts 
ADD CONSTRAINT chk_facts_confidence 
CHECK (confidence >= 0.0 AND confidence <= 1.0);

ALTER TABLE relationships 
ADD CONSTRAINT chk_relationships_strength 
CHECK (strength >= 0.0 AND strength <= 1.0);

ALTER TABLE insights 
ADD CONSTRAINT chk_insights_confidence 
CHECK (confidence >= 0.0 AND confidence <= 1.0);

-- Add NOT NULL constraints where missing
ALTER TABLE entities 
ALTER COLUMN type SET NOT NULL;

ALTER TABLE entities 
ALTER COLUMN title SET NOT NULL;

ALTER TABLE timeline_events 
ALTER COLUMN event_ts SET NOT NULL;

ALTER TABLE timeline_events 
ALTER COLUMN source_type SET NOT NULL;

ALTER TABLE timeline_events 
ALTER COLUMN event_md SET NOT NULL;

-- Add additional indexes for performance
CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(type);
CREATE INDEX IF NOT EXISTS idx_entities_slug ON entities(slug);
CREATE INDEX IF NOT EXISTS idx_entities_access_level ON entities(access_level);
CREATE INDEX IF NOT EXISTS idx_entities_created_at ON entities(created_at);
CREATE INDEX IF NOT EXISTS idx_entities_updated_at ON entities(updated_at);

CREATE INDEX IF NOT EXISTS idx_timeline_events_entity_id ON timeline_events(entity_id);
CREATE INDEX IF NOT EXISTS idx_timeline_events_event_ts ON timeline_events(event_ts);
CREATE INDEX IF NOT EXISTS idx_timeline_events_source_type ON timeline_events(source_type);

CREATE INDEX IF NOT EXISTS idx_entity_versions_entity_id ON entity_versions(entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_versions_created_at ON entity_versions(created_at);

CREATE INDEX IF NOT EXISTS idx_facts_entity_id ON facts(entity_id);
CREATE INDEX IF NOT EXISTS idx_facts_key ON facts(key);
CREATE INDEX IF NOT EXISTS idx_facts_observed_at ON facts(observed_at);
CREATE INDEX IF NOT EXISTS idx_facts_valid_to ON facts(valid_to);

CREATE INDEX IF NOT EXISTS idx_embeddings_entity_id ON embeddings(entity_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_chunk_type ON embeddings(chunk_type);
CREATE INDEX IF NOT EXISTS idx_embeddings_created_at ON embeddings(created_at);
CREATE INDEX IF NOT EXISTS idx_embeddings_vector ON embeddings USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_relationships_from_entity ON relationships(from_entity_id);
CREATE INDEX IF NOT EXISTS idx_relationships_to_entity ON relationships(to_entity_id);
CREATE INDEX IF NOT EXISTS idx_relationships_type ON relationships(relation_type);
CREATE INDEX IF NOT EXISTS idx_relationships_strength ON relationships(strength);
CREATE INDEX IF NOT EXISTS idx_relationships_first_seen ON relationships(first_seen);
CREATE INDEX IF NOT EXISTS idx_relationships_last_seen ON relationships(last_seen);

CREATE INDEX IF NOT EXISTS idx_skills_category ON skills(category);
CREATE INDEX IF NOT EXISTS idx_skills_enabled ON skills(enabled);
CREATE INDEX IF NOT EXISTS idx_skills_created_at ON skills(created_at);

CREATE INDEX IF NOT EXISTS idx_agent_runs_status ON agent_runs(status);
CREATE INDEX IF NOT EXISTS idx_agent_runs_created_at ON agent_runs(created_at);
CREATE INDEX IF NOT EXISTS idx_agent_runs_completed_at ON agent_runs(completed_at);

CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_due_at ON tasks(due_at);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);

CREATE INDEX IF NOT EXISTS idx_execution_actions_run_id ON execution_actions(run_id);
CREATE INDEX IF NOT EXISTS idx_execution_actions_action_type ON execution_actions(action_type);
CREATE INDEX IF NOT EXISTS idx_execution_actions_status ON execution_actions(status);
CREATE INDEX IF NOT EXISTS idx_execution_actions_created_at ON execution_actions(created_at);

CREATE INDEX IF NOT EXISTS idx_optimization_jobs_enabled ON optimization_jobs(enabled);
CREATE INDEX IF NOT EXISTS idx_optimization_jobs_last_run_at ON optimization_jobs(last_run_at);

CREATE INDEX IF NOT EXISTS idx_insights_type ON insights(insight_type);
CREATE INDEX IF NOT EXISTS idx_insights_created_at ON insights(created_at);

CREATE INDEX IF NOT EXISTS idx_user_context_updated_at ON user_context(updated_at);

CREATE INDEX IF NOT EXISTS idx_audit_events_event_type ON audit_events(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_events_actor ON audit_events(actor);
CREATE INDEX IF NOT EXISTS idx_audit_events_created_at ON audit_events(created_at);

CREATE INDEX IF NOT EXISTS idx_plugins_enabled ON plugins(enabled);
CREATE INDEX IF NOT EXISTS idx_plugins_installed_at ON plugins(installed_at);

-- Add composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_entities_type_access_level ON entities(type, access_level);
CREATE INDEX IF NOT EXISTS idx_timeline_events_entity_ts ON timeline_events(entity_id, event_ts);
CREATE INDEX IF NOT EXISTS idx_facts_entity_key ON facts(entity_id, key);
CREATE INDEX IF NOT EXISTS idx_relationships_from_type ON relationships(from_entity_id, relation_type);
CREATE INDEX IF NOT EXISTS idx_relationships_to_type ON relationships(to_entity_id, relation_type);
CREATE INDEX IF NOT EXISTS idx_agent_runs_status_created ON agent_runs(status, created_at);
CREATE INDEX IF NOT EXISTS idx_tasks_status_due ON tasks(status, due_at);

-- Add partial indexes for common filtered queries
CREATE INDEX IF NOT EXISTS idx_entities_public ON entities(id) WHERE access_level = 'public';
CREATE INDEX IF NOT EXISTS idx_entities_private ON entities(id) WHERE access_level = 'private';
CREATE INDEX IF NOT EXISTS idx_entities_restricted ON entities(id) WHERE access_level = 'restricted';

CREATE INDEX IF NOT EXISTS idx_agent_runs_active ON agent_runs(id) WHERE status IN ('running', 'pending');
CREATE INDEX IF NOT EXISTS idx_tasks_pending ON tasks(id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_tasks_overdue ON tasks(due_at) WHERE status = 'pending';

-- Add foreign key constraints if missing
ALTER TABLE entity_versions 
ADD CONSTRAINT fk_entity_versions_entity 
FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE;

ALTER TABLE timeline_events 
ADD CONSTRAINT fk_timeline_events_entity 
FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE;

ALTER TABLE facts 
ADD CONSTRAINT fk_facts_entity 
FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE;

ALTER TABLE embeddings 
ADD CONSTRAINT fk_embeddings_entity 
FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE;

ALTER TABLE relationships 
ADD CONSTRAINT fk_relationships_from_entity 
FOREIGN KEY (from_entity_id) REFERENCES entities(id) ON DELETE CASCADE;

ALTER TABLE relationships 
ADD CONSTRAINT fk_relationships_to_entity 
FOREIGN KEY (to_entity_id) REFERENCES entities(id) ON DELETE CASCADE;

ALTER TABLE execution_actions 
ADD CONSTRAINT fk_execution_actions_run 
FOREIGN KEY (run_id) REFERENCES agent_runs(id) ON DELETE SET NULL;

-- Add unique constraints for data integrity
ALTER TABLE entities 
ADD CONSTRAINT uk_entities_slug 
UNIQUE (slug);

ALTER TABLE skills 
ADD CONSTRAINT uk_skills_skill_key 
UNIQUE (skill_key);

ALTER TABLE agent_runs 
ADD CONSTRAINT uk_agent_runs_run_id 
UNIQUE (run_id);

ALTER TABLE tasks 
ADD CONSTRAINT uk_tasks_task_key 
UNIQUE (task_key);

ALTER TABLE optimization_jobs 
ADD CONSTRAINT uk_optimization_jobs_job_name 
UNIQUE (job_name);

ALTER TABLE user_context 
ADD CONSTRAINT uk_user_context_user_key 
UNIQUE (user_key);

ALTER TABLE plugins 
ADD CONSTRAINT uk_plugins_plugin_key 
UNIQUE (plugin_key);

-- Add trigger for updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_entities_updated_at 
BEFORE UPDATE ON entities 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_skills_updated_at 
BEFORE UPDATE ON skills 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at 
BEFORE UPDATE ON tasks 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_context_updated_at 
BEFORE UPDATE ON user_context 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add trigger for relationship last_seen
CREATE OR REPLACE FUNCTION update_relationship_last_seen()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_seen = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_relationships_last_seen 
BEFORE UPDATE ON relationships 
FOR EACH ROW EXECUTE FUNCTION update_relationship_last_seen();
