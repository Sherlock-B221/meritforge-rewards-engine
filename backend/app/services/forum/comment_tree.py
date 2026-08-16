from app.models import Comment
from app.schemas.forum import AuthorOut, CommentOut


def to_comment_out(comment: Comment) -> CommentOut:
    """Map an ORM Comment (author eagerly loaded) to a CommentOut with no replies yet."""
    return CommentOut(
        id=comment.id,
        post_id=comment.post_id,
        parent_comment_id=comment.parent_comment_id,
        author=AuthorOut(id=comment.author.id, username=comment.author.username),
        body=comment.body,
        is_solution=comment.is_solution,
        created_at=comment.created_at,
    )


def build_comment_tree(comments: list[CommentOut]) -> list[CommentOut]:
    """Turn a flat, oldest-first list into a nested tree. Children preserve input
    order (chronological). Nodes whose parent is absent are treated as roots."""
    by_id = {c.id: c for c in comments}
    for c in comments:
        c.replies = []
    roots: list[CommentOut] = []
    for c in comments:
        parent = by_id.get(c.parent_comment_id) if c.parent_comment_id is not None else None
        if parent is None:
            roots.append(c)
        else:
            parent.replies.append(c)
    return roots
