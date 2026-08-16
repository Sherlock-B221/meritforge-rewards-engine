from sqlalchemy import ColumnElement, func

from app.config import get_settings
from app.models import Post


def trending_score(upvote_count: int, comment_count: int, age_hours: float, *, settings=None) -> float:
    """Hacker-News-style gravity score. Engagement decays with post age.
    Documented formula: (w_up*upvotes + w_comment*comments) / (age_hours + 2)^gravity."""
    s = settings or get_settings()
    engagement = s.trending_upvote_weight * upvote_count + s.trending_comment_weight * comment_count
    return engagement / ((age_hours + 2.0) ** s.trending_gravity)


def trending_order_expr() -> ColumnElement:
    """SQL mirror of trending_score for ORDER BY … DESC (age from now()-created_at)."""
    s = get_settings()
    age_hours = func.extract("epoch", func.now() - Post.created_at) / 3600.0
    engagement = s.trending_upvote_weight * Post.upvote_count + s.trending_comment_weight * Post.comment_count
    return engagement / func.power(age_hours + 2.0, s.trending_gravity)
