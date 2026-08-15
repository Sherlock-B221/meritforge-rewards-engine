import uuid
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from app.constants.enums import UserRole


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    username: str
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    username: str
    email: str
    role: UserRole


class AuthResponse(BaseModel):
    token: str
    user: UserOut
