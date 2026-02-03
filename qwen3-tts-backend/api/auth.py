from datetime import timedelta
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from slowapi import Limiter
from slowapi.util import get_remote_address

from config import settings
from core.security import (
    get_password_hash,
    verify_password,
    create_access_token,
    decode_access_token
)
from db.database import get_db
from db.crud import get_user_by_username, get_user_by_email, create_user, change_user_password, update_user_aliyun_key
from schemas.user import User, UserCreate, Token, PasswordChange, AliyunKeyUpdate, AliyunKeyVerifyResponse

router = APIRouter(prefix="/auth", tags=["authentication"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")

limiter = Limiter(key_func=get_remote_address)

async def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: Session = Depends(get_db)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    username = decode_access_token(token)
    if username is None:
        raise credentials_exception

    user = get_user_by_username(db, username=username)
    if user is None:
        raise credentials_exception

    return user

@router.post("/register", response_model=User, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
async def register(request: Request, user_data: UserCreate, db: Session = Depends(get_db)):
    existing_user = get_user_by_username(db, username=user_data.username)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )

    existing_email = get_user_by_email(db, email=user_data.email)
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    hashed_password = get_password_hash(user_data.password)
    user = create_user(
        db,
        username=user_data.username,
        email=user_data.email,
        hashed_password=hashed_password
    )

    return user

@router.post("/token", response_model=Token)
@limiter.limit("5/minute")
async def login(
    request: Request,
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: Session = Depends(get_db)
):
    user = get_user_by_username(db, username=form_data.username)
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )

    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=User)
@limiter.limit("30/minute")
async def get_current_user_info(
    request: Request,
    current_user: Annotated[User, Depends(get_current_user)]
):
    return current_user

@router.post("/change-password", response_model=User)
@limiter.limit("5/minute")
async def change_password(
    request: Request,
    password_data: PasswordChange,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db)
):
    if not verify_password(password_data.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )

    new_hashed_password = get_password_hash(password_data.new_password)

    user = change_user_password(
        db,
        user_id=current_user.id,
        new_hashed_password=new_hashed_password
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    return user

@router.post("/aliyun-key", response_model=User)
@limiter.limit("5/minute")
async def set_aliyun_key(
    request: Request,
    key_data: AliyunKeyUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db)
):
    from core.security import encrypt_api_key
    from core.tts_service import AliyunTTSBackend

    api_key = key_data.api_key.strip()

    aliyun_backend = AliyunTTSBackend(api_key=api_key, region=settings.ALIYUN_REGION)
    health = await aliyun_backend.health_check()

    if not health.get("available", False):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Aliyun API key. Please check your API key and try again."
        )

    encrypted_key = encrypt_api_key(api_key)

    user = update_user_aliyun_key(
        db,
        user_id=current_user.id,
        encrypted_api_key=encrypted_key
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    return user

@router.get("/aliyun-key/verify", response_model=AliyunKeyVerifyResponse)
@limiter.limit("10/minute")
async def verify_aliyun_key(
    request: Request,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db)
):
    from core.security import decrypt_api_key
    from core.tts_service import AliyunTTSBackend

    if not current_user.aliyun_api_key:
        return AliyunKeyVerifyResponse(
            valid=False,
            message="No Aliyun API key configured"
        )

    api_key = decrypt_api_key(current_user.aliyun_api_key)

    if not api_key:
        return AliyunKeyVerifyResponse(
            valid=False,
            message="Failed to decrypt API key"
        )

    aliyun_backend = AliyunTTSBackend(api_key=api_key, region=settings.ALIYUN_REGION)
    health = await aliyun_backend.health_check()

    if health.get("available", False):
        return AliyunKeyVerifyResponse(
            valid=True,
            message="Aliyun API key is valid and working"
        )
    else:
        return AliyunKeyVerifyResponse(
            valid=False,
            message="Aliyun API key is not working. Please check your API key."
        )
