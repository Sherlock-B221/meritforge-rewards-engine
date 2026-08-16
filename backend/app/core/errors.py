from fastapi import FastAPI, Request, status
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.constants import error_codes as codes


def error_body(code: str, message: str, details: dict | None = None) -> dict:
    return {"error": {"code": code, "message": message, "details": details or {}}}


class AppError(Exception):
    def __init__(self, code, message, status_code=400, details=None, headers=None):
        self.code, self.message, self.status_code = code, message, status_code
        self.details, self.headers = details or {}, headers
        super().__init__(message)


_HTTP_CODE = {401: codes.UNAUTHORIZED, 403: codes.FORBIDDEN, 404: codes.NOT_FOUND}


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app(_: Request, exc: AppError):
        return JSONResponse(
            status_code=exc.status_code,
            content=error_body(exc.code, exc.message, exc.details),
            headers=exc.headers,
        )

    @app.exception_handler(RequestValidationError)
    async def _val(_: Request, exc: RequestValidationError):
        # jsonable_encoder: Pydantic's raw error dicts may embed the original
        # exception object (e.g. under `ctx.error` for a model_validator's
        # `raise ValueError(...)`), which json.dumps cannot serialize directly.
        errors = jsonable_encoder(exc.errors(), exclude={"ctx"})
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=error_body(codes.VALIDATION_ERROR, "Request validation failed", {"errors": errors}),
        )

    @app.exception_handler(StarletteHTTPException)
    async def _http(_: Request, exc: StarletteHTTPException):
        code = _HTTP_CODE.get(exc.status_code, codes.HTTP_ERROR)
        return JSONResponse(
            status_code=exc.status_code,
            content=error_body(code, str(exc.detail)),
        )
