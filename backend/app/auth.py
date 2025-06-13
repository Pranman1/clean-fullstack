from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from google.oauth2 import id_token
from google.auth.transport import requests
import os
from dotenv import load_dotenv
from app.database import user_profiles_collection, UserProfile
import jwt
from datetime import datetime, timedelta

load_dotenv()

# Configuration
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
JWT_SECRET = os.getenv("JWT_SECRET_KEY", "your-secret-key")  # Change in production
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token", auto_error=False)

async def verify_google_token(token: str):
    try:
        # Verify the Google token
        idinfo = id_token.verify_oauth2_token(
            token, requests.Request(), GOOGLE_CLIENT_ID
        )

        # Get user info from the token
        email = idinfo['email']
        name = idinfo['name']
        picture = idinfo.get('picture')
        google_id = idinfo['sub']

        # Check if user exists in our database
        user = await user_profiles_collection.find_one({"email": email})
        
        if not user:
            # Create new user profile
            user = UserProfile(
                email=email,
                name=name,
                picture=picture,
                google_id=google_id
            )
            await user_profiles_collection.insert_one(user.dict())
        else:
            # Update existing user's info
            await user_profiles_collection.update_one(
                {"email": email},
                {"$set": {
                    "name": name,
                    "picture": picture,
                    "google_id": google_id,
                    "updated_at": datetime.utcnow()
                }}
            )

        # Create access token
        access_token = create_access_token(data={"email": email})
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "email": email,
                "name": name,
                "picture": picture
            }
        }

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Google token"
        )

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return encoded_jwt

async def get_current_user(request: Request, token: str = Depends(oauth2_scheme)):
    try:
        # Try to get token from Authorization header first (via oauth2_scheme)
        if not token:
            # Fallback to cookie
            token = request.cookies.get("access_token")
            
        if not token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Not authenticated"
            )
        
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        email = payload.get("email")
        if email is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication token"
            )
        
        user = await user_profiles_collection.find_one({"email": email})
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found"
            )
            
        return user
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired"
        )
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials"
        ) 