import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class AuthorOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    username: str


class PostCreate(BaseModel):
    title: str = Field(min_length=5, max_length=200)
    body: str = Field(min_length=1, max_length=20000)
    tags: list[str] = Field(default_factory=list, max_length=10)


class CommentCreate(BaseModel):
    body: str = Field(min_length=1, max_length=10000)
    parent_comment_id: uuid.UUID | None = None


class PostSummaryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    title: str
    body: str
    tags: list[str]
    author: AuthorOut
    comment_count: int
    upvote_count: int
    view_count: int
    solution_comment_id: uuid.UUID | None
    created_at: datetime


class CommentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    post_id: uuid.UUID
    parent_comment_id: uuid.UUID | None
    author: AuthorOut
    body: str
    is_solution: bool
    created_at: datetime
    replies: list["CommentOut"] = Field(default_factory=list)


class PostDetailOut(PostSummaryOut):
    comments: list[CommentOut] = Field(default_factory=list)


class UpvoteResponse(BaseModel):
    post_id: uuid.UUID
    upvote_count: int
    upvoted: bool


CommentOut.model_rebuild()
