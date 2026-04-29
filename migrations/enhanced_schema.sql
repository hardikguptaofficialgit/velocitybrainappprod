-- Enhanced Schema for Advanced VelocityBrain Features
-- Add tables for codebase indexing, call graphs, multi-agent collaboration, and context optimization

-- Code Elements Table
CREATE TABLE IF NOT EXISTS code_elements (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    language VARCHAR(50) NOT NULL,
    file_path TEXT NOT NULL,
    start_line INTEGER NOT NULL,
    end_line INTEGER NOT NULL,
    start_column INTEGER NOT NULL,
    end_column INTEGER NOT NULL,
    docstring TEXT,
    signature TEXT,
    parent_id VARCHAR(64),
    children_ids JSONB,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Code Relationships Table
CREATE TABLE IF NOT EXISTS code_relationships (
    source_id VARCHAR(64) NOT NULL,
    target_id VARCHAR(64) NOT NULL,
    relationship_type VARCHAR(50) NOT NULL,
    context TEXT,
    confidence FLOAT DEFAULT 1.0,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (source_id, target_id, relationship_type)
);

-- Agents Table for Multi-Agent Collaboration
CREATE TABLE IF NOT EXISTS agents (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    capabilities JSONB,
    status VARCHAR(50) DEFAULT 'active',
    last_active TIMESTAMP WITH TIME ZONE,
    metadata JSONB,
    context_sharing_enabled BOOLEAN DEFAULT TRUE,
    max_concurrent_tasks INTEGER DEFAULT 3,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Collaborative Tasks Table
CREATE TABLE IF NOT EXISTS collaborative_tasks (
    id VARCHAR(64) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    coordinator_id VARCHAR(64) NOT NULL REFERENCES agents(id),
    participants JSONB NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    priority INTEGER DEFAULT 5,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deadline TIMESTAMP WITH TIME ZONE,
    context_requirements JSONB,
    shared_context JSONB,
    subtasks JSONB,
    metadata JSONB
);

-- Context Shares Table
CREATE TABLE IF NOT EXISTS context_shares (
    id VARCHAR(64) PRIMARY KEY,
    source_agent_id VARCHAR(64) NOT NULL REFERENCES agents(id),
    target_agent_ids JSONB NOT NULL,
    context_type VARCHAR(50) NOT NULL,
    content JSONB NOT NULL,
    relevance_score FLOAT DEFAULT 1.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    access_count INTEGER DEFAULT 0,
    metadata JSONB
);

-- Agent Messages Table
CREATE TABLE IF NOT EXISTS agent_messages (
    id VARCHAR(64) PRIMARY KEY,
    from_agent_id VARCHAR(64) NOT NULL REFERENCES agents(id),
    to_agent_id VARCHAR(64) NOT NULL REFERENCES agents(id),
    message_type VARCHAR(50) NOT NULL,
    content JSONB NOT NULL,
    priority INTEGER DEFAULT 5,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    delivered BOOLEAN DEFAULT FALSE,
    read BOOLEAN DEFAULT FALSE,
    metadata JSONB
);

-- Compression Cache Table
CREATE TABLE IF NOT EXISTS compression_cache (
    cache_key VARCHAR(128) PRIMARY KEY,
    original_content_hash VARCHAR(64) NOT NULL,
    compressed_content TEXT NOT NULL,
    original_tokens INTEGER NOT NULL,
    compressed_tokens INTEGER NOT NULL,
    compression_ratio FLOAT NOT NULL,
    quality_score FLOAT NOT NULL,
    method_used VARCHAR(50) NOT NULL,
    compression_time_ms FLOAT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    access_count INTEGER DEFAULT 0,
    metadata JSONB
);

-- Context Query Cache Table
CREATE TABLE IF NOT EXISTS context_query_cache (
    query_hash VARCHAR(64) PRIMARY KEY,
    query_text TEXT NOT NULL,
    result JSONB NOT NULL,
    total_found INTEGER NOT NULL,
    search_time_ms FLOAT NOT NULL,
    confidence_score FLOAT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    access_count INTEGER DEFAULT 0,
    expires_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB
);

-- Indexes for Code Elements
CREATE INDEX IF NOT EXISTS idx_code_elements_name ON code_elements(name);
CREATE INDEX IF NOT EXISTS idx_code_elements_type ON code_elements(type);
CREATE INDEX IF NOT EXISTS idx_code_elements_language ON code_elements(language);
CREATE INDEX IF NOT EXISTS idx_code_elements_file_path ON code_elements(file_path);
CREATE INDEX IF NOT EXISTS idx_code_elements_parent_id ON code_elements(parent_id);
CREATE INDEX IF NOT EXISTS idx_code_elements_created_at ON code_elements(created_at);

-- Indexes for Code Relationships
CREATE INDEX IF NOT EXISTS idx_code_relationships_source_id ON code_relationships(source_id);
CREATE INDEX IF NOT EXISTS idx_code_relationships_target_id ON code_relationships(target_id);
CREATE INDEX IF NOT EXISTS idx_code_relationships_type ON code_relationships(relationship_type);
CREATE INDEX IF NOT EXISTS idx_code_relationships_confidence ON code_relationships(confidence);

-- Indexes for Agents
CREATE INDEX IF NOT EXISTS idx_agents_role ON agents(role);
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
CREATE INDEX IF NOT EXISTS idx_agents_last_active ON agents(last_active);

-- Indexes for Collaborative Tasks
CREATE INDEX IF NOT EXISTS idx_collaborative_tasks_coordinator_id ON collaborative_tasks(coordinator_id);
CREATE INDEX IF NOT EXISTS idx_collaborative_tasks_status ON collaborative_tasks(status);
CREATE INDEX IF NOT EXISTS idx_collaborative_tasks_priority ON collaborative_tasks(priority);
CREATE INDEX IF NOT EXISTS idx_collaborative_tasks_created_at ON collaborative_tasks(created_at);
CREATE INDEX IF NOT EXISTS idx_collaborative_tasks_participants ON collaborative_tasks USING GIN(participants);

-- Indexes for Context Shares
CREATE INDEX IF NOT EXISTS idx_context_shares_source_agent_id ON context_shares(source_agent_id);
CREATE INDEX IF NOT EXISTS idx_context_shares_target_agent_ids ON context_shares USING GIN(target_agent_ids);
CREATE INDEX IF NOT EXISTS idx_context_shares_context_type ON context_shares(context_type);
CREATE INDEX IF NOT EXISTS idx_context_shares_relevance_score ON context_shares(relevance_score);
CREATE INDEX IF NOT EXISTS idx_context_shares_created_at ON context_shares(created_at);
CREATE INDEX IF NOT EXISTS idx_context_shares_expires_at ON context_shares(expires_at);

-- Indexes for Agent Messages
CREATE INDEX IF NOT EXISTS idx_agent_messages_from_agent_id ON agent_messages(from_agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_messages_to_agent_id ON agent_messages(to_agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_messages_message_type ON agent_messages(message_type);
CREATE INDEX IF NOT EXISTS idx_agent_messages_priority ON agent_messages(priority);
CREATE INDEX IF NOT EXISTS idx_agent_messages_created_at ON agent_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_agent_messages_read ON agent_messages(read);

-- Indexes for Compression Cache
CREATE INDEX IF NOT EXISTS idx_compression_cache_original_content_hash ON compression_cache(original_content_hash);
CREATE INDEX IF NOT EXISTS idx_compression_cache_method_used ON compression_cache(method_used);
CREATE INDEX IF NOT EXISTS idx_compression_cache_created_at ON compression_cache(created_at);
CREATE INDEX IF NOT EXISTS idx_compression_cache_accessed_at ON compression_cache(accessed_at);
CREATE INDEX IF NOT EXISTS idx_compression_cache_expires_at ON compression_cache(expires_at);

-- Indexes for Context Query Cache
CREATE INDEX IF NOT EXISTS idx_context_query_cache_created_at ON context_query_cache(created_at);
CREATE INDEX IF NOT EXISTS idx_context_query_cache_accessed_at ON context_query_cache(accessed_at);
CREATE INDEX IF NOT EXISTS idx_context_query_cache_expires_at ON context_query_cache(expires_at);

-- Triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to tables with updated_at columns
CREATE TRIGGER update_code_elements_updated_at BEFORE UPDATE ON code_elements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agents_updated_at BEFORE UPDATE ON agents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_collaborative_tasks_updated_at BEFORE UPDATE ON collaborative_tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to clean up expired data
CREATE OR REPLACE FUNCTION cleanup_expired_data()
RETURNS void AS $$
BEGIN
    -- Clean expired context shares
    DELETE FROM context_shares WHERE expires_at < NOW();
    
    -- Clean old messages (older than 7 days)
    DELETE FROM agent_messages WHERE created_at < NOW() - INTERVAL '7 days';
    
    -- Clean old compression cache entries (older than 24 hours)
    DELETE FROM compression_cache WHERE created_at < NOW() - INTERVAL '24 hours';
    
    -- Clean expired query cache entries
    DELETE FROM context_query_cache WHERE expires_at < NOW();
    
    RAISE NOTICE 'Expired data cleanup completed';
END;
$$ LANGUAGE plpgsql;

-- Views for common queries
CREATE OR REPLACE VIEW agent_task_summary AS
SELECT 
    a.id as agent_id,
    a.name as agent_name,
    a.role,
    COUNT(ct.id) as total_tasks,
    COUNT(CASE WHEN ct.status = 'pending' THEN 1 END) as pending_tasks,
    COUNT(CASE WHEN ct.status = 'in_progress' THEN 1 END) as active_tasks,
    COUNT(CASE WHEN ct.status = 'completed' THEN 1 END) as completed_tasks,
    MAX(ct.updated_at) as last_task_activity
FROM agents a
LEFT JOIN collaborative_tasks ct ON (a.id = ct.coordinator_id OR a.id = ANY(ct.participants))
GROUP BY a.id, a.name, a.role;

CREATE OR REPLACE VIEW code_statistics AS
SELECT 
    language,
    COUNT(*) as total_elements,
    COUNT(CASE WHEN type = 'function' THEN 1 END) as functions,
    COUNT(CASE WHEN type = 'class' THEN 1 END) as classes,
    COUNT(CASE WHEN type = 'method' THEN 1 END) as methods,
    COUNT(CASE WHEN type = 'variable' THEN 1 END) as variables,
    COUNT(DISTINCT file_path) as files_indexed,
    MAX(updated_at) as last_indexed
FROM code_elements
GROUP BY language;

CREATE OR REPLACE VIEW collaboration_metrics AS
SELECT 
    COUNT(DISTINCT a.id) as total_agents,
    COUNT(DISTINCT ct.id) as total_tasks,
    COUNT(DISTINCT cs.id) as total_context_shares,
    COUNT(DISTINCT am.id) as total_messages,
    COUNT(CASE WHEN ct.status = 'completed' THEN 1 END) as completed_tasks,
    AVG(CASE WHEN ct.status = 'completed' THEN 
        EXTRACT(EPOCH FROM (ct.updated_at - ct.created_at))/3600 
    END) as avg_task_completion_hours,
    COUNT(CASE WHEN a.last_active > NOW() - INTERVAL '1 hour' THEN 1 END) as active_agents
FROM agents a
LEFT JOIN collaborative_tasks ct ON 1=1
LEFT JOIN context_shares cs ON 1=1
LEFT JOIN agent_messages am ON 1=1;

-- Grant permissions (adjust as needed for your setup)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO velocity_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO velocity_user;

COMMIT;
