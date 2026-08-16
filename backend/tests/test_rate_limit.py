import pytest

from app.core.exceptions import RateLimitedError
from app.core.rate_limit import InMemoryRateLimiter


def test_allows_up_to_limit_then_blocks():
    t = {"now": 1000.0}
    rl = InMemoryRateLimiter(times=2, per_seconds=60, clock=lambda: t["now"])
    rl.check("user-a")  # 1
    rl.check("user-a")  # 2
    with pytest.raises(RateLimitedError):
        rl.check("user-a")  # 3 → blocked


def test_window_resets_after_expiry():
    t = {"now": 1000.0}
    rl = InMemoryRateLimiter(times=1, per_seconds=10, clock=lambda: t["now"])
    rl.check("u")
    with pytest.raises(RateLimitedError):
        rl.check("u")
    t["now"] = 1011.0  # past the 10s window
    rl.check("u")  # new window → allowed


def test_keys_are_isolated():
    t = {"now": 0.0}
    rl = InMemoryRateLimiter(times=1, per_seconds=60, clock=lambda: t["now"])
    rl.check("a")
    rl.check("b")  # different key, independent budget
    with pytest.raises(RateLimitedError):
        rl.check("a")
