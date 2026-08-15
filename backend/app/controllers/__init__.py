from fastapi import APIRouter
from app.controllers import auth_controller, health_controller

api_router = APIRouter(prefix="/api")
api_router.include_router(health_controller.router)
api_router.include_router(auth_controller.router)
