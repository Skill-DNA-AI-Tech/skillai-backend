import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
import uvicorn

from config import settings
from database import init_db
from routes.auth import router as student_auth_router
from routes.admin import router as admin_auth_router
from routes.admin_ops import router as admin_ops_router

# Configure logging format and level
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handles startup and shutdown lifecycles of the application."""
    logger.info("Starting up SkillDNA Tech AI Unified Backend API...")
    # Initialize DB indexes and seed default records
    await init_db()
    yield
    logger.info("Shutting down SkillDNA Tech AI Unified Backend API...")

app = FastAPI(
    title="SkillDNA Tech AI API & Authentication Service",
    description="""
# SkillDNA AI Unified Platform API

Welcome to the **SkillDNA AI** enterprise backend service.

### Authentication & Authorization (RBAC)
- **Public APIs**: Landing page CMS, public certificate verification, student registration & login.
- **Student APIs**: AI Interview coach, dynamic question sessions, Career Twin, learning curricula, MCQ assessments, student profile & scorecards.
- **Admin APIs**: Administrative user management, pre-production test accounts, question bank CRUD, certificate issuance & approvals, analytics overview.

### Interactive Swagger Testing
1. Obtain an access token by executing **POST `/api/auth/login`** or **POST `/api/auth/admin/verify`**.
2. Click the **Authorize** button at the top-right.
3. Paste the returned token into the **Value** field and click **Authorize**.
4. Test any protected endpoint with live Bearer authentication.
    """,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    swagger_ui_parameters={
        "persistAuthorization": True,
        "displayRequestDuration": True,
        "filter": True,
        "tryItOutEnabled": True,
    },
    lifespan=lifespan,
)

# Standardized CORS Configuration
ALLOWED_ORIGINS = [
    "https://skillai-frontend.team-lcoding.workers.dev",
    "https://skillai-frontend.pages.dev",
    "https://skilldna-frontend.pages.dev",
    "https://skillai-backend.onrender.com",
    "https://skilldna-backend.onrender.com",
    "http://localhost:5173",
    "http://localhost:4173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:4173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"https://.*(\.workers\.dev|\.pages\.dev|\.onrender\.com)$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global Exception Handlers
@app.exception_handler(StarletteHTTPException)
async def custom_http_exception_handler(request: Request, exc: StarletteHTTPException):
    """Ensure all HTTP exceptions return structured JSON."""
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers=exc.headers or {},
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Format request validation errors consistently."""
    errors = exc.errors()
    clean_errors = []
    for err in errors:
        clean_errors.append({
            "field": " -> ".join(str(loc) for loc in err.get("loc", [])),
            "message": err.get("msg", "Invalid parameter"),
            "type": err.get("type", "value_error"),
        })
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": "Request validation failed", "errors": clean_errors},
    )

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch-all handler for unhandled exceptions."""
    logger.exception(f"Unhandled server error on {request.method} {request.url.path}: {exc}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error. Please try again later."},
    )

# Primary Authoritative API Routers (Documented in Swagger/OpenAPI)
app.include_router(student_auth_router, prefix="/api")
app.include_router(admin_auth_router, prefix="/api")
app.include_router(admin_ops_router, prefix="/api")

# Fallback alias routers for legacy direct root calls (omitted from OpenAPI docs to keep Swagger pristine)
app.include_router(admin_ops_router, prefix="", include_in_schema=False)
app.include_router(admin_auth_router, prefix="", include_in_schema=False)
app.include_router(student_auth_router, prefix="", include_in_schema=False)

@app.get("/", tags=["Health"])
async def root_health_check():
    """Root platform health probe."""
    return {
        "status": "healthy",
        "service": "SkillDNA Tech AI API Service",
        "version": "1.0.0"
    }

@app.get("/api", tags=["Health"])
@app.get("/api/health", tags=["Health"])
@app.get("/health", tags=["Health"], include_in_schema=False)
async def api_health_check():
    """Comprehensive service health and status probe."""
    return {
        "status": "healthy",
        "service": "SkillDNA Tech AI Backend Service",
        "version": "1.0.0",
        "message": "SkillDNA API is running"
    }

if __name__ == "__main__":
    logger.info(f"Running server on http://{settings.host}:{settings.port}")
    uvicorn.run("main:app", host=settings.host, port=settings.port, reload=True)
