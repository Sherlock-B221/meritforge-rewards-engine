from datetime import date, datetime, time, timedelta, timezone


def utc_today() -> date:
    return datetime.now(timezone.utc).date()


def date_of(dt: datetime) -> date:
    """UTC calendar date of a (tz-aware) timestamp. Naive input is assumed UTC."""
    if dt.tzinfo is None:
        return dt.date()
    return dt.astimezone(timezone.utc).date()


def iso_week_key(d: date) -> str:
    """ISO-week bucket, e.g. '2026-W33'. Weekly challenges reset implicitly when
    this key rolls over on Monday."""
    year, week, _ = d.isocalendar()
    return f"{year}-W{week:02d}"


def period_key_for(window: str, d: date) -> str:
    """'weekly' → the ISO-week key; anything else ('total') → '' (one-shot)."""
    return iso_week_key(d) if window == "weekly" else ""


def next_monday_utc(now: datetime) -> datetime:
    """The next UTC Monday 00:00 strictly after `now` — the weekly reset instant."""
    d = date_of(now)
    days_ahead = (7 - d.weekday()) % 7 or 7
    return datetime.combine(d + timedelta(days=days_ahead), time.min, tzinfo=timezone.utc)
