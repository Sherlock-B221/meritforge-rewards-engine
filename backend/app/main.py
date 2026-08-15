from fastapi import FastAPI
from app.controllers import api_router
from app.core.errors import register_error_handlers

def create_app() -> FastAPI:
    app = FastAPI(title="meritforge")
    app.include_router(api_router)
    register_error_handlers(app)
    return app

app = create_app()
