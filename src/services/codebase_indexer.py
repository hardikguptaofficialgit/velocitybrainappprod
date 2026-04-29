"""
Advanced Codebase Indexer with Tree-sitter Integration
Provides intelligent code parsing, indexing, and relationship mapping
"""

import os
import hashlib
from pathlib import Path
from typing import Any, Dict, List, Set, Optional, Tuple
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
import json
import asyncio

try:
    import tree_sitter
    from tree_sitter import Language, Parser
except ImportError:
    tree_sitter = None

from src.core.db import get_conn
from src.core.logging_config import get_logger
from src.core.config import settings


@dataclass
class CodeElement:
    """Represents a code element (function, class, variable, etc.)"""
    id: str
    name: str
    type: str  # function, class, method, variable, interface, etc.
    language: str
    file_path: str
    start_line: int
    end_line: int
    start_column: int
    end_column: int
    docstring: Optional[str] = None
    signature: Optional[str] = None
    parent_id: Optional[str] = None
    children_ids: List[str] = None
    metadata: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.children_ids is None:
            self.children_ids = []
        if self.metadata is None:
            self.metadata = {}


@dataclass
class CodeRelationship:
    """Represents relationships between code elements"""
    source_id: str
    target_id: str
    relationship_type: str  # calls, imports, inherits, implements, uses, etc.
    context: Optional[str] = None
    confidence: float = 1.0
    metadata: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}


