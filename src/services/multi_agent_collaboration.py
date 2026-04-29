"""
Multi-Agent Collaboration System
Enables multiple AI agents to share context, coordinate actions, and collaborate on tasks
"""

import asyncio
import json
import uuid
from typing import Any, Dict, List, Set, Optional, Tuple
from dataclasses import dataclass, asdict
from datetime import datetime, timezone, timedelta
from enum import Enum
from collections import defaultdict, deque
import asyncio.locks

from src.core.db import get_conn
from src.core.logging_config import get_logger
from src.core.config import settings
from src.services.intelligent_context_engine import intelligent_context_engine


class AgentRole(Enum):
    """Roles that agents can play in collaboration"""
    COORDINATOR = "coordinator"
    SPECIALIST = "specialist"
    REVIEWER = "reviewer"
    EXECUTOR = "executor"
    OBSERVER = "observer"


class TaskStatus(Enum):
    """Status of collaborative tasks"""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class Agent:
    """Represents an AI agent in the collaboration system"""
    id: str
    name: str
    role: AgentRole
    capabilities: List[str]
    status: str
    last_active: datetime
    metadata: Dict[str, Any]
    context_sharing_enabled: bool = True
    max_concurrent_tasks: int = 3


@dataclass
class CollaborativeTask:
    """Represents a collaborative task involving multiple agents"""
    id: str
    title: str
    description: str
    coordinator_id: str
    participants: List[str]
    status: TaskStatus
    priority: int
    created_at: datetime
    updated_at: datetime
    deadline: Optional[datetime]
    context_requirements: List[str]
    shared_context: Dict[str, Any]
    subtasks: List[Dict[str, Any]]
    metadata: Dict[str, Any]


@dataclass
class ContextShare:
    """Represents shared context between agents"""
    id: str
    source_agent_id: str
    target_agent_ids: List[str]
    context_type: str
    content: Dict[str, Any]
    relevance_score: float
    created_at: datetime
    expires_at: Optional[datetime]
    access_count: int = 0
    metadata: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}


@dataclass
class AgentMessage:
    """Represents a message between agents"""
    id: str
    from_agent_id: str
    to_agent_id: str
    message_type: str
    content: Dict[str, Any]
    priority: int
    created_at: datetime
    delivered: bool = False
    read: bool = False
    metadata: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}


