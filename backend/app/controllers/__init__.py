from fastapi import APIRouter
from app.controllers import (
    admin_challenges_controller,
    auth_controller,
    challenges_controller,
    comments_controller,
    events_controller,
    health_controller,
    posts_controller,
)

api_router = APIRouter(prefix="/api")
api_router.include_router(health_controller.router)
api_router.include_router(auth_controller.router)
api_router.include_router(posts_controller.router)
api_router.include_router(comments_controller.router)
api_router.include_router(events_controller.router)
api_router.include_router(admin_challenges_controller.router)
api_router.include_router(challenges_controller.router)
