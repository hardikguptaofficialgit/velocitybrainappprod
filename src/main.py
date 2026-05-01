import logging
from importlib import import_module
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timezone

from src.api.routes import router
from src.background.scheduler import start_scheduler
from src.core.config import settings
from src.core.logging_config import setup_logging, get_logger
from src.core_api.auth import create_auth_router
from src.core_api.brain import create_brain_router
from src.core_api.skills import create_skills_router
from src.monitoring.health_monitor import health_monitor

# Initialize logging
setup_logging(
    log_level=settings.log_level,
    log_file=settings.log_file,
    enable_json=settings.enable_json_logging,
    enable_console=True
)

logger = get_logger('main')


def _load_optional_router(module_name: str, router_name: str = "router"):
    """Load optional API routers without blocking app startup."""
    try:
        module = import_module(module_name)
        return getattr(module, router_name)
    except Exception as exc:
        logger.warning("Skipping optional router %s: %s", module_name, exc)
        return None

@asynccontextmanager
async def lifespan(_: FastAPI):
    """Application lifespan management."""
    logger.info(f"Starting {settings.app_name} in {settings.env} mode")
    
    try:
        # Start background scheduler
        start_scheduler()
        logger.info("Background scheduler started")
        
        # Run initial health check
        health_status = await health_monitor.run_health_checks()
        logger.info(f"Initial health check: {health_status['status']}")
        
        yield
        
    except Exception as exc:
        logger.error(f"Failed to start application: {exc}")
        raise
    finally:
        logger.info("Application shutdown complete")


app = FastAPI(
    title=settings.app_name,
    version='1.0.0',
    lifespan=lifespan,
    description="Velocity Brain: AI agent memory and execution engine"
)

