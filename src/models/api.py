from pydantic import BaseModel, Field, ConfigDict
from typing import Any


class ActorContext(BaseModel):
    actor: str = 'system'
    role: str = 'owner'
    org_key: str | None = None


class IngestTextRequest(ActorContext):
    source: str
    content: str
    access_level: str = 'private'


class OrgIngestRequest(ActorContext):
    source: str = 'org'
    content: str
    access_level: str = 'private'


class QueryRequest(ActorContext):
    question: str
    limit: int = 10


class AgentRunRequest(ActorContext):
    signal: str


class MultimodalIngestRequest(ActorContext):
    source: str
    modality: str
    content: str
    metadata: dict[str, Any] = Field(default_factory=dict)
    access_level: str = 'private'


class EntityResponse(BaseModel):
    slug: str
    type: str
    title: str
    compiled_truth_md: str
    confidence: float
    timeline: list[dict[str, Any]] = Field(default_factory=list)


class QueryResponse(BaseModel):
    answer: str
    confidence: float
    references: list[dict[str, Any]]
    reasoning_summary: str


class AgentRunResponse(BaseModel):
    run_id: str
    status: str
    intent: str
    plan: list[dict[str, Any]]
    actions: list[dict[str, Any]]
    memory_updates: list[dict[str, Any]]
    confidence: float


class PredictRequest(ActorContext):
    subject: str
    horizon_days: int = 30


class SimulateRequest(ActorContext):
    scenario: str
    options: list[str] = Field(default_factory=list)


class DecideRequest(ActorContext):
    decision: str
    options: list[str]
    constraints: dict[str, Any] = Field(default_factory=dict)


class CollaborateRequest(ActorContext):
    objective: str
    agents: list[str] = Field(default_factory=lambda: ['researcher', 'planner', 'executor'])


class CommandRequest(ActorContext):
    command: str


class WorkflowExecuteRequest(ActorContext):
    workflow_key: str
    payload: dict[str, Any] = Field(default_factory=dict)


class SyncRequest(ActorContext):
    repos: list[str] = Field(default_factory=list)
    dry_run: bool = True


class EvalQueryRequest(ActorContext):
    model_config = ConfigDict(extra='forbid')
    question: str
    expected_slugs: list[str] = Field(default_factory=list)
    k: int = 5


class EvalBenchmarkCase(BaseModel):
    question: str
    expected_slugs: list[str] = Field(default_factory=list)
    seed_content: str | None = None
    source: str = 'benchmark'


class AccessTokenRequest(BaseModel):
    actor: str
    scopes: list[str] = Field(default_factory=list)
    ttl_seconds: int = 3600


class LegacyPlanRequest(BaseModel):
    owner: str
    beneficiaries: list[str] = Field(default_factory=list)
    instructions: str


class ConnectorDispatchRequest(ActorContext):
    connector: str
    action: str
    payload: dict[str, Any] = Field(default_factory=dict)


class UnifiedSyncRequest(ActorContext):
    objective: str
    connectors: list[str] = Field(default_factory=list)


class BackupExportRequest(ActorContext):
    file_path: str | None = None
    tables: list[str] = Field(default_factory=list)


class BackupImportRequest(ActorContext):
    file_path: str


class QueueEnqueueRequest(ActorContext):
    kind: str
    payload: dict[str, Any] = Field(default_factory=dict)
    max_retries: int = 3


class QueueProcessRequest(ActorContext):
    limit: int = 1


class RetentionRequest(ActorContext):
    retention_days: int = 90


class MeetingCopilotRequest(ActorContext):
    transcript: str


class DigestRequest(ActorContext):
    period: str = 'weekly'


class PlaybookCreateRequest(ActorContext):
    signal: str
    steps: list[dict[str, Any]] = Field(default_factory=list)


class PlaybookExecuteRequest(ActorContext):
    playbook: dict[str, Any]
    approve: bool = False
