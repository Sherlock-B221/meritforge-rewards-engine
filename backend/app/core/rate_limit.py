import time
from collections.abc import Callable

from fastapi import Depends

from app.config import get_settings
from app.controllers.deps import require_user
from app.core.exceptions import RateLimitedError
from app.services.auth.security import Principal


class InMemoryRateLimiter:
    """Per-key fixed-window limiter. Single-process (fine for this app); a
    distributed deployment would swap the backing store. `clock` is injectable
    for deterministic tests."""

    def __init__(self, *, times: int, per_seconds: int, clock: Callable[[], float] = time.monotonic):
        self._times = times
        self._per = per_seconds
        self._clock = clock
        self._windows: dict[str, tuple[float, int]] = {}  # key -> (window_start, count)

    def check(self, key: str) -> None:
        now = self._clock()
        start, count = self._windows.get(key, (now, 0))
        if now - start >= self._per:
            start, count = now, 0  # window expired → reset
        if count >= self._times:
            retry_after = max(1, int(self._per - (now - start)))
            raise RateLimitedError(retry_after)
        self._windows[key] = (start, count + 1)

    def reset(self) -> None:
        self._windows.clear()


def _build_events_limiter() -> InMemoryRateLimiter:
    s = get_settings()
    return InMemoryRateLimiter(
        times=s.events_rate_limit_times, per_seconds=s.events_rate_limit_seconds
    )


events_limiter = _build_events_limiter()


async def rate_limit_events(principal: Principal = Depends(require_user)) -> Principal:
    events_limiter.check(str(principal.user_id))
    return principal
