from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from app.models.user import User, UserBase
from app.database import get_db
from app.auth import get_current_user

router = APIRouter(prefix="/users", tags=["users"])

@router.get("/me", response_model=UserBase)
async def get_current_user_profile(current_user: User = Depends(get_current_user)):
    """Get the current user's profile"""
    return current_user

@router.put("/me", response_model=UserBase)
async def update_user_profile(
    profile_update: UserBase,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update the current user's profile"""
    try:
        # Update user fields
        current_user.name = profile_update.name
        current_user.email = profile_update.email
        current_user.truckstop_integration_id = profile_update.truckstop_integration_id

        # Save changes
        db.commit()
        db.refresh(current_user)
        
        return current_user
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e)) 