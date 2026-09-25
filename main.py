import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
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
    logger.info("Starting up SkillDNA Tech AI Authentication Backend...")
    # Initialize DB indexes and seed default records
    await init_db()
    yield
    logger.info("Shutting down SkillDNA Tech AI Authentication Backend...")

app = FastAPI(
    title="SkillDNA Tech AI Auth Module",
    description="Authentication and Role Authorization Module supporting Student Login, Google OAuth, Forgot Password OTP, and Mandatory Two-Step Admin OTP Login.",
    version="1.0.0",
    lifespan=lifespan,
)

# Set up CORS middleware to allow cross-origin requests from the React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust in production to specify the exact domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Routers under consistent /api prefix as well as root prefix
app.include_router(student_auth_router, prefix="/api")
app.include_router(admin_auth_router, prefix="/api")
app.include_router(admin_ops_router, prefix="/api")
app.include_router(admin_ops_router, prefix="")
app.include_router(admin_auth_router, prefix="")
app.include_router(student_auth_router, prefix="")

@app.get("/")
async def root_health_check():
    return {
        "status": "healthy",
        "service": "SkillDNA Tech AI Auth Service",
        "version": "1.0.0"
    }

@app.get("/api")
@app.get("/api/health")
@app.get("/health")
async def api_health_check():
    return {
        "status": "healthy",
        "service": "SkillDNA Tech AI Backend Service",
        "version": "1.0.0",
        "message": "SkillDNA API is running"
    }


if __name__ == "__main__":
    logger.info(f"Running server on http://{settings.host}:{settings.port}")
    uvicorn.run("main:app", host=settings.host, port=settings.port, reload=True)
