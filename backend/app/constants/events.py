import uuid

# Fixed namespace for uuid5 so deterministic ids are stable across processes/restarts.
EVENT_NAMESPACE = uuid.UUID("6f9b6d3e-1a2b-5c4d-8e7f-0a1b2c3d4e5f")

POST_CREATED = "post_created"
POST_VIEWED = "post_viewed"
COMMENT_POSTED = "comment_posted"
SOLUTION_MARKED = "solution_marked"
POST_UPVOTED = "post_upvoted"

# Synthetic event type: aggregates posts + comments + solutions for the
# profile streak visual and contribution-based challenges.
CONTRIBUTION = "contribution"
CONTRIBUTION_EVENTS = frozenset({POST_CREATED, COMMENT_POSTED, SOLUTION_MARKED})


def deterministic_event_id(event_type: str, *parts: object) -> uuid.UUID:
    """uuid5 over the event type + entity keys → the same logical action always
    produces the same event_id, which the events table uses as an idempotency PK."""
    name = ":".join([event_type, *(str(p) for p in parts)])
    return uuid.uuid5(EVENT_NAMESPACE, name)
