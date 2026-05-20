"""
Visual Workflow Designer Service for Velocity Brain.

This service provides a drag-and-drop interface for creating
complex workflows with conditional logic and automation.
"""

import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Union, Tuple
from dataclasses import dataclass, asdict
from enum import Enum
import uuid

from src.core.db import get_conn
from src.core.logging_config import get_logger
from src.core.config import settings


class NodeType(Enum):
    """Types of workflow nodes."""
    START = "start"
    END = "end"
    ACTION = "action"
    CONDITION = "condition"
    PARALLEL = "parallel"
    MERGE = "merge"
    DELAY = "delay"
    WEBHOOK = "webhook"
    API_CALL = "api_call"
    EMAIL = "email"
    TASK = "task"
    DECISION = "decision"


class ConnectionType(Enum):
    """Types of node connections."""
    SUCCESS = "success"
    FAILURE = "failure"
    TIMEOUT = "timeout"
    TRUE = "true"
    FALSE = "false"
    DEFAULT = "default"


@dataclass
class WorkflowNode:
    """Individual workflow node."""
    id: str
    type: NodeType
    name: str
    description: str
    position: Dict[str, float]  # x, y coordinates
    config: Dict[str, Any]
    inputs: List[str]
    outputs: List[str]
    metadata: Dict[str, Any]


@dataclass
class WorkflowConnection:
    """Connection between workflow nodes."""
    id: str
    from_node: str
    to_node: str
    connection_type: ConnectionType
    condition: Optional[str] = None
    metadata: Dict[str, Any] = None


@dataclass
class Workflow:
    """Complete workflow definition."""
    id: str
    name: str
    description: str
    version: str
    nodes: List[WorkflowNode]
    connections: List[WorkflowConnection]
    variables: Dict[str, Any]
    triggers: List[Dict[str, Any]]
    settings: Dict[str, Any]
    created_at: datetime
    updated_at: datetime
    created_by: str
    status: str  # 'draft', 'active', 'paused', 'archived'


@dataclass
class WorkflowExecution:
    """Workflow execution instance."""
    execution_id: str
    workflow_id: str
    status: str  # 'running', 'completed', 'failed', 'cancelled'
    current_nodes: List[str]
    completed_nodes: List[str]
    variables: Dict[str, Any]
    logs: List[Dict[str, Any]]
    started_at: datetime
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None


