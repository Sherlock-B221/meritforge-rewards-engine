import uuid

import pytest
from pydantic import ValidationError

from app.schemas.common import Page
from app.schemas.forum import AuthorOut, CommentOut, PostCreate, PostDetailOut, PostSummaryOut


def test_post_create_rejects_short_title():
    with pytest.raises(ValidationError):
        PostCreate(title="hey", body="b")


def test_post_create_defaults_tags_empty():
    pc = PostCreate(title="A long enough title", body="some body")
    assert pc.tags == []


def test_comment_out_is_recursive():
    child = CommentOut(
        id=uuid.uuid4(), post_id=uuid.uuid4(), parent_comment_id=None,
        author=AuthorOut(id=uuid.uuid4(), username="ria"),
        body="child", is_solution=False, created_at="2026-08-16T00:00:00Z",
    )
    parent = CommentOut(
        id=uuid.uuid4(), post_id=uuid.uuid4(), parent_comment_id=None,
        author=AuthorOut(id=uuid.uuid4(), username="ria"),
        body="parent", is_solution=False, created_at="2026-08-16T00:00:00Z",
        replies=[child],
    )
    assert parent.replies[0].body == "child"


def test_page_shape():
    p = Page[PostSummaryOut](items=[], page=1, limit=20, total=0, has_next=False)
    assert p.model_dump()["items"] == []


def test_post_detail_extends_summary():
    assert set(PostSummaryOut.model_fields).issubset(set(PostDetailOut.model_fields))
    assert "comments" in PostDetailOut.model_fields
