"""
Conditional Logic Engine for Velocity Brain.

This service provides advanced conditional logic capabilities for workflows,
including complex rule evaluation, decision trees, and dynamic routing.
"""

import json
import logging
import operator
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Union, Callable
from dataclasses import dataclass
from enum import Enum

from src.core.db import get_conn
from src.core.logging_config import get_logger
from src.core.config import settings


class ComparisonOperator(Enum):
    """Comparison operators for conditions."""
    EQUALS = "equals"
    NOT_EQUALS = "not_equals"
    GREATER_THAN = "greater_than"
    GREATER_EQUAL = "greater_equal"
    LESS_THAN = "less_than"
    LESS_EQUAL = "less_equal"
    CONTAINS = "contains"
    NOT_CONTAINS = "not_contains"
    STARTS_WITH = "starts_with"
    ENDS_WITH = "ends_with"
    IN = "in"
    NOT_IN = "not_in"
    IS_NULL = "is_null"
    IS_NOT_NULL = "is_not_null"
    REGEX_MATCH = "regex_match"


class LogicalOperator(Enum):
    """Logical operators for combining conditions."""
    AND = "and"
    OR = "or"
    NOT = "not"


class DataType(Enum):
    """Data types for condition evaluation."""
    STRING = "string"
    NUMBER = "number"
    BOOLEAN = "boolean"
    DATE = "date"
    ARRAY = "array"
    OBJECT = "object"


@dataclass
class Condition:
    """Individual condition in a rule."""
    field: str
    operator: ComparisonOperator
    value: Any
    data_type: DataType
    case_sensitive: bool = True


@dataclass
class Rule:
    """Business rule with conditions and actions."""
    id: str
    name: str
    description: str
    conditions: List[Condition]
    logical_operator: LogicalOperator
    actions: List[Dict[str, Any]]
    priority: int
    enabled: bool
    created_at: datetime
    updated_at: datetime


@dataclass
class DecisionTree:
    """Decision tree for complex logic."""
    id: str
    name: str
    root_node: Dict[str, Any]
    variables: Dict[str, Any]
    created_at: datetime


@dataclass
class EvaluationResult:
    """Result of rule evaluation."""
    rule_id: str
    matched: bool
    confidence: float
    actions: List[Dict[str, Any]]
    evaluation_time_ms: float
    variables_used: List[str]


