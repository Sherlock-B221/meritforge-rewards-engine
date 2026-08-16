from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings
from app.controllers import api_router
from app.core.errors import register_error_handlers

def create_app() -> FastAPI:
    app = FastAPI(title="meritforge")

    settings = get_settings()
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.frontend_origin],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(api_router)
    register_error_handlers(app)
    return app

app = create_app()