class CodebaseIndexer:
    """Advanced codebase indexing with tree-sitter parsing and relationship mapping"""
    
    def __init__(self):
        self.logger = get_logger('codebase_indexer')
        self.parsers: Dict[str, Parser] = {}
        self.languages: Dict[str, Language] = {}
        self.elements_cache: Dict[str, CodeElement] = {}
        self.relationships_cache: List[CodeRelationship] = []
        self.file_hashes: Dict[str, str] = {}
        
        # Initialize parsers
        self._initialize_parsers()
        
    def _initialize_parsers(self):
        """Initialize tree-sitter parsers for supported languages"""
        if tree_sitter is None:
            self.logger.warning("tree-sitter not available, using fallback parsing")
            return
            
        try:
            # Try to load language libraries
            language_configs = {
                'python': 'python',
                'javascript': 'javascript', 
                'typescript': 'typescript',
                'java': 'java',
                'cpp': 'cpp',
                'c': 'c',
                'go': 'go',
                'rust': 'rust',
                'php': 'php',
                'ruby': 'ruby'
            }
            
            for lang_name, lib_name in language_configs.items():
                try:
                    # Try to load from common locations
                    lang_path = self._find_language_library(lib_name)
                    if lang_path:
                        language = Language(lang_path, lang_name)
                        parser = Parser()
                        parser.set_language(language)
                        
                        self.languages[lang_name] = language
                        self.parsers[lang_name] = parser
                        self.logger.info(f"Loaded {lang_name} parser")
                except Exception as e:
                    self.logger.debug(f"Could not load {lang_name} parser: {e}")
                    
        except Exception as e:
            self.logger.error(f"Failed to initialize parsers: {e}")
    
    def _find_language_library(self, language_name: str) -> Optional[str]:
        """Find tree-sitter language library in common locations"""
        possible_paths = [
            f"/usr/local/lib/tree-sitter/libtree-sitter-{language_name}.so",
            f"/usr/lib/tree-sitter/libtree-sitter-{language_name}.so",
            f"./tree-sitter-languages/lib/tree-sitter-{language_name}.so",
            f"~/.local/lib/tree-sitter/libtree-sitter-{language_name}.so",
        ]
        
        for path in possible_paths:
            expanded = os.path.expanduser(path)
            if os.path.exists(expanded):
                return expanded
        
        return None
    
    def get_language_from_extension(self, file_path: str) -> Optional[str]:
        """Detect programming language from file extension"""
        ext = Path(file_path).suffix.lower()
        extension_map = {
            '.py': 'python',
            '.js': 'javascript',
            '.jsx': 'javascript',
            '.ts': 'typescript',
            '.tsx': 'typescript',
            '.java': 'java',
            '.cpp': 'cpp',
            '.cxx': 'cpp',
            '.cc': 'cpp',
            '.c': 'c',
            '.h': 'c',
            '.hpp': 'cpp',
            '.go': 'go',
            '.rs': 'rust',
            '.php': 'php',
            '.rb': 'ruby',
            '.cs': 'csharp',
            '.scala': 'scala',
            '.kt': 'kotlin',
            '.swift': 'swift'
        }
        return extension_map.get(ext)
    
    async def index_repository(self, repo_path: str, force_reindex: bool = False) -> Dict[str, Any]:
        """Index an entire repository"""
        start_time = datetime.now(timezone.utc)
        repo_path = Path(repo_path).resolve()
        
        self.logger.info(f"Starting indexing of repository: {repo_path}")
        
        try:
            # Get all code files
            code_files = self._discover_code_files(repo_path)
            self.logger.info(f"Found {len(code_files)} code files")
            
            # Process files
            elements = []
            relationships = []
            processed_files = 0
            
            for file_path in code_files:
                try:
                    # Check if file needs reindexing
                    if not force_reindex and self._is_file_unchanged(file_path):
                        continue
                    
                    file_elements, file_relationships = await self._parse_file(file_path)
                    elements.extend(file_elements)
                    relationships.extend(file_relationships)
                    
                    # Update file hash
                    self._update_file_hash(file_path)
                    processed_files += 1
                    
                except Exception as e:
                    self.logger.error(f"Failed to parse file {file_path}: {e}")
                    continue
            
            # Store in database
            await self._store_elements(elements)
            await self._store_relationships(relationships)
            
            # Build call graph
            await self._build_call_graph()
            
            duration = (datetime.now(timezone.utc) - start_time).total_seconds()
            
            result = {
                'status': 'success',
                'repository_path': str(repo_path),
                'files_processed': processed_files,
                'elements_indexed': len(elements),
                'relationships_found': len(relationships),
                'duration_seconds': duration,
                'timestamp': datetime.now(timezone.utc).isoformat()
            }
            
            self.logger.info(f"Indexing completed: {result}")
            return result
            
        except Exception as e:
            self.logger.error(f"Repository indexing failed: {e}")
            return {
                'status': 'error',
                'error': str(e),
                'repository_path': str(repo_path),
                'timestamp': datetime.now(timezone.utc).isoformat()
            }
    
    def _discover_code_files(self, repo_path: Path) -> List[Path]:
        """Discover all code files in repository"""
        code_extensions = {
            '.py', '.js', '.jsx', '.ts', '.tsx', '.java', '.cpp', '.cxx', 
            '.cc', '.c', '.h', '.hpp', '.go', '.rs', '.php', '.rb', '.cs',
            '.scala', '.kt', '.swift'
        }
        
        code_files = []
        
        # Skip common ignore patterns
        ignore_patterns = {
            'node_modules', '.git', '__pycache__', '.venv', 'venv', 
            'target', 'build', 'dist', '.pytest_cache', '.mypy_cache'
        }
        
        for file_path in repo_path.rglob('*'):
            if file_path.is_file() and file_path.suffix in code_extensions:
                # Check if file is in ignored directory
                if any(pattern in str(file_path) for pattern in ignore_patterns):
                    continue
                code_files.append(file_path)
        
        return code_files
    
    async def _parse_file(self, file_path: Path) -> Tuple[List[CodeElement], List[CodeRelationship]]:
        """Parse a single file and extract elements and relationships"""
        language = self.get_language_from_extension(str(file_path))
        if not language:
            return [], []
        
        try:
            content = file_path.read_text(encoding='utf-8')
            
            if language in self.parsers:
                return await self._parse_with_tree_sitter(content, str(file_path), language)
            else:
                return await self._parse_with_regex(content, str(file_path), language)
                
        except Exception as e:
            self.logger.error(f"Failed to parse file {file_path}: {e}")
            return [], []
    
    async def _parse_with_tree_sitter(self, content: str, file_path: str, language: str) -> Tuple[List[CodeElement], List[CodeRelationship]]:
        """Parse file using tree-sitter"""
        parser = self.parsers[language]
        tree = parser.parse(bytes(content, 'utf-8'))
        
        elements = []
        relationships = []
        
        # Walk the tree and extract elements
        self._extract_elements_from_node(tree.root_node, content, file_path, language, elements, relationships)
        
        return elements, relationships
    
    def _extract_elements_from_node(self, node, content: str, file_path: str, language: str, 
                                  elements: List[CodeElement], relationships: List[CodeRelationship], 
                                  parent: Optional[CodeElement] = None):
        """Recursively extract elements from tree-sitter nodes"""
        node_type = node.type
        
        # Define element types based on language
        element_types = {
            'python': {
                'function_definition': 'function',
                'class_definition': 'class',
                'async_function_definition': 'async_function',
                'method_definition': 'method',
                'assignment': 'variable',
                'import_statement': 'import',
                'from_import_statement': 'import'
            },
            'javascript': {
                'function_declaration': 'function',
                'class_declaration': 'class',
                'method_definition': 'method',
                'variable_declaration': 'variable',
                'import_statement': 'import'
            },
            'typescript': {
                'function_declaration': 'function',
                'class_declaration': 'class',
                'method_definition': 'method',
                'variable_declaration': 'variable',
                'interface_declaration': 'interface',
                'type_alias_declaration': 'type',
                'import_statement': 'import'
            }
        }
        
        lang_types = element_types.get(language, {})
        
        if node_type in lang_types:
            element = self._create_element_from_node(node, content, file_path, language, lang_types[node_type])
            elements.append(element)
            
            if parent:
                element.parent_id = parent.id
                parent.children_ids.append(element)
            
            # Extract relationships
            self._extract_relationships_from_node(node, content, element, elements, relationships)
            
            # Recurse with this element as parent
            for child in node.children:
                self._extract_elements_from_node(child, content, file_path, language, elements, relationships, element)
        else:
            # Just recurse without creating element
            for child in node.children:
                self._extract_elements_from_node(child, content, file_path, language, elements, relationships, parent)
    
    def _create_element_from_node(self, node, content: str, file_path: str, language: str, element_type: str) -> CodeElement:
        """Create CodeElement from tree-sitter node"""
        lines = content.split('\n')
        start_line = node.start_point[0]
        end_line = node.end_point[0]
        
        # Extract name
        name = self._extract_element_name(node, content, element_type)
        
        # Extract docstring
        docstring = self._extract_docstring(node, content, language)
        
        # Extract signature
        signature = self._extract_signature(node, content, element_type)
        
        # Generate unique ID
        element_id = hashlib.md5(f"{file_path}:{name}:{start_line}:{element_type}".encode()).hexdigest()
        
        return CodeElement(
            id=element_id,
            name=name,
            type=element_type,
            language=language,
            file_path=file_path,
            start_line=start_line + 1,
            end_line=end_line + 1,
            start_column=node.start_point[1],
            end_column=node.end_point[1],
            docstring=docstring,
            signature=signature,
            metadata={
                'node_type': node.type,
                'is_public': self._is_public_element(name, language),
                'complexity': self._calculate_complexity(node, content)
            }
        )
    
    def _extract_element_name(self, node, content: str, element_type: str) -> str:
        """Extract element name from node"""
        # This is a simplified implementation
        # In practice, you'd traverse the node to find the identifier
        if hasattr(node, 'children'):
            for child in node.children:
                if child.type == 'identifier':
                    start = child.start_byte
                    end = child.end_byte
                    return content[start:end].strip()
        
        # Fallback
        return f"unnamed_{element_type}"
    
    def _extract_docstring(self, node, content: str, language: str) -> Optional[str]:
        """Extract docstring from element"""
        # Implementation varies by language
        # This is a simplified version
        return None
    
    def _extract_signature(self, node, content: str, element_type: str) -> Optional[str]:
        """Extract function/method signature"""
        # Implementation varies by language
        return None
    
    def _is_public_element(self, name: str, language: str) -> bool:
        """Check if element is public"""
        if language == 'python':
            return not name.startswith('_')
        elif language in ['javascript', 'typescript']:
            return True  # Most JS/TS elements are public
        return True
    
    def _calculate_complexity(self, node, content: str) -> int:
        """Calculate cyclomatic complexity"""
        # Simplified complexity calculation
        complexity_keywords = ['if', 'elif', 'else', 'for', 'while', 'try', 'except', 'case']
        complexity = 1  # Base complexity
        
        node_text = content[node.start_byte:node.end_byte]
        for keyword in complexity_keywords:
            complexity += node_text.count(keyword)
        
        return complexity
    
    def _extract_relationships_from_node(self, node, content: str, element: CodeElement, 
                                       elements: List[CodeElement], relationships: List[CodeRelationship]):
        """Extract relationships from node (calls, imports, etc.)"""
        # This is a simplified implementation
        # In practice, you'd analyze the AST to find function calls, imports, inheritance, etc.
        pass
    
    async def _parse_with_regex(self, content: str, file_path: str, language: str) -> Tuple[List[CodeElement], List[CodeRelationship]]:
        """Fallback parsing using regex patterns"""
        # Simple regex-based parsing for languages without tree-sitter
        elements = []
        relationships = []
        
        # Language-specific patterns
        patterns = {
            'python': {
                'function': r'def\s+(\w+)\s*\(',
                'class': r'class\s+(\w+)(?:\s*\(\s*(\w+)\s*\))?:',
                'async_function': r'async\s+def\s+(\w+)\s*\(',
                'import': r'import\s+(\w+)',
                'from_import': r'from\s+(\w+)\s+import'
            },
            'javascript': {
                'function': r'function\s+(\w+)\s*\(',
                'class': r'class\s+(\w+)',
                'method': r'(\w+)\s*:\s*function',
                'import': r'import.*from\s+[\'"]([^\'"]+)[\'"]'
            }
        }
        
        lang_patterns = patterns.get(language, {})
        
        for element_type, pattern in lang_patterns.items():
            import re
            for match in re.finditer(pattern, content):
                name = match.group(1)
                line_num = content[:match.start()].count('\n') + 1
                
                element_id = hashlib.md5(f"{file_path}:{name}:{line_num}:{element_type}".encode()).hexdigest()
                
                elements.append(CodeElement(
                    id=element_id,
                    name=name,
                    type=element_type,
                    language=language,
                    file_path=file_path,
                    start_line=line_num,
                    end_line=line_num,
                    start_column=match.start(),
                    end_column=match.end(),
                    metadata={'parsed_with': 'regex'}
                ))
        
        return elements, relationships
    
    def _is_file_unchanged(self, file_path: Path) -> bool:
        """Check if file has changed since last indexing"""
        try:
            content = file_path.read_bytes()
            current_hash = hashlib.md5(content).hexdigest()
            file_key = str(file_path)
            
            return self.file_hashes.get(file_key) == current_hash
        except Exception:
            return False
    
    def _update_file_hash(self, file_path: Path):
        """Update file hash after successful parsing"""
        try:
            content = file_path.read_bytes()
            current_hash = hashlib.md5(content).hexdigest()
            self.file_hashes[str(file_path)] = current_hash
        except Exception as e:
            self.logger.error(f"Failed to update hash for {file_path}: {e}")
    
    async def _store_elements(self, elements: List[CodeElement]):
        """Store code elements in database"""
        if not elements:
            return
            
        sql = """
        INSERT INTO code_elements (
            id, name, type, language, file_path, start_line, end_line,
            start_column, end_column, docstring, signature, parent_id,
            children_ids, metadata, created_at, updated_at
        ) VALUES (
            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            type = EXCLUDED.type,
            language = EXCLUDED.language,
            file_path = EXCLUDED.file_path,
            start_line = EXCLUDED.start_line,
            end_line = EXCLUDED.end_line,
            start_column = EXCLUDED.start_column,
            end_column = EXCLUDED.end_column,
            docstring = EXCLUDED.docstring,
            signature = EXCLUDED.signature,
            parent_id = EXCLUDED.parent_id,
            children_ids = EXCLUDED.children_ids,
            metadata = EXCLUDED.metadata,
            updated_at = NOW()
        """
        
        try:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    for element in elements:
                        cur.execute(sql, (
                            element.id, element.name, element.type, element.language,
                            element.file_path, element.start_line, element.end_line,
                            element.start_column, element.end_column, element.docstring,
                            element.signature, element.parent_id, json.dumps(element.children_ids),
                            json.dumps(element.metadata)
                        ))
            self.logger.info(f"Stored {len(elements)} code elements")
        except Exception as e:
            self.logger.error(f"Failed to store elements: {e}")
    
    async def _store_relationships(self, relationships: List[CodeRelationship]):
        """Store code relationships in database"""
        if not relationships:
            return
            
        sql = """
        INSERT INTO code_relationships (
            source_id, target_id, relationship_type, context, confidence, metadata, created_at
        ) VALUES (
            %s, %s, %s, %s, %s, %s, NOW()
        )
        ON CONFLICT (source_id, target_id, relationship_type) DO UPDATE SET
            context = EXCLUDED.context,
            confidence = EXCLUDED.confidence,
            metadata = EXCLUDED.metadata
        """
        
        try:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    for rel in relationships:
                        cur.execute(sql, (
                            rel.source_id, rel.target_id, rel.relationship_type,
                            rel.context, rel.confidence, json.dumps(rel.metadata)
                        ))
            self.logger.info(f"Stored {len(relationships)} code relationships")
        except Exception as e:
            self.logger.error(f"Failed to store relationships: {e}")
    
    async def _build_call_graph(self):
        """Build call graph from relationships"""
        # This would analyze the relationships to build a comprehensive call graph
        # Implementation would depend on your specific needs
        pass
    
    async def search_elements(self, query: str, language: Optional[str] = None, 
                            element_type: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
        """Search for code elements"""
        sql_conditions = ["(LOWER(name) LIKE %s OR LOWER(docstring) LIKE %s OR LOWER(signature) LIKE %s)"]
        params = [f"%{query.lower()}%", f"%{query.lower()}%", f"%{query.lower()}%"]
        
        if language:
            sql_conditions.append("language = %s")
            params.append(language)
        
        if element_type:
            sql_conditions.append("type = %s")
            params.append(element_type)
        
        sql = f"""
        SELECT id, name, type, language, file_path, start_line, end_line,
               docstring, signature, parent_id, children_ids, metadata
        FROM code_elements
        WHERE {' AND '.join(sql_conditions)}
        ORDER BY 
            CASE WHEN name ILIKE %s THEN 1 ELSE 2 END,
            name
        LIMIT %s
        """
        
        params.extend([f"{query}%", limit])
        
        try:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute(sql, params)
                    return cur.fetchall()
        except Exception as e:
            self.logger.error(f"Failed to search elements: {e}")
            return []
    
    async def get_element_relationships(self, element_id: str, relationship_type: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get relationships for a specific element"""
        sql_conditions = ["source_id = %s OR target_id = %s"]
        params = [element_id, element_id]
        
        if relationship_type:
            sql_conditions.append("relationship_type = %s")
            params.append(relationship_type)
        
        sql = f"""
        SELECT source_id, target_id, relationship_type, context, confidence, metadata
        FROM code_relationships
        WHERE {' AND '.join(sql_conditions)}
        ORDER BY confidence DESC
        """
        
        try:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute(sql, params)
                    return cur.fetchall()
        except Exception as e:
            self.logger.error(f"Failed to get element relationships: {e}")
            return []


# Global indexer instance
codebase_indexer = CodebaseIndexer()
