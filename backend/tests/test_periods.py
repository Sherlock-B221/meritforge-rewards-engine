from datetime import date, datetime, timezone

from app.services.engine.periods import date_of, iso_week_key, period_key_for


def test_iso_week_key_format():
    # 2026-08-16 is a Sunday in ISO week 33 of 2026.
    assert iso_week_key(date(2026, 8, 16)) == "2026-W33"
    # Monday 2026-08-17 starts ISO week 34.
    assert iso_week_key(date(2026, 8, 17)) == "2026-W34"


def test_iso_week_key_zero_pads_week():
    assert iso_week_key(date(2026, 1, 5)) == "2026-W02"


def test_date_of_converts_to_utc():
    dt = datetime(2026, 8, 16, 23, 30, tzinfo=timezone.utc)
    assert date_of(dt) == date(2026, 8, 16)


def test_period_key_for_weekly_vs_total():
    d = date(2026, 8, 16)
    assert period_key_for("weekly", d) == "2026-W33"
    assert period_key_for("total", d) == ""
