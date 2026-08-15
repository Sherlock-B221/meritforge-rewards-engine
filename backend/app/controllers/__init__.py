from fastapi import APIRouter
from app.controllers import health_controller

api_router = APIRouter(prefix="/api")
api_router.include_router(health_controller.router)
