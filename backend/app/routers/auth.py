from fastapi import APIRouter, Request, Response, HTTPException, Depends
from fastapi.responses import RedirectResponse
from google.oauth2 import id_token
from google.auth.transport import requests
from google_auth_oauthlib.flow import Flow
import os
from jose import JWTError, jwt
from datetime import datetime, timedelta
from typing import Optional
import json
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from dotenv import load_dotenv
from pydantic import BaseModel
from app.auth import verify_google_token, get_current_user
from app.database import user_profiles_collection, UserProfile

load_dotenv()

router = APIRouter(prefix="/auth", tags=["auth"])

# Load OAuth config
GOOGLE_CLIENT_ID = "255019846790-6s62ntot8fi4bt5ln7hi030p6k5noa75.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET = "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"
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
REDIRECT_URI = f"{FRONTEND_URL}/auth/callback"
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key")  # Change in production
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours

# Initialize OAuth flow
flow = Flow.from_client_config(
    {
        "web": {
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [REDIRECT_URI]
        }
    },
    scopes=["openid", "email", "profile"]
)

# OAuth 2.0 scopes
SCOPES = [
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
    'openid'
]

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
    return encoded_jwt

class GoogleToken(BaseModel):
    token: str

class UserUpdate(BaseModel):
    company_name: str = None
    phone_number: str = None
    mc_number: str = None
    dot_number: str = None

@router.get("/google/login")
async def google_login():
    """Initiates the Google OAuth2 login flow"""
    flow = Flow.from_client_config(
        {
            "web": {
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [REDIRECT_URI]
            }
        },
        scopes=SCOPES
    )
    
    flow.redirect_uri = REDIRECT_URI
    authorization_url, state = flow.authorization_url(
        access_type='offline',
        include_granted_scopes='true',
        prompt='consent'
    )
    
    return {"authorization_url": authorization_url}

@router.get("/google/callback")
async def google_callback(code: str, state: str = None):
    """Handles the Google OAuth2 callback"""
    try:
        print(f"[AUTH] Received callback with code: {code[:10]}...")
        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": GOOGLE_CLIENT_ID,
                    "client_secret": GOOGLE_CLIENT_SECRET,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "redirect_uris": [REDIRECT_URI]
                }
            },
            scopes=SCOPES
        )
        
        flow.redirect_uri = REDIRECT_URI
        
        try:
            print("[AUTH] Fetching token from Google...")
            flow.fetch_token(code=code)
        except Exception as e:
            print(f"[AUTH] Error fetching token: {str(e)}")
            raise HTTPException(status_code=400, detail=f"Failed to fetch token: {str(e)}")
        
        try:
            print("[AUTH] Building OAuth2 service...")
            credentials = flow.credentials
            service = build('oauth2', 'v2', credentials=credentials)
            print("[AUTH] Getting user info...")
            user_info = service.userinfo().get().execute()
            print(f"[AUTH] Got user info for: {user_info.get('email')}")
        except Exception as e:
            print(f"[AUTH] Error getting user info: {str(e)}")
            raise HTTPException(status_code=400, detail=f"Failed to get user info: {str(e)}")
        
        # Create JWT token
        try:
            print("[AUTH] Creating access token...")
            access_token = create_access_token(
                data={
                    "email": user_info.get("email"),
                    "name": user_info.get("name"),
                    "picture": user_info.get("picture")
                },
                expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
            )
            print("[AUTH] Access token created successfully")
        except Exception as e:
            print(f"[AUTH] Error creating access token: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Failed to create access token: {str(e)}")
        
        # Create and update user profile
        try:
            print("[AUTH] Updating user profile...")
            user = await user_profiles_collection.find_one({"email": user_info.get("email")})
            if not user:
                print("[AUTH] Creating new user profile...")
                user = UserProfile(
                    email=user_info.get("email"),
                    name=user_info.get("name"),
                    picture=user_info.get("picture"),
                    google_id=user_info.get("id")
                )
                await user_profiles_collection.insert_one(user.dict())
            else:
                print("[AUTH] Updating existing user profile...")
                await user_profiles_collection.update_one(
                    {"email": user_info.get("email")},
                    {"$set": {
                        "name": user_info.get("name"),
                        "picture": user_info.get("picture"),
                        "google_id": user_info.get("id"),
                        "updated_at": datetime.utcnow()
                    }}
                )
            print("[AUTH] User profile updated successfully")
        except Exception as e:
            print(f"[AUTH] Error updating user profile: {str(e)}")
            # Don't fail the request if profile update fails
            
        print("[AUTH] Returning successful response")
        return {
            "email": user_info.get("email"),
            "name": user_info.get("name"),
            "picture": user_info.get("picture"),
            "access_token": access_token,
        }
        
    except HTTPException as e:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        print(f"[AUTH] Unexpected error in callback: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")

@router.get("/me")
async def get_current_user(request: Request):
    try:
        # Try to get token from Authorization header first
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
        else:
            # Fallback to cookie
            token = request.cookies.get("access_token")
            
        if not token:
            raise HTTPException(status_code=401, detail="Not authenticated")
            
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

@router.post("/logout")
async def logout():
    response = Response(content="Logged out successfully")
    response.delete_cookie(key="access_token")
    return response

@router.post("/google-login")
async def google_login(token_data: GoogleToken):
    """Handle Google login and return JWT token"""
    return await verify_google_token(token_data.token)

@router.get("/me", response_model=UserProfile)
async def get_user_profile(current_user = Depends(get_current_user)):
    """Get current user's profile"""
    return current_user

@router.put("/me", response_model=UserProfile)
async def update_user_profile(
    update_data: UserUpdate,
    current_user = Depends(get_current_user)
):
    """Update current user's profile"""
    # Update only provided fields
    update_dict = {k: v for k, v in update_data.dict().items() if v is not None}
    if not update_dict:
        return current_user

    update_dict["updated_at"] = datetime.utcnow()
    
    result = await user_profiles_collection.update_one(
        {"email": current_user["email"]},
        {"$set": update_dict}
    )
    
    if result.modified_count:
        updated_user = await user_profiles_collection.find_one(
            {"email": current_user["email"]}
        )
        return updated_user
    
    raise HTTPException(status_code=400, detail="Failed to update profile") 