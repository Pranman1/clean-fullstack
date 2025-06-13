from fastapi import APIRouter, HTTPException, Depends
from app.database import user_profiles_collection, UserProfile
from app.auth import get_current_user
from datetime import datetime

router = APIRouter(prefix="/user", tags=["user"])

@router.get("/profile", response_model=UserProfile)
async def get_user_profile(current_user = Depends(get_current_user)):
    """Get the user's profile"""
    profile = await user_profiles_collection.find_one({"email": current_user["email"]})
    if not profile:
        # Return default profile if none exists
        return UserProfile(
            email=current_user["email"],
            name=current_user["name"],
            picture=current_user.get("picture"),
            google_id=current_user.get("google_id")
        )
    return UserProfile(**profile)

@router.post("/profile", response_model=UserProfile)
async def update_user_profile(profile_update: UserProfile, current_user = Depends(get_current_user)):
    """Update the user's profile"""
    if profile_update.email != current_user["email"]:
        raise HTTPException(status_code=403, detail="Cannot modify profile for another user")
    
    profile_update.updated_at = datetime.utcnow()
    
    # Update or insert profile
    result = await user_profiles_collection.update_one(
        {"email": current_user["email"]},
        {"$set": profile_update.dict()},
        upsert=True
    )
    
    if result.modified_count > 0 or result.upserted_id:
        return profile_update
    
    raise HTTPException(status_code=500, detail="Failed to update profile") 