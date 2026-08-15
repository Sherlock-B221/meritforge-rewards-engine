from fastapi import FastAPI
from app.controllers import api_router

def create_app() -> FastAPI:
    app = FastAPI(title="meritforge")
    app.include_router(api_router)
    return app

app = create_app()
