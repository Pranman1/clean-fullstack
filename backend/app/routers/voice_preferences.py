from fastapi import APIRouter, HTTPException, Depends
from app.database import voice_preferences_collection, VoicePreferences
from app.auth import get_current_user
from datetime import datetime

router = APIRouter(prefix="/voice-preferences", tags=["voice-preferences"])

@router.get("/", response_model=VoicePreferences)
async def get_voice_preferences(current_user = Depends(get_current_user)):
    """Get voice preferences for the current user"""
    preferences = await voice_preferences_collection.find_one({"user_id": current_user["email"]})
    if not preferences:
        # Return default preferences if none exist
        return VoicePreferences(
            user_id=current_user["email"],
            is_active=False,
            phone_number="",
            truck_type="V",
            origin_city="",
            origin_state=""
        )
    return VoicePreferences(**preferences)

@router.post("/", response_model=VoicePreferences)
async def save_voice_preferences(preferences: VoicePreferences, current_user = Depends(get_current_user)):
    """Save voice preferences for the current user"""
    if preferences.user_id != current_user["email"]:
        raise HTTPException(status_code=403, detail="Cannot modify preferences for another user")
    
    preferences.updated_at = datetime.utcnow()
    
    # Update or insert preferences
    result = await voice_preferences_collection.update_one(
        {"user_id": current_user["email"]},
        {"$set": preferences.dict()},
        upsert=True
    )
    
    if result.modified_count > 0 or result.upserted_id:
        return preferences
    
    raise HTTPException(status_code=500, detail="Failed to save preferences")

@router.get("/active-users", response_model=list[VoicePreferences])
async def get_active_users(current_user = Depends(get_current_user)):
    """Get all users with active voice preferences (admin only)"""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    cursor = voice_preferences_collection.find({"is_active": True})
    active_users = await cursor.to_list(length=100)
    return [VoicePreferences(**user) for user in active_users] 