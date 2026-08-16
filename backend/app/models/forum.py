import uuid

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin
from app.models.user import User


class Post(Base, TimestampMixin):
    __tablename__ = "posts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    author_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), index=True, nullable=False
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    tags: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False, default=list, server_default="{}")
    comment_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    upvote_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    view_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    solution_comment_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("comments.id", use_alter=True, name="fk_posts_solution_comment_id", ondelete="SET NULL"),
        nullable=True,
    )

    author: Mapped[User] = relationship("User")


class Comment(Base, TimestampMixin):
    __tablename__ = "comments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    post_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("posts.id", ondelete="CASCADE"), index=True, nullable=False
    )
    author_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    parent_comment_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("comments.id", ondelete="CASCADE"), index=True, nullable=True
    )
    body: Mapped[str] = mapped_column(Text, nullable=False)
    is_solution: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")

    author: Mapped[User] = relationship("User")


class PostUpvote(Base, TimestampMixin):
    __tablename__ = "post_upvotes"

    post_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("posts.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
