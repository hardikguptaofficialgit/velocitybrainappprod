import re
from pathlib import Path

from src.services.memory_engine import MemoryEngine


class OrgIngestService:
    def __init__(self):
        self.memory = MemoryEngine()

    def parse_sections(self, content: str) -> list[dict]:
        sections: list[dict] = []
        current_title = 'org-note'
        current_lines: list[str] = []

        for line in content.splitlines():
            match = re.match(r'^\*+\s+(.*)$', line)
            if match:
                if current_lines:
                    sections.append({'title': current_title, 'body': '\n'.join(current_lines).strip()})
                current_title = match.group(1).strip() or 'org-heading'
                current_lines = []
            else:
                current_lines.append(line)

        if current_lines:
            sections.append({'title': current_title, 'body': '\n'.join(current_lines).strip()})

        return [s for s in sections if s['body']]

    def ingest_content(self, source: str, content: str, access_level: str = 'private') -> dict:
        sections = self.parse_sections(content)
        ingested = []
        for idx, section in enumerate(sections[:200]):
            title = section['title']
            body = section['body']
            payload = f"[ORG] {title}\n\n{body[:4000]}"
            ingested.append(self.memory.upsert_from_text(source=f"{source}:org:{idx+1}", content=payload, access_level=access_level))
        return {'sections': len(sections), 'ingested': len(ingested), 'entities': ingested[:25]}

    def ingest_file(self, source: str, path: str, access_level: str = 'private') -> dict:
        text = Path(path).read_text(encoding='utf-8')
        return self.ingest_content(source=source, content=text, access_level=access_level)