# Add CORS middleware if configured
if hasattr(settings, 'cors_origins'):
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[origin.strip() for origin in settings.cors_origins.split(',') if origin.strip()] if settings.cors_origins else [],
        allow_credentials=getattr(settings, 'cors_allow_credentials', False),
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Add request logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log all requests and collect metrics."""
    start_time = datetime.now(timezone.utc)
    
    try:
        response = await call_next(request)
        process_time = (datetime.now(timezone.utc) - start_time).total_seconds() * 1000
        
        # Record metrics
        health_monitor.record_request(
            response_time_ms=process_time,
            is_error=response.status_code >= 400
        )
        
        # Log request
        logger.info(
            f"{request.method} {request.url.path} - {response.status_code} - {process_time:.2f}ms",
            extra={
                "method": request.method,
                "path": request.url.path,
                "status_code": response.status_code,
                "response_time_ms": process_time,
                "user_agent": request.headers.get("user-agent"),
                "remote_addr": request.client.host if request.client else None
            }
        )
        
        response.headers["X-Response-Time"] = f"{process_time:.2f}"
        return response
        
    except Exception as exc:
        process_time = (datetime.now(timezone.utc) - start_time).total_seconds() * 1000
        
        # Record error metrics
        health_monitor.record_request(
            response_time_ms=process_time,
            is_error=True
        )
        
        logger.error(
            f"Request failed: {request.method} {request.url.path} - {exc} - {process_time:.2f}ms",
            extra={
                "method": request.method,
                "path": request.url.path,
                "error": str(exc),
                "response_time_ms": process_time
            },
            exc_info=True
        )
        
        raise

app.include_router(router)
app.include_router(create_auth_router())
app.include_router(create_brain_router())
app.include_router(create_skills_router())

for optional_router in (
    _load_optional_router('src.api.advanced_routes'),
    _load_optional_router('src.api.automation_routes'),
    _load_optional_router('src.api.enhanced_routes'),
):
    if optional_router is not None:
        app.include_router(optional_router)

DOCS_ROOT = Path('docs').resolve()
WEB_ROOT = Path('web').resolve()
DOC_PAGES: list[tuple[str, str, str, Path]] = [
    ('overview', 'Overview', 'Getting Started', Path('README.md').resolve()),
    ('client-integrations', 'Client Integrations', 'Getting Started', (DOCS_ROOT / 'CLIENT_INTEGRATIONS.md').resolve()),
    ('next-level', 'Next Level Roadmap', 'Getting Started', (DOCS_ROOT / 'NEXT_LEVEL.md').resolve()),
    ('architecture', 'Architecture', 'Core Concepts', (DOCS_ROOT / 'ARCHITECTURE.md').resolve()),
    ('db-schema', 'DB Schema', 'Core Concepts', (DOCS_ROOT / 'DB_SCHEMA.md').resolve()),
    ('skill-system', 'Skill System', 'Core Concepts', (DOCS_ROOT / 'SKILL_SYSTEM.md').resolve()),
    ('agent-loop', 'Agent Loop', 'Workflows', (DOCS_ROOT / 'AGENT_LOOP.md').resolve()),
    ('workflows', 'Workflows', 'Workflows', (DOCS_ROOT / 'WORKFLOWS.md').resolve()),
    ('api-design', 'API Design', 'Interfaces', (DOCS_ROOT / 'API_DESIGN.md').resolve()),
    ('folder-structure', 'Folder Structure', 'Interfaces', (DOCS_ROOT / 'FOLDER_STRUCTURE.md').resolve()),
]
DOC_PAGE_MAP: dict[str, tuple[str, str, Path]] = {
    slug: (title, category, path) for slug, title, category, path in DOC_PAGES
}


if WEB_ROOT.exists():
    app.mount('/guide/static', StaticFiles(directory=str(WEB_ROOT)), name='guide-static')

ASSETS_ROOT = Path('docs/assets').resolve()
if ASSETS_ROOT.exists():
    app.mount('/guide/static/assets', StaticFiles(directory=str(ASSETS_ROOT)), name='docs-assets')
@app.get('/')
def root():
    """Root endpoint with application information."""
    return {
        'app': settings.app_name,
        'mode': 'api-and-cli',
        'version': '1.0.0',
        'environment': settings.env,
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'endpoints': {
            'docs': '/docs',
            'guide': '/guide',
            'health': '/v1/healthz',
            'detailed_health': '/v1/health/detailed'
        }
    }


@app.get('/guide', response_class=HTMLResponse)
def guide_home():
    index_file = WEB_ROOT / 'index.html'
    if not index_file.exists():
        raise HTTPException(status_code=404, detail='Guide app not found')
    return index_file.read_text(encoding='utf-8')


@app.get('/v1/health/detailed')
async def detailed_health():
    """Detailed health check endpoint with metrics."""
    try:
        health_status = await health_monitor.run_health_checks()
        return health_status
    except Exception as exc:
        logger.error(f"Detailed health check failed: {exc}")
        raise HTTPException(
            status_code=503,
            detail="Health check service unavailable"
        )


@app.get('/v1/docs/pages')
def docs_pages():
    pages = [
        {'slug': slug, 'title': title, 'category': category}
        for slug, title, category, file_path in DOC_PAGES
        if path_exists(file_path)
    ]
    return {'count': len(pages), 'pages': pages}


def path_exists(path: Path) -> bool:
    try:
        return path.exists() and path.is_file()
    except OSError:
        return False


@app.get('/v1/docs/page/{slug}')
def docs_page(slug: str):
    page = DOC_PAGE_MAP.get(slug)
    if not page:
        raise HTTPException(status_code=404, detail='Unknown docs page')
    title, category, file_path = page
    if not path_exists(file_path):
        raise HTTPException(status_code=404, detail='Docs page missing')
    try:
        display_path = str(file_path.relative_to(Path.cwd()))
    except ValueError:
        display_path = str(file_path)

    return {
        'slug': slug,
        'title': title,
        'category': category,
        'path': display_path,
        'markdown': file_path.read_text(encoding='utf-8'),
    }
