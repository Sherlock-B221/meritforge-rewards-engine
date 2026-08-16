import uuid

from app.constants import events
from app.constants.enums import EventStatus


def test_event_status_values():
    assert EventStatus.PENDING.value == "pending"
    assert EventStatus.PROCESSED.value == "processed"
    assert EventStatus.FAILED.value == "failed"


def test_event_type_strings():
    assert events.POST_CREATED == "post_created"
    assert events.POST_VIEWED == "post_viewed"
    assert events.COMMENT_POSTED == "comment_posted"
    assert events.SOLUTION_MARKED == "solution_marked"
    assert events.POST_UPVOTED == "post_upvoted"


def test_deterministic_event_id_is_stable_and_typed():
    pid = uuid.uuid4()
    a = events.deterministic_event_id(events.POST_CREATED, pid)
    b = events.deterministic_event_id(events.POST_CREATED, pid)
    assert isinstance(a, uuid.UUID)
    assert a == b  # same action → same id (idempotency key)


def test_deterministic_event_id_varies_by_type_and_parts():
    pid = uuid.uuid4()
    other = uuid.uuid4()
    assert events.deterministic_event_id(events.POST_CREATED, pid) != events.deterministic_event_id(events.POST_VIEWED, pid)
    assert events.deterministic_event_id(events.POST_VIEWED, pid, "u1") != events.deterministic_event_id(events.POST_VIEWED, pid, "u2")
