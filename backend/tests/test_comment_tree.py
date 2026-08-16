import uuid

from app.schemas.forum import AuthorOut, CommentOut
from app.services.forum.comment_tree import build_comment_tree


def _c(cid, parent, body):
    return CommentOut(
        id=cid, post_id=uuid.uuid4(), parent_comment_id=parent,
        author=AuthorOut(id=uuid.uuid4(), username="ria"),
        body=body, is_solution=False, created_at="2026-08-16T00:00:00Z",
    )


def test_build_tree_nests_children_in_order():
    root_id, a_id, b_id = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    flat = [
        _c(root_id, None, "root"),
        _c(a_id, root_id, "first reply"),
        _c(b_id, root_id, "second reply"),
        _c(uuid.uuid4(), a_id, "nested reply"),
    ]
    roots = build_comment_tree(flat)
    assert len(roots) == 1
    assert roots[0].body == "root"
    assert [r.body for r in roots[0].replies] == ["first reply", "second reply"]
    assert roots[0].replies[0].replies[0].body == "nested reply"


def test_orphan_parent_treated_as_root():
    orphan = _c(uuid.uuid4(), uuid.uuid4(), "orphan")  # parent not in the set
    roots = build_comment_tree([orphan])
    assert len(roots) == 1 and roots[0].body == "orphan"
