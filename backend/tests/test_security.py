import uuid, pytest
from app.services.auth.security import hash_password, verify_password, create_access_token, decode_token
from app.constants.enums import UserRole
from app.core.exceptions import UnauthorizedError

def test_password_roundtrip():
    h = hash_password("s3cret")
    assert h != "s3cret"
    assert verify_password("s3cret", h) is True
    assert verify_password("wrong", h) is False

def test_token_roundtrip():
    uid = uuid.uuid4()
    principal = decode_token(create_access_token(uid, UserRole.ADMIN))
    assert principal.user_id == uid
    assert principal.role == UserRole.ADMIN

def test_bad_token_raises():
    with pytest.raises(UnauthorizedError):
        decode_token("not.a.jwt")
