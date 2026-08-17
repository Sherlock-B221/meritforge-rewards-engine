import asyncio
import contextlib
from collections.abc import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings
from app.controllers import api_router
from app.core.errors import register_error_handlers


@contextlib.asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    worker_task: asyncio.Task | None = None
    if get_settings().run_worker_inline:
        from app.core.worker import run_forever

        worker_task = asyncio.create_task(run_forever())
    yield
    if worker_task is not None:
        worker_task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await worker_task


def create_app() -> FastAPI:
    app = FastAPI(title="meritforge", lifespan=lifespan)

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