class VisualWorkflowService:
    """Advanced visual workflow designer and executor."""
    
    def __init__(self):
        self.logger = get_logger('visual_workflow')
        self.node_handlers = self._initialize_node_handlers()
        
    def _initialize_node_handlers(self) -> Dict[NodeType, callable]:
        """Initialize handlers for different node types."""
        return {
            NodeType.START: self._handle_start_node,
            NodeType.END: self._handle_end_node,
            NodeType.ACTION: self._handle_action_node,
            NodeType.CONDITION: self._handle_condition_node,
            NodeType.PARALLEL: self._handle_parallel_node,
            NodeType.MERGE: self._handle_merge_node,
            NodeType.DELAY: self._handle_delay_node,
            NodeType.WEBHOOK: self._handle_webhook_node,
            NodeType.API_CALL: self._handle_api_call_node,
            NodeType.EMAIL: self._handle_email_node,
            NodeType.TASK: self._handle_task_node,
            NodeType.DECISION: self._handle_decision_node,
        }
    
    def create_workflow(self, workflow_data: Dict[str, Any], user: str) -> Workflow:
        """Create a new workflow from visual designer data."""
        try:
            # Generate workflow ID
            workflow_id = str(uuid.uuid4())
            
            # Parse nodes
            nodes = []
            for node_data in workflow_data.get('nodes', []):
                node = WorkflowNode(
                    id=node_data.get('id', str(uuid.uuid4())),
                    type=NodeType(node_data.get('type', 'action')),
                    name=node_data.get('name', ''),
                    description=node_data.get('description', ''),
                    position=node_data.get('position', {'x': 0, 'y': 0}),
                    config=node_data.get('config', {}),
                    inputs=node_data.get('inputs', []),
                    outputs=node_data.get('outputs', []),
                    metadata=node_data.get('metadata', {})
                )
                nodes.append(node)
            
            # Parse connections
            connections = []
            for conn_data in workflow_data.get('connections', []):
                connection = WorkflowConnection(
                    id=conn_data.get('id', str(uuid.uuid4())),
                    from_node=conn_data.get('from_node', ''),
                    to_node=conn_data.get('to_node', ''),
                    connection_type=ConnectionType(conn_data.get('connection_type', 'success')),
                    condition=conn_data.get('condition'),
                    metadata=conn_data.get('metadata', {})
                )
                connections.append(connection)
            
            # Create workflow
            workflow = Workflow(
                id=workflow_id,
                name=workflow_data.get('name', ''),
                description=workflow_data.get('description', ''),
                version=workflow_data.get('version', '1.0.0'),
                nodes=nodes,
                connections=connections,
                variables=workflow_data.get('variables', {}),
                triggers=workflow_data.get('triggers', []),
                settings=workflow_data.get('settings', {}),
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc),
                created_by=user,
                status='draft'
            )
            
            # Store workflow
            self._store_workflow(workflow)
            
            self.logger.info(f"Created workflow: {workflow.name} ({workflow_id})")
            return workflow
            
        except Exception as exc:
            self.logger.error(f"Failed to create workflow: {exc}")
            raise
    
    def validate_workflow(self, workflow: Workflow) -> List[str]:
        """Validate workflow structure and logic."""
        errors = []
        
        # Check for start and end nodes
        start_nodes = [node for node in workflow.nodes if node.type == NodeType.START]
        end_nodes = [node for node in workflow.nodes if node.type == NodeType.END]
        
        if len(start_nodes) != 1:
            errors.append("Workflow must have exactly one start node")
        
        if len(end_nodes) == 0:
            errors.append("Workflow must have at least one end node")
        
        # Check for orphaned nodes
        node_ids = {node.id for node in workflow.nodes}
        connected_nodes = set()
        
        for connection in workflow.connections:
            connected_nodes.add(connection.from_node)
            connected_nodes.add(connection.to_node)
        
        orphaned_nodes = node_ids - connected_nodes
        if orphaned_nodes:
            errors.append(f"Orphaned nodes found: {orphaned_nodes}")
        
        # Check for valid connections
        for connection in workflow.connections:
            if connection.from_node not in node_ids:
                errors.append(f"Invalid connection: from_node {connection.from_node} not found")
            if connection.to_node not in node_ids:
                errors.append(f"Invalid connection: to_node {connection.to_node} not found")
        
        # Check node configurations
        for node in workflow.nodes:
            node_errors = self._validate_node_configuration(node)
            errors.extend(node_errors)
        
        return errors
    
    def _validate_node_configuration(self, node: WorkflowNode) -> List[str]:
        """Validate individual node configuration."""
        errors = []
        
        if node.type == NodeType.CONDITION:
            if 'condition' not in node.config:
                errors.append(f"Condition node {node.id} missing condition configuration")
        
        elif node.type == NodeType.DELAY:
            if 'delay_seconds' not in node.config:
                errors.append(f"Delay node {node.id} missing delay_seconds configuration")
        
        elif node.type == NodeType.API_CALL:
            if 'url' not in node.config:
                errors.append(f"API call node {node.id} missing URL configuration")
        
        elif node.type == NodeType.EMAIL:
            if 'to' not in node.config:
                errors.append(f"Email node {node.id} missing recipient configuration")
        
        return errors
    
    def execute_workflow(self, workflow_id: str, trigger_data: Dict[str, Any] = None) -> WorkflowExecution:
        """Execute a workflow."""
        try:
            # Load workflow
            workflow = self._load_workflow(workflow_id)
            if not workflow:
                raise ValueError(f"Workflow {workflow_id} not found")
            
            # Create execution instance
            execution = WorkflowExecution(
                execution_id=str(uuid.uuid4()),
                workflow_id=workflow_id,
                status='running',
                current_nodes=[],
                completed_nodes=[],
                variables=workflow.variables.copy(),
                logs=[],
                started_at=datetime.now(timezone.utc)
            )
            
            # Add trigger data to variables
            if trigger_data:
                execution.variables.update(trigger_data)
            
            # Store execution
            self._store_execution(execution)
            
            # Find start node
            start_nodes = [node for node in workflow.nodes if node.type == NodeType.START]
            if not start_nodes:
                raise ValueError("No start node found in workflow")
            
            # Start execution from start node
            execution.current_nodes = [start_nodes[0].id]
            self._continue_workflow_execution(workflow, execution)
            
            self.logger.info(f"Started workflow execution: {execution.execution_id}")
            return execution
            
        except Exception as exc:
            self.logger.error(f"Failed to execute workflow {workflow_id}: {exc}")
            raise

    def list_executions(self, workflow_id: str, limit: int = 50) -> list[WorkflowExecution]:
        """List recent workflow executions from database."""
        try:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        SELECT * FROM workflow_executions
                        WHERE workflow_id = %s
                        ORDER BY started_at DESC
                        LIMIT %s
                        """,
                        (workflow_id, limit),
                    )
                    rows = cur.fetchall()
                    conn.commit()
            executions: list[WorkflowExecution] = []
            for result in rows:
                executions.append(
                    WorkflowExecution(
                        execution_id=result['execution_id'],
                        workflow_id=result['workflow_id'],
                        status=result['status'],
                        current_nodes=json.loads(result['current_nodes']) if result['current_nodes'] else [],
                        completed_nodes=json.loads(result['completed_nodes']) if result['completed_nodes'] else [],
                        variables=json.loads(result['variables']) if result['variables'] else {},
                        logs=json.loads(result['logs']) if result['logs'] else [],
                        started_at=result['started_at'],
                        completed_at=result['completed_at'],
                        error_message=result['error_message'],
                    )
                )
            return executions
        except Exception as exc:
            self.logger.error(f"Failed to load workflow executions for {workflow_id}: {exc}")
            return []
    
    def _continue_workflow_execution(self, workflow: Workflow, execution: WorkflowExecution):
        """Continue workflow execution for current nodes."""
        try:
            while execution.current_nodes and execution.status == 'running':
                # Process current nodes in parallel
                next_nodes = []
                
                for node_id in execution.current_nodes:
                    node = next((n for n in workflow.nodes if n.id == node_id), None)
                    if not node:
                        continue
                    
                    # Handle node execution
                    result = self._execute_node(node, execution)
                    
                    # Add to completed nodes
                    execution.completed_nodes.append(node_id)
                    
                    # Find next nodes based on connections
                    if result['success']:
                        next_connections = [
                            conn for conn in workflow.connections
                            if conn.from_node == node_id and conn.connection_type == ConnectionType.SUCCESS
                        ]
                    else:
                        next_connections = [
                            conn for conn in workflow.connections
                            if conn.from_node == node_id and conn.connection_type == ConnectionType.FAILURE
                        ]
                    
                    for connection in next_connections:
                        # Check conditions
                        if connection.condition:
                            if not self._evaluate_condition(connection.condition, execution.variables):
                                continue
                        
                        # Add to next nodes
                        if connection.to_node not in next_nodes:
                            next_nodes.append(connection.to_node)
                
                # Update current nodes
                execution.current_nodes = next_nodes
                
                # Check for end nodes
                end_node_ids = [node.id for node in workflow.nodes if node.type == NodeType.END]
                if any(node_id in end_node_ids for node_id in execution.current_nodes):
                    execution.status = 'completed'
                    execution.completed_at = datetime.now(timezone.utc)
                    break
            
            # Store execution state
            self._update_execution(execution)
            
        except Exception as exc:
            execution.status = 'failed'
            execution.error_message = str(exc)
            execution.completed_at = datetime.now(timezone.utc)
            self._update_execution(execution)
            raise
    
    def _execute_node(self, node: WorkflowNode, execution: WorkflowExecution) -> Dict[str, Any]:
        """Execute individual workflow node."""
        try:
            handler = self.node_handlers.get(node.type)
            if not handler:
                raise ValueError(f"No handler for node type: {node.type}")
            
            # Log node execution
            log_entry = {
                'node_id': node.id,
                'node_type': node.type.value,
                'timestamp': datetime.now(timezone.utc).isoformat(),
                'status': 'started'
            }
            execution.logs.append(log_entry)
            
            # Execute node
            result = handler(node, execution)
            
            # Update log
            log_entry.update({
                'status': 'completed',
                'result': result,
                'completed_at': datetime.now(timezone.utc).isoformat()
            })
            
            self.logger.info(f"Executed node {node.id} ({node.type.value}): {result}")
            return result
            
        except Exception as exc:
            # Log error
            log_entry = {
                'node_id': node.id,
                'node_type': node.type.value,
                'timestamp': datetime.now(timezone.utc).isoformat(),
                'status': 'failed',
                'error': str(exc)
            }
            execution.logs.append(log_entry)
            
            self.logger.error(f"Failed to execute node {node.id}: {exc}")
            return {'success': False, 'error': str(exc)}
    
    def _handle_start_node(self, node: WorkflowNode, execution: WorkflowExecution) -> Dict[str, Any]:
        """Handle start node execution."""
        return {'success': True, 'message': 'Workflow started'}
    
    def _handle_end_node(self, node: WorkflowNode, execution: WorkflowExecution) -> Dict[str, Any]:
        """Handle end node execution."""
        return {'success': True, 'message': 'Workflow completed'}
    
    def _handle_action_node(self, node: WorkflowNode, execution: WorkflowExecution) -> Dict[str, Any]:
        """Handle action node execution."""
        action_type = node.config.get('action_type', 'generic')
        
        # Execute action based on type
        if action_type == 'send_email':
            return self._execute_send_email(node, execution)
        elif action_type == 'create_task':
            return self._execute_create_task(node, execution)
        elif action_type == 'api_request':
            return self._execute_api_request(node, execution)
        else:
            return {'success': True, 'message': f'Executed action: {action_type}'}
    
    def _handle_condition_node(self, node: WorkflowNode, execution: WorkflowExecution) -> Dict[str, Any]:
        """Handle condition node execution."""
        condition = node.config.get('condition', '')
        result = self._evaluate_condition(condition, execution.variables)
        
        return {'success': True, 'condition_result': result}
    
    def _handle_parallel_node(self, node: WorkflowNode, execution: WorkflowExecution) -> Dict[str, Any]:
        """Handle parallel node execution."""
        # For now, just pass through
        return {'success': True, 'message': 'Parallel execution started'}
    
    def _handle_merge_node(self, node: WorkflowNode, execution: WorkflowExecution) -> Dict[str, Any]:
        """Handle merge node execution."""
        # For now, just pass through
        return {'success': True, 'message': 'Parallel execution merged'}
    
    def _handle_delay_node(self, node: WorkflowNode, execution: WorkflowExecution) -> Dict[str, Any]:
        """Handle delay node execution."""
        delay_seconds = node.config.get('delay_seconds', 0)
        
        if delay_seconds > 0:
            import time
            time.sleep(delay_seconds)
        
        return {'success': True, 'delay_seconds': delay_seconds}
    
    def _handle_webhook_node(self, node: WorkflowNode, execution: WorkflowExecution) -> Dict[str, Any]:
        """Handle webhook node execution."""
        webhook_url = node.config.get('webhook_url', '')
        method = node.config.get('method', 'POST')
        payload = node.config.get('payload', {})
        
        # For now, just simulate webhook call
        return {'success': True, 'webhook_url': webhook_url, 'method': method}
    
    def _handle_api_call_node(self, node: WorkflowNode, execution: WorkflowExecution) -> Dict[str, Any]:
        """Handle API call node execution."""
        url = node.config.get('url', '')
        method = node.config.get('method', 'GET')
        headers = node.config.get('headers', {})
        body = node.config.get('body', {})
        
        # For now, just simulate API call
        return {'success': True, 'url': url, 'method': method, 'response': {'status': 'success'}}
    
    def _handle_email_node(self, node: WorkflowNode, execution: WorkflowExecution) -> Dict[str, Any]:
        """Handle email node execution."""
        to = node.config.get('to', [])
        subject = node.config.get('subject', '')
        body = node.config.get('body', '')
        
        # For now, just simulate email sending
        return {'success': True, 'to': to, 'subject': subject}
    
    def _handle_task_node(self, node: WorkflowNode, execution: WorkflowExecution) -> Dict[str, Any]:
        """Handle task node execution."""
        task_name = node.config.get('task_name', '')
        assignee = node.config.get('assignee', '')
        due_date = node.config.get('due_date', '')
        
        # For now, just simulate task creation
        return {'success': True, 'task_name': task_name, 'assignee': assignee}
    
    def _handle_decision_node(self, node: WorkflowNode, execution: WorkflowExecution) -> Dict[str, Any]:
        """Handle decision node execution."""
        decision_variable = node.config.get('decision_variable', '')
        options = node.config.get('options', [])
        
        # Get decision value from variables
        decision_value = execution.variables.get(decision_variable)
        
        return {'success': True, 'decision_value': decision_value, 'options': options}
    
    def _evaluate_condition(self, condition: str, variables: Dict[str, Any]) -> bool:
        """Evaluate condition expression."""
        try:
            # Simple condition evaluation (can be enhanced with proper expression parser)
            # Replace variables in condition
            for var_name, var_value in variables.items():
                condition = condition.replace(f'${var_name}', str(var_value))
            
            # For now, use eval (should be replaced with safe expression parser)
            return eval(condition)
            
        except Exception as exc:
            self.logger.error(f"Failed to evaluate condition '{condition}': {exc}")
            return False
    
    def _execute_send_email(self, node: WorkflowNode, execution: WorkflowExecution) -> Dict[str, Any]:
        """Execute send email action."""
        to = node.config.get('to', [])
        subject = node.config.get('subject', '')
        body = node.config.get('body', '')
        
        # Simulate email sending
        return {'success': True, 'message': f'Email sent to {to}'}
    
    def _execute_create_task(self, node: WorkflowNode, execution: WorkflowExecution) -> Dict[str, Any]:
        """Execute create task action."""
        task_name = node.config.get('task_name', '')
        description = node.config.get('description', '')
        assignee = node.config.get('assignee', '')
        
        # Simulate task creation
        return {'success': True, 'message': f'Task "{task_name}" created for {assignee}'}
    
    def _execute_api_request(self, node: WorkflowNode, execution: WorkflowExecution) -> Dict[str, Any]:
        """Execute API request action."""
        url = node.config.get('url', '')
        method = node.config.get('method', 'GET')
        headers = node.config.get('headers', {})
        body = node.config.get('body', {})
        
        # Simulate API request
        return {'success': True, 'message': f'API request to {url}'}
    
    def _store_workflow(self, workflow: Workflow) -> None:
        """Store workflow in database."""
        try:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        INSERT INTO workflows 
                            (id, name, description, version, nodes, connections, variables, triggers, settings, created_at, updated_at, created_by, status)
                        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    """, (
                        workflow.id,
                        workflow.name,
                        workflow.description,
                        workflow.version,
                        json.dumps([asdict(node) for node in workflow.nodes], default=str),
                        json.dumps([asdict(conn) for conn in workflow.connections], default=str),
                        json.dumps(workflow.variables, default=str),
                        json.dumps(workflow.triggers, default=str),
                        json.dumps(workflow.settings, default=str),
                        workflow.created_at,
                        workflow.updated_at,
                        workflow.created_by,
                        workflow.status
                    ))
                conn.commit()
                
        except Exception as exc:
            self.logger.error(f"Failed to store workflow: {exc}")
            raise
    
    def _load_workflow(self, workflow_id: str) -> Optional[Workflow]:
        """Load workflow from database."""
        try:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        SELECT * FROM workflows WHERE id = %s
                    """, (workflow_id,))
                    
                    result = cur.fetchone()
                    if not result:
                        return None
                    
                    # Parse nodes and connections
                    nodes_data = json.loads(result['nodes'])
                    connections_data = json.loads(result['connections'])
                    
                    nodes = [
                        WorkflowNode(
                            id=node['id'],
                            type=NodeType(node['type']),
                            name=node['name'],
                            description=node['description'],
                            position=node['position'],
                            config=node['config'],
                            inputs=node['inputs'],
                            outputs=node['outputs'],
                            metadata=node['metadata']
                        )
                        for node in nodes_data
                    ]
                    
                    connections = [
                        WorkflowConnection(
                            id=conn['id'],
                            from_node=conn['from_node'],
                            to_node=conn['to_node'],
                            connection_type=ConnectionType(conn['connection_type']),
                            condition=conn.get('condition'),
                            metadata=conn.get('metadata', {})
                        )
                        for conn in connections_data
                    ]
                    
                    return Workflow(
                        id=result['id'],
                        name=result['name'],
                        description=result['description'],
                        version=result['version'],
                        nodes=nodes,
                        connections=connections,
                        variables=json.loads(result['variables']),
                        triggers=json.loads(result['triggers']),
                        settings=json.loads(result['settings']),
                        created_at=result['created_at'],
                        updated_at=result['updated_at'],
                        created_by=result['created_by'],
                        status=result['status']
                    )
                    
        except Exception as exc:
            self.logger.error(f"Failed to load workflow {workflow_id}: {exc}")
            return None
    
    def _store_execution(self, execution: WorkflowExecution) -> None:
        """Store workflow execution in database."""
        try:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        INSERT INTO workflow_executions 
                            (execution_id, workflow_id, status, current_nodes, completed_nodes, variables, logs, started_at, completed_at, error_message)
                        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    """, (
                        execution.execution_id,
                        execution.workflow_id,
                        execution.status,
                        json.dumps(execution.current_nodes),
                        json.dumps(execution.completed_nodes),
                        json.dumps(execution.variables, default=str),
                        json.dumps(execution.logs, default=str),
                        execution.started_at,
                        execution.completed_at,
                        execution.error_message
                    ))
                conn.commit()
                
        except Exception as exc:
            self.logger.error(f"Failed to store execution: {exc}")
            raise
    
    def _update_execution(self, execution: WorkflowExecution) -> None:
        """Update workflow execution in database."""
        try:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        UPDATE workflow_executions 
                        SET status = %s, current_nodes = %s, completed_nodes = %s, variables = %s, logs = %s, completed_at = %s, error_message = %s
                        WHERE execution_id = %s
                    """, (
                        execution.status,
                        json.dumps(execution.current_nodes),
                        json.dumps(execution.completed_nodes),
                        json.dumps(execution.variables, default=str),
                        json.dumps(execution.logs, default=str),
                        execution.completed_at,
                        execution.error_message,
                        execution.execution_id
                    ))
                conn.commit()
                
        except Exception as exc:
            self.logger.error(f"Failed to update execution: {exc}")
            raise


# Global instance
visual_workflow = VisualWorkflowService()