class ConditionalLogicService:
    """Advanced conditional logic and rule engine."""
    
    def __init__(self):
        self.logger = get_logger('conditional_logic')
        self.comparison_functions = self._initialize_comparison_functions()
        self.cached_rules = {}
        
    def _initialize_comparison_functions(self) -> Dict[ComparisonOperator, Callable]:
        """Initialize comparison functions for operators."""
        return {
            ComparisonOperator.EQUALS: self._equals,
            ComparisonOperator.NOT_EQUALS: self._not_equals,
            ComparisonOperator.GREATER_THAN: self._greater_than,
            ComparisonOperator.GREATER_EQUAL: self._greater_equal,
            ComparisonOperator.LESS_THAN: self._less_than,
            ComparisonOperator.LESS_EQUAL: self._less_equal,
            ComparisonOperator.CONTAINS: self._contains,
            ComparisonOperator.NOT_CONTAINS: self._not_contains,
            ComparisonOperator.STARTS_WITH: self._starts_with,
            ComparisonOperator.ENDS_WITH: self._ends_with,
            ComparisonOperator.IN: self._in,
            ComparisonOperator.NOT_IN: self._not_in,
            ComparisonOperator.IS_NULL: self._is_null,
            ComparisonOperator.IS_NOT_NULL: self._is_not_null,
            ComparisonOperator.REGEX_MATCH: self._regex_match,
        }
    
    def create_rule(self, rule_data: Dict[str, Any]) -> Rule:
        """Create a new business rule."""
        try:
            # Parse conditions
            conditions = []
            for condition_data in rule_data.get('conditions', []):
                condition = Condition(
                    field=condition_data.get('field', ''),
                    operator=ComparisonOperator(condition_data.get('operator', 'equals')),
                    value=condition_data.get('value'),
                    data_type=DataType(condition_data.get('data_type', 'string')),
                    case_sensitive=condition_data.get('case_sensitive', True)
                )
                conditions.append(condition)
            
            # Create rule
            rule = Rule(
                id=rule_data.get('id', ''),
                name=rule_data.get('name', ''),
                description=rule_data.get('description', ''),
                conditions=conditions,
                logical_operator=LogicalOperator(rule_data.get('logical_operator', 'and')),
                actions=rule_data.get('actions', []),
                priority=rule_data.get('priority', 0),
                enabled=rule_data.get('enabled', True),
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc)
            )
            
            # Store rule
            self._store_rule(rule)
            
            self.logger.info(f"Created rule: {rule.name} ({rule.id})")
            return rule
            
        except Exception as exc:
            self.logger.error(f"Failed to create rule: {exc}")
            raise
    
    def evaluate_rule(self, rule_id: str, context: Dict[str, Any]) -> EvaluationResult:
        """Evaluate a rule against given context."""
        try:
            import time
            start_time = time.time()
            
            # Load rule
            rule = self._load_rule(rule_id)
            if not rule:
                raise ValueError(f"Rule {rule_id} not found")
            
            if not rule.enabled:
                return EvaluationResult(
                    rule_id=rule_id,
                    matched=False,
                    confidence=0.0,
                    actions=[],
                    evaluation_time_ms=0.0,
                    variables_used=[]
                )
            
            # Evaluate conditions
            condition_results = []
            variables_used = set()
            
            for condition in rule.conditions:
                result = self._evaluate_condition(condition, context)
                condition_results.append(result)
                variables_used.add(condition.field)
            
            # Apply logical operator
            if rule.logical_operator == LogicalOperator.AND:
                matched = all(condition_results)
            elif rule.logical_operator == LogicalOperator.OR:
                matched = any(condition_results)
            elif rule.logical_operator == LogicalOperator.NOT:
                matched = not all(condition_results)
            else:
                matched = all(condition_results)  # Default to AND
            
            # Calculate confidence
            confidence = sum(condition_results) / len(condition_results) if condition_results else 0.0
            
            evaluation_time = (time.time() - start_time) * 1000
            
            result = EvaluationResult(
                rule_id=rule_id,
                matched=matched,
                confidence=confidence,
                actions=rule.actions if matched else [],
                evaluation_time_ms=evaluation_time,
                variables_used=list(variables_used)
            )
            
            self.logger.info(f"Evaluated rule {rule_id}: matched={matched}, confidence={confidence:.2f}")
            return result
            
        except Exception as exc:
            self.logger.error(f"Failed to evaluate rule {rule_id}: {exc}")
            raise
    
    def evaluate_rules(self, context: Dict[str, Any], rule_category: str = None) -> List[EvaluationResult]:
        """Evaluate multiple rules against context."""
        try:
            # Load rules
            rules = self._load_rules(rule_category)
            
            results = []
            for rule in rules:
                if not rule.enabled:
                    continue
                
                result = self.evaluate_rule(rule.id, context)
                results.append(result)
            
            # Sort by priority and confidence
            results.sort(key=lambda x: (-x.confidence, -self._get_rule_priority(x.rule_id)))
            
            return results
            
        except Exception as exc:
            self.logger.error(f"Failed to evaluate rules: {exc}")
            raise
    
    def create_decision_tree(self, tree_data: Dict[str, Any]) -> DecisionTree:
        """Create a decision tree for complex logic."""
        try:
            tree = DecisionTree(
                id=tree_data.get('id', ''),
                name=tree_data.get('name', ''),
                root_node=tree_data.get('root_node', {}),
                variables=tree_data.get('variables', {}),
                created_at=datetime.now(timezone.utc)
            )
            
            # Store decision tree
            self._store_decision_tree(tree)
            
            self.logger.info(f"Created decision tree: {tree.name} ({tree.id})")
            return tree
            
        except Exception as exc:
            self.logger.error(f"Failed to create decision tree: {exc}")
            raise
    
    def evaluate_decision_tree(self, tree_id: str, context: Dict[str, Any]) -> Dict[str, Any]:
        """Evaluate decision tree against context."""
        try:
            # Load decision tree
            tree = self._load_decision_tree(tree_id)
            if not tree:
                raise ValueError(f"Decision tree {tree_id} not found")
            
            # Evaluate tree
            result = self._evaluate_tree_node(tree.root_node, context)
            
            self.logger.info(f"Evaluated decision tree {tree_id}: result={result}")
            return result
            
        except Exception as exc:
            self.logger.error(f"Failed to evaluate decision tree {tree_id}: {exc}")
            raise
    
    def _evaluate_tree_node(self, node: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        """Evaluate individual tree node."""
        node_type = node.get('type', 'condition')
        
        if node_type == 'condition':
            # Evaluate condition
            condition_data = node.get('condition', {})
            condition = Condition(
                field=condition_data.get('field', ''),
                operator=ComparisonOperator(condition_data.get('operator', 'equals')),
                value=condition_data.get('value'),
                data_type=DataType(condition_data.get('data_type', 'string'))
            )
            
            result = self._evaluate_condition(condition, context)
            
            # Follow appropriate branch
            if result:
                true_branch = node.get('true_branch')
                if true_branch:
                    return self._evaluate_tree_node(true_branch, context)
            else:
                false_branch = node.get('false_branch')
                if false_branch:
                    return self._evaluate_tree_node(false_branch, context)
            
            return {'result': 'no_match'}
            
        elif node_type == 'action':
            # Return action
            return {
                'type': 'action',
                'action': node.get('action'),
                'parameters': node.get('parameters', {})
            }
            
        elif node_type == 'value':
            # Return value
            return {
                'type': 'value',
                'value': node.get('value')
            }
        
        return {'result': 'invalid_node'}
    
    def _evaluate_condition(self, condition: Condition, context: Dict[str, Any]) -> bool:
        """Evaluate individual condition."""
        try:
            # Get field value from context
            field_value = self._get_field_value(condition.field, context)
            
            # Convert data types
            field_value = self._convert_data_type(field_value, condition.data_type)
            condition_value = self._convert_data_type(condition.value, condition.data_type)
            
            # Apply case sensitivity for strings
            if condition.data_type == DataType.STRING and not condition.case_sensitive:
                if isinstance(field_value, str):
                    field_value = field_value.lower()
                if isinstance(condition_value, str):
                    condition_value = condition_value.lower()
            
            # Evaluate using comparison function
            comparison_func = self.comparison_functions.get(condition.operator)
            if not comparison_func:
                raise ValueError(f"Unknown operator: {condition.operator}")
            
            return comparison_func(field_value, condition_value)
            
        except Exception as exc:
            self.logger.error(f"Failed to evaluate condition: {exc}")
            return False
    
    def _get_field_value(self, field: str, context: Dict[str, Any]) -> Any:
        """Get field value from context, supporting nested fields."""
        # Support nested field access with dot notation
        parts = field.split('.')
        value = context
        
        for part in parts:
            if isinstance(value, dict) and part in value:
                value = value[part]
            else:
                return None
        
        return value
    
    def _convert_data_type(self, value: Any, data_type: DataType) -> Any:
        """Convert value to specified data type."""
        try:
            if value is None:
                return None
            
            if data_type == DataType.STRING:
                return str(value)
            elif data_type == DataType.NUMBER:
                if isinstance(value, str):
                    return float(value) if '.' in value else int(value)
                return float(value) if isinstance(value, float) else int(value)
            elif data_type == DataType.BOOLEAN:
                if isinstance(value, str):
                    return value.lower() in ('true', '1', 'yes', 'on')
                return bool(value)
            elif data_type == DataType.DATE:
                if isinstance(value, str):
                    return datetime.fromisoformat(value.replace('Z', '+00:00'))
                return value
            elif data_type == DataType.ARRAY:
                if isinstance(value, str):
                    return [value]
                return list(value) if not isinstance(value, list) else value
            elif data_type == DataType.OBJECT:
                if isinstance(value, str):
                    return json.loads(value)
                return dict(value) if not isinstance(value, dict) else value
            
            return value
            
        except Exception:
            return value
    
    def _equals(self, field_value: Any, condition_value: Any) -> bool:
        """Equals comparison."""
        return field_value == condition_value
    
    def _not_equals(self, field_value: Any, condition_value: Any) -> bool:
        """Not equals comparison."""
        return field_value != condition_value
    
    def _greater_than(self, field_value: Any, condition_value: Any) -> bool:
        """Greater than comparison."""
        try:
            return float(field_value) > float(condition_value)
        except (TypeError, ValueError):
            return False
    
    def _greater_equal(self, field_value: Any, condition_value: Any) -> bool:
        """Greater than or equal comparison."""
        try:
            return float(field_value) >= float(condition_value)
        except (TypeError, ValueError):
            return False
    
    def _less_than(self, field_value: Any, condition_value: Any) -> bool:
        """Less than comparison."""
        try:
            return float(field_value) < float(condition_value)
        except (TypeError, ValueError):
            return False
    
    def _less_equal(self, field_value: Any, condition_value: Any) -> bool:
        """Less than or equal comparison."""
        try:
            return float(field_value) <= float(condition_value)
        except (TypeError, ValueError):
            return False
    
    def _contains(self, field_value: Any, condition_value: Any) -> bool:
        """Contains comparison."""
        if field_value is None:
            return False
        
        field_str = str(field_value)
        condition_str = str(condition_value)
        
        return condition_str in field_str
    
    def _not_contains(self, field_value: Any, condition_value: Any) -> bool:
        """Not contains comparison."""
        return not self._contains(field_value, condition_value)
    
    def _starts_with(self, field_value: Any, condition_value: Any) -> bool:
        """Starts with comparison."""
        if field_value is None:
            return False
        
        field_str = str(field_value)
        condition_str = str(condition_value)
        
        return field_str.startswith(condition_str)
    
    def _ends_with(self, field_value: Any, condition_value: Any) -> bool:
        """Ends with comparison."""
        if field_value is None:
            return False
        
        field_str = str(field_value)
        condition_str = str(condition_value)
        
        return field_str.endswith(condition_str)
    
    def _in(self, field_value: Any, condition_value: Any) -> bool:
        """In comparison."""
        if not isinstance(condition_value, (list, tuple, set)):
            condition_value = [condition_value]
        
        return field_value in condition_value
    
    def _not_in(self, field_value: Any, condition_value: Any) -> bool:
        """Not in comparison."""
        return not self._in(field_value, condition_value)
    
    def _is_null(self, field_value: Any, condition_value: Any) -> bool:
        """Is null comparison."""
        return field_value is None
    
    def _is_not_null(self, field_value: Any, condition_value: Any) -> bool:
        """Is not null comparison."""
        return field_value is not None
    
    def _regex_match(self, field_value: Any, condition_value: Any) -> bool:
        """Regex match comparison."""
        if field_value is None:
            return False
        
        import re
        try:
            pattern = str(condition_value)
            field_str = str(field_value)
            return bool(re.match(pattern, field_str))
        except re.error:
            return False
    
    def _store_rule(self, rule: Rule) -> None:
        """Store rule in database."""
        try:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        INSERT INTO conditional_rules 
                            (id, name, description, conditions, logical_operator, actions, priority, enabled, created_at, updated_at)
                        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    """, (
                        rule.id,
                        rule.name,
                        rule.description,
                        json.dumps([{
                            'field': c.field,
                            'operator': c.operator.value,
                            'value': c.value,
                            'data_type': c.data_type.value,
                            'case_sensitive': c.case_sensitive
                        } for c in rule.conditions], default=str),
                        rule.logical_operator.value,
                        json.dumps(rule.actions, default=str),
                        rule.priority,
                        rule.enabled,
                        rule.created_at,
                        rule.updated_at
                    ))
                conn.commit()
                
        except Exception as exc:
            self.logger.error(f"Failed to store rule: {exc}")
            raise
    
    def _load_rule(self, rule_id: str) -> Optional[Rule]:
        """Load rule from database."""
        try:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        SELECT * FROM conditional_rules WHERE id = %s
                    """, (rule_id,))
                    
                    result = cur.fetchone()
                    if not result:
                        return None
                    
                    # Parse conditions
                    conditions_data = json.loads(result['conditions'])
                    conditions = [
                        Condition(
                            field=cond['field'],
                            operator=ComparisonOperator(cond['operator']),
                            value=cond['value'],
                            data_type=DataType(cond['data_type']),
                            case_sensitive=cond.get('case_sensitive', True)
                        )
                        for cond in conditions_data
                    ]
                    
                    return Rule(
                        id=result['id'],
                        name=result['name'],
                        description=result['description'],
                        conditions=conditions,
                        logical_operator=LogicalOperator(result['logical_operator']),
                        actions=json.loads(result['actions']),
                        priority=result['priority'],
                        enabled=result['enabled'],
                        created_at=result['created_at'],
                        updated_at=result['updated_at']
                    )
                    
        except Exception as exc:
            self.logger.error(f"Failed to load rule {rule_id}: {exc}")
            return None
    
    def _load_rules(self, category: str = None) -> List[Rule]:
        """Load rules from database."""
        try:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    if category:
                        cur.execute("""
                            SELECT * FROM conditional_rules 
                            WHERE category = %s AND enabled = true
                            ORDER BY priority DESC
                        """, (category,))
                    else:
                        cur.execute("""
                            SELECT * FROM conditional_rules 
                            WHERE enabled = true
                            ORDER BY priority DESC
                        """)
                    
                    results = cur.fetchall()
                    rules = []
                    
                    for result in results:
                        # Parse conditions
                        conditions_data = json.loads(result['conditions'])
                        conditions = [
                            Condition(
                                field=cond['field'],
                                operator=ComparisonOperator(cond['operator']),
                                value=cond['value'],
                                data_type=DataType(cond['data_type']),
                                case_sensitive=cond.get('case_sensitive', True)
                            )
                            for cond in conditions_data
                        ]
                        
                        rules.append(Rule(
                            id=result['id'],
                            name=result['name'],
                            description=result['description'],
                            conditions=conditions,
                            logical_operator=LogicalOperator(result['logical_operator']),
                            actions=json.loads(result['actions']),
                            priority=result['priority'],
                            enabled=result['enabled'],
                            created_at=result['created_at'],
                            updated_at=result['updated_at']
                        ))
                    
                    return rules
                    
        except Exception as exc:
            self.logger.error(f"Failed to load rules: {exc}")
            return []
    
    def _store_decision_tree(self, tree: DecisionTree) -> None:
        """Store decision tree in database."""
        try:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        INSERT INTO decision_trees 
                            (id, name, root_node, variables, created_at)
                        VALUES (%s,%s,%s,%s,%s)
                    """, (
                        tree.id,
                        tree.name,
                        json.dumps(tree.root_node, default=str),
                        json.dumps(tree.variables, default=str),
                        tree.created_at
                    ))
                conn.commit()
                
        except Exception as exc:
            self.logger.error(f"Failed to store decision tree: {exc}")
            raise
    
    def _load_decision_tree(self, tree_id: str) -> Optional[DecisionTree]:
        """Load decision tree from database."""
        try:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        SELECT * FROM decision_trees WHERE id = %s
                    """, (tree_id,))
                    
                    result = cur.fetchone()
                    if not result:
                        return None
                    
                    return DecisionTree(
                        id=result['id'],
                        name=result['name'],
                        root_node=json.loads(result['root_node']),
                        variables=json.loads(result['variables']),
                        created_at=result['created_at']
                    )
                    
        except Exception as exc:
            self.logger.error(f"Failed to load decision tree {tree_id}: {exc}")
            return None
    
    def _get_rule_priority(self, rule_id: str) -> int:
        """Get rule priority from cache or database."""
        if rule_id in self.cached_rules:
            return self.cached_rules[rule_id].priority
        
        rule = self._load_rule(rule_id)
        if rule:
            self.cached_rules[rule_id] = rule
            return rule.priority
        
        return 0


# Global instance
conditional_logic = ConditionalLogicService()