class MultiAgentCollaboration:
    """Manages collaboration between multiple AI agents"""
    
    def __init__(self):
        self.logger = get_logger('multi_agent_collaboration')
        self.agents: Dict[str, Agent] = {}
        self.tasks: Dict[str, CollaborativeTask] = {}
        self.context_shares: Dict[str, ContextShare] = {}
        self.messages: Dict[str, AgentMessage] = {}
        
        # Locks for thread safety
        self.agents_lock = asyncio.Lock()
        self.tasks_lock = asyncio.Lock()
        self.context_lock = asyncio.Lock()
        self.messages_lock = asyncio.Lock()
        
        # Configuration
        self.max_context_age_hours = 24
        self.max_message_age_hours = 72
        self.context_decay_threshold = 0.3
        
    async def register_agent(self, agent: Agent) -> bool:
        """Register a new agent in the collaboration system"""
        try:
            async with self.agents_lock:
                if agent.id in self.agents:
                    self.logger.warning(f"Agent {agent.id} already registered, updating...")
                
                self.agents[agent.id] = agent
                await self._persist_agent(agent)
                
                self.logger.info(f"Agent {agent.name} ({agent.role.value}) registered successfully")
                return True
                
        except Exception as e:
            self.logger.error(f"Failed to register agent {agent.id}: {e}")
            return False
    
    async def unregister_agent(self, agent_id: str) -> bool:
        """Unregister an agent from the collaboration system"""
        try:
            async with self.agents_lock:
                if agent_id not in self.agents:
                    self.logger.warning(f"Agent {agent_id} not found for unregistration")
                    return False
                
                agent = self.agents[agent_id]
                
                # Check if agent is coordinating any active tasks
                async with self.tasks_lock:
                    active_tasks = [
                        task for task in self.tasks.values()
                        if task.coordinator_id == agent_id and task.status in [TaskStatus.PENDING, TaskStatus.IN_PROGRESS]
                    ]
                    
                    if active_tasks:
                        self.logger.warning(f"Cannot unregister agent {agent_id} - coordinating {len(active_tasks)} active tasks")
                        return False
                
                del self.agents[agent_id]
                await self._remove_agent_from_db(agent_id)
                
                self.logger.info(f"Agent {agent_id} unregistered successfully")
                return True
                
        except Exception as e:
            self.logger.error(f"Failed to unregister agent {agent_id}: {e}")
            return False
    
    async def create_collaborative_task(self, title: str, description: str, coordinator_id: str,
                                     participants: List[str], priority: int = 5,
                                     deadline: Optional[datetime] = None,
                                     context_requirements: Optional[List[str]] = None) -> Optional[str]:
        """Create a new collaborative task"""
        try:
            # Validate coordinator
            async with self.agents_lock:
                if coordinator_id not in self.agents:
                    self.logger.error(f"Coordinator {coordinator_id} not found")
                    return None
                
                coordinator = self.agents[coordinator_id]
                if coordinator.role != AgentRole.COORDINATOR:
                    self.logger.error(f"Agent {coordinator_id} is not a coordinator")
                    return None
            
            # Validate participants
            async with self.agents_lock:
                for participant_id in participants:
                    if participant_id not in self.agents:
                        self.logger.error(f"Participant {participant_id} not found")
                        return None
            
            # Create task
            task_id = str(uuid.uuid4())
            task = CollaborativeTask(
                id=task_id,
                title=title,
                description=description,
                coordinator_id=coordinator_id,
                participants=participants,
                status=TaskStatus.PENDING,
                priority=priority,
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc),
                deadline=deadline,
                context_requirements=context_requirements or [],
                shared_context={},
                subtasks=[],
                metadata={}
            )
            
            async with self.tasks_lock:
                self.tasks[task_id] = task
                await self._persist_task(task)
            
            # Notify participants
            await self._notify_participants(task, "task_created")
            
            self.logger.info(f"Collaborative task '{title}' created with ID {task_id}")
            return task_id
            
        except Exception as e:
            self.logger.error(f"Failed to create collaborative task: {e}")
            return None
    
    async def assign_task_to_agent(self, task_id: str, agent_id: str, subtask_description: str) -> bool:
        """Assign a subtask to a specific agent"""
        try:
            async with self.tasks_lock:
                if task_id not in self.tasks:
                    self.logger.error(f"Task {task_id} not found")
                    return False
                
                task = self.tasks[task_id]
                
                if agent_id not in task.participants:
                    self.logger.error(f"Agent {agent_id} not in task participants")
                    return False
                
                # Create subtask
                subtask = {
                    'id': str(uuid.uuid4()),
                    'description': subtask_description,
                    'assigned_to': agent_id,
                    'status': TaskStatus.PENDING.value,
                    'created_at': datetime.now(timezone.utc).isoformat(),
                    'updated_at': datetime.now(timezone.utc).isoformat()
                }
                
                task.subtasks.append(subtask)
                task.updated_at = datetime.now(timezone.utc)
                task.status = TaskStatus.IN_PROGRESS
                
                await self._persist_task(task)
            
            # Notify the assigned agent
            await self._send_message(
                task.coordinator_id,
                agent_id,
                "subtask_assigned",
                {
                    'task_id': task_id,
                    'subtask': subtask
                },
                priority=7
            )
            
            self.logger.info(f"Subtask assigned to agent {agent_id} for task {task_id}")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to assign subtask: {e}")
            return False
    
    async def share_context(self, source_agent_id: str, target_agent_ids: List[str],
                          context_type: str, content: Dict[str, Any],
                          relevance_score: float = 1.0,
                          expires_hours: Optional[int] = None) -> Optional[str]:
        """Share context between agents"""
        try:
            # Validate source agent
            async with self.agents_lock:
                if source_agent_id not in self.agents:
                    self.logger.error(f"Source agent {source_agent_id} not found")
                    return None
                
                source_agent = self.agents[source_agent_id]
                if not source_agent.context_sharing_enabled:
                    self.logger.warning(f"Agent {source_agent_id} has context sharing disabled")
                    return None
            
            # Validate target agents
            async with self.agents_lock:
                for target_id in target_agent_ids:
                    if target_id not in self.agents:
                        self.logger.error(f"Target agent {target_id} not found")
                        return None
            
            # Create context share
            share_id = str(uuid.uuid4())
            expires_at = None
            if expires_hours:
                expires_at = datetime.now(timezone.utc) + timedelta(hours=expires_hours)
            
            context_share = ContextShare(
                id=share_id,
                source_agent_id=source_agent_id,
                target_agent_ids=target_agent_ids,
                context_type=context_type,
                content=content,
                relevance_score=relevance_score,
                created_at=datetime.now(timezone.utc),
                expires_at=expires_at
            )
            
            async with self.context_lock:
                self.context_shares[share_id] = context_share
                await self._persist_context_share(context_share)
            
            # Notify target agents
            for target_id in target_agent_ids:
                await self._send_message(
                    source_agent_id,
                    target_id,
                    "context_shared",
                    {
                        'share_id': share_id,
                        'context_type': context_type,
                        'relevance_score': relevance_score
                    },
                    priority=5
                )
            
            self.logger.info(f"Context shared from {source_agent_id} to {len(target_agent_ids)} agents")
            return share_id
            
        except Exception as e:
            self.logger.error(f"Failed to share context: {e}")
            return None
    
    async def get_shared_context(self, agent_id: str, context_type: Optional[str] = None,
                               min_relevance: float = 0.0) -> List[ContextShare]:
        """Get shared context for an agent"""
        try:
            relevant_shares = []
            
            async with self.context_lock:
                for share in self.context_shares.values():
                    # Check if agent is a target
                    if agent_id not in share.target_agent_ids:
                        continue
                    
                    # Check if expired
                    if share.expires_at and share.expires_at < datetime.now(timezone.utc):
                        continue
                    
                    # Check context type filter
                    if context_type and share.context_type != context_type:
                        continue
                    
                    # Check relevance threshold
                    if share.relevance_score < min_relevance:
                        continue
                    
                    # Update access count
                    share.access_count += 1
                    relevant_shares.append(share)
            
            # Sort by relevance and creation time
            relevant_shares.sort(key=lambda x: (x.relevance_score, x.created_at), reverse=True)
            
            return relevant_shares
            
        except Exception as e:
            self.logger.error(f"Failed to get shared context for agent {agent_id}: {e}")
            return []
    
    async def send_agent_message(self, from_agent_id: str, to_agent_id: str,
                               message_type: str, content: Dict[str, Any],
                               priority: int = 5) -> Optional[str]:
        """Send a message from one agent to another"""
        try:
            # Validate agents
            async with self.agents_lock:
                if from_agent_id not in self.agents:
                    self.logger.error(f"Sender agent {from_agent_id} not found")
                    return None
                
                if to_agent_id not in self.agents:
                    self.logger.error(f"Receiver agent {to_agent_id} not found")
                    return None
            
            return await self._send_message(from_agent_id, to_agent_id, message_type, content, priority)
            
        except Exception as e:
            self.logger.error(f"Failed to send agent message: {e}")
            return None
    
    async def _send_message(self, from_agent_id: str, to_agent_id: str,
                          message_type: str, content: Dict[str, Any],
                          priority: int) -> Optional[str]:
        """Internal message sending implementation"""
        try:
            message_id = str(uuid.uuid4())
            message = AgentMessage(
                id=message_id,
                from_agent_id=from_agent_id,
                to_agent_id=to_agent_id,
                message_type=message_type,
                content=content,
                priority=priority,
                created_at=datetime.now(timezone.utc)
            )
            
            async with self.messages_lock:
                self.messages[message_id] = message
                await self._persist_message(message)
            
            return message_id
            
        except Exception as e:
            self.logger.error(f"Failed to send message: {e}")
            return None
    
    async def get_agent_messages(self, agent_id: str, unread_only: bool = False,
                               message_type: Optional[str] = None) -> List[AgentMessage]:
        """Get messages for an agent"""
        try:
            messages = []
            
            async with self.messages_lock:
                for message in self.messages.values():
                    if message.to_agent_id != agent_id:
                        continue
                    
                    if unread_only and message.read:
                        continue
                    
                    if message_type and message.message_type != message_type:
                        continue
                    
                    messages.append(message)
            
            # Sort by priority and creation time
            messages.sort(key=lambda x: (x.priority, x.created_at), reverse=True)
            
            return messages
            
        except Exception as e:
            self.logger.error(f"Failed to get messages for agent {agent_id}: {e}")
            return []
    
    async def mark_message_read(self, message_id: str) -> bool:
        """Mark a message as read"""
        try:
            async with self.messages_lock:
                if message_id not in self.messages:
                    return False
                
                self.messages[message_id].read = True
                await self._persist_message(self.messages[message_id])
            
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to mark message {message_id} as read: {e}")
            return False
    
    async def get_agent_tasks(self, agent_id: str, status: Optional[TaskStatus] = None) -> List[CollaborativeTask]:
        """Get tasks involving an agent"""
        try:
            agent_tasks = []
            
            async with self.tasks_lock:
                for task in self.tasks.values():
                    # Check if agent is coordinator or participant
                    if task.coordinator_id == agent_id or agent_id in task.participants:
                        if status is None or task.status == status:
                            agent_tasks.append(task)
            
            # Sort by priority and updated time
            agent_tasks.sort(key=lambda x: (x.priority, x.updated_at), reverse=True)
            
            return agent_tasks
            
        except Exception as e:
            self.logger.error(f"Failed to get tasks for agent {agent_id}: {e}")
            return []
    
    async def update_task_status(self, task_id: str, status: TaskStatus, agent_id: str) -> bool:
        """Update task status (only coordinator or assigned agent can update)"""
        try:
            async with self.tasks_lock:
                if task_id not in self.tasks:
                    self.logger.error(f"Task {task_id} not found")
                    return False
                
                task = self.tasks[task_id]
                
                # Check permissions
                if agent_id != task.coordinator_id and agent_id not in task.participants:
                    self.logger.error(f"Agent {agent_id} not authorized to update task {task_id}")
                    return False
                
                task.status = status
                task.updated_at = datetime.now(timezone.utc)
                
                await self._persist_task(task)
            
            # Notify participants
            await self._notify_participants(task, "task_updated")
            
            self.logger.info(f"Task {task_id} status updated to {status.value} by agent {agent_id}")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to update task status: {e}")
            return False
    
    async def get_collaboration_insights(self, agent_id: Optional[str] = None) -> Dict[str, Any]:
        """Get insights about collaboration patterns"""
        try:
            insights = {
                'total_agents': len(self.agents),
                'active_tasks': 0,
                'completed_tasks': 0,
                'context_shares': len(self.context_shares),
                'messages_sent': len(self.messages),
                'agent_roles': defaultdict(int),
                'task_distribution': defaultdict(int),
                'collaboration_graph': {}
            }
            
            # Agent statistics
            for agent in self.agents.values():
                insights['agent_roles'][agent.role.value] += 1
            
            # Task statistics
            for task in self.tasks.values():
                if task.status in [TaskStatus.PENDING, TaskStatus.IN_PROGRESS]:
                    insights['active_tasks'] += 1
                elif task.status == TaskStatus.COMPLETED:
                    insights['completed_tasks'] += 1
                
                insights['task_distribution'][len(task.participants)] += 1
            
            # Collaboration graph (agent connections)
            graph = {}
            for task in self.tasks.values():
                participants = [task.coordinator_id] + task.participants
                for agent in participants:
                    if agent not in graph:
                        graph[agent] = set()
                    graph[agent].update(participants)
            
            # Convert sets to counts
            insights['collaboration_graph'] = {
                agent: len(connections) - 1  # Exclude self
                for agent, connections in graph.items()
            }
            
            # Filter by agent if specified
            if agent_id:
                agent_insights = {
                    'agent_tasks': await self.get_agent_tasks(agent_id),
                    'agent_messages': await self.get_agent_messages(agent_id),
                    'shared_context': await self.get_shared_context(agent_id),
                    'collaboration_count': insights['collaboration_graph'].get(agent_id, 0)
                }
                insights['agent_specific'] = agent_insights
            
            return insights
            
        except Exception as e:
            self.logger.error(f"Failed to generate collaboration insights: {e}")
            return {}
    
    async def _notify_participants(self, task: CollaborativeTask, notification_type: str):
        """Notify all task participants about an event"""
        try:
            content = {
                'task_id': task.id,
                'task_title': task.title,
                'notification_type': notification_type,
                'timestamp': datetime.now(timezone.utc).isoformat()
            }
            
            for participant_id in task.participants:
                await self._send_message(
                    task.coordinator_id,
                    participant_id,
                    "task_notification",
                    content,
                    priority=6
                )
                
        except Exception as e:
            self.logger.error(f"Failed to notify participants for task {task.id}: {e}")
    
    async def _persist_agent(self, agent: Agent):
        """Persist agent to database"""
        sql = """
        INSERT INTO agents (id, name, role, capabilities, status, last_active, metadata, context_sharing_enabled, max_concurrent_tasks)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            role = EXCLUDED.role,
            capabilities = EXCLUDED.capabilities,
            status = EXCLUDED.status,
            last_active = EXCLUDED.last_active,
            metadata = EXCLUDED.metadata,
            context_sharing_enabled = EXCLUDED.context_sharing_enabled,
            max_concurrent_tasks = EXCLUDED.max_concurrent_tasks
        """
        
        try:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute(sql, (
                        agent.id, agent.name, agent.role.value, json.dumps(agent.capabilities),
                        agent.status, agent.last_active, json.dumps(agent.metadata),
                        agent.context_sharing_enabled, agent.max_concurrent_tasks
                    ))
        except Exception as e:
            self.logger.error(f"Failed to persist agent: {e}")
    
    async def _remove_agent_from_db(self, agent_id: str):
        """Remove agent from database"""
        sql = "DELETE FROM agents WHERE id = %s"
        
        try:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute(sql, (agent_id,))
        except Exception as e:
            self.logger.error(f"Failed to remove agent from DB: {e}")
    
    async def _persist_task(self, task: CollaborativeTask):
        """Persist task to database"""
        sql = """
        INSERT INTO collaborative_tasks (id, title, description, coordinator_id, participants, status, priority, created_at, updated_at, deadline, context_requirements, shared_context, subtasks, metadata)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (id) DO UPDATE SET
            title = EXCLUDED.title,
            description = EXCLUDED.description,
            status = EXCLUDED.status,
            priority = EXCLUDED.priority,
            updated_at = EXCLUDED.updated_at,
            deadline = EXCLUDED.deadline,
            shared_context = EXCLUDED.shared_context,
            subtasks = EXCLUDED.subtasks,
            metadata = EXCLUDED.metadata
        """
        
        try:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute(sql, (
                        task.id, task.title, task.description, task.coordinator_id,
                        json.dumps(task.participants), task.status.value, task.priority,
                        task.created_at, task.updated_at, task.deadline,
                        json.dumps(task.context_requirements), json.dumps(task.shared_context),
                        json.dumps(task.subtasks), json.dumps(task.metadata)
                    ))
        except Exception as e:
            self.logger.error(f"Failed to persist task: {e}")
    
    async def _persist_context_share(self, share: ContextShare):
        """Persist context share to database"""
        sql = """
        INSERT INTO context_shares (id, source_agent_id, target_agent_ids, context_type, content, relevance_score, created_at, expires_at, access_count, metadata)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (id) DO UPDATE SET
            access_count = EXCLUDED.access_count,
            expires_at = EXCLUDED.expires_at
        """
        
        try:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute(sql, (
                        share.id, share.source_agent_id, json.dumps(share.target_agent_ids),
                        share.context_type, json.dumps(share.content), share.relevance_score,
                        share.created_at, share.expires_at, share.access_count, json.dumps(share.metadata)
                    ))
        except Exception as e:
            self.logger.error(f"Failed to persist context share: {e}")
    
    async def _persist_message(self, message: AgentMessage):
        """Persist message to database"""
        sql = """
        INSERT INTO agent_messages (id, from_agent_id, to_agent_id, message_type, content, priority, created_at, delivered, read, metadata)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (id) DO UPDATE SET
            delivered = EXCLUDED.delivered,
            read = EXCLUDED.read
        """
        
        try:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute(sql, (
                        message.id, message.from_agent_id, message.to_agent_id,
                        message.message_type, json.dumps(message.content), message.priority,
                        message.created_at, message.delivered, message.read, json.dumps(message.metadata)
                    ))
        except Exception as e:
            self.logger.error(f"Failed to persist message: {e}")
    
    async def cleanup_expired_data(self):
        """Clean up expired context shares and old messages"""
        try:
            current_time = datetime.now(timezone.utc)
            
            # Clean expired context shares
            expired_shares = []
            async with self.context_lock:
                for share_id, share in self.context_shares.items():
                    if share.expires_at and share.expires_at < current_time:
                        expired_shares.append(share_id)
                
                for share_id in expired_shares:
                    del self.context_shares[share_id]
            
            # Clean old messages
            message_cutoff = current_time - timedelta(hours=self.max_message_age_hours)
            old_messages = []
            async with self.messages_lock:
                for message_id, message in self.messages.items():
                    if message.created_at < message_cutoff:
                        old_messages.append(message_id)
                
                for message_id in old_messages:
                    del self.messages[message_id]
            
            self.logger.info(f"Cleaned {len(expired_shares)} expired shares and {len(old_messages)} old messages")
            
        except Exception as e:
            self.logger.error(f"Failed to cleanup expired data: {e}")


# Global collaboration instance
multi_agent_collaboration = MultiAgentCollaboration()
