from fastapi import APIRouter, HTTPException, Depends
from typing import List
from datetime import datetime
from app.database import saved_loads_collection, SavedLoad
from app.auth import get_current_user

router = APIRouter(prefix="/saved-loads", tags=["saved-loads"])

@router.get("/", response_model=List[SavedLoad])
async def get_saved_loads(current_user = Depends(get_current_user)):
    """Get all saved loads for the current user"""
    cursor = saved_loads_collection.find({"saved_by": current_user["email"]})
    saved_loads = await cursor.to_list(length=100)
    print(f"[API] Retrieving {len(saved_loads)} saved loads for user {current_user['email']}")
    return saved_loads

@router.post("/", response_model=SavedLoad)
async def save_load(load: SavedLoad, current_user = Depends(get_current_user)):
    """Save a new load"""
    print(f"[API] Saving load: {load.origin_city} to {load.destination_city}")
    
    # Set the save date and user
    load.save_date = datetime.utcnow()
    load.saved_by = current_user["email"]
    
    # Check if load already exists for this user
    existing_load = await saved_loads_collection.find_one({
        "entry_id": load.entry_id,
        "saved_by": current_user["email"]
    })
    
    if existing_load:
        raise HTTPException(status_code=400, detail="Load already saved")
    
    # Insert into MongoDB
    result = await saved_loads_collection.insert_one(load.dict())
    
    if result.inserted_id:
        print(f"[API] Load saved with entry_id {load.entry_id}")
        return load
    else:
        raise HTTPException(status_code=500, detail="Failed to save load")

@router.delete("/{entry_id}")
async def delete_saved_load(entry_id: str, current_user = Depends(get_current_user)):
    """Delete a saved load"""
    result = await saved_loads_collection.delete_one({
        "entry_id": entry_id,
        "saved_by": current_user["email"]
    })
    
    if result.deleted_count:
        return {"message": f"Load {entry_id} deleted successfully"}
    raise HTTPException(status_code=404, detail="Saved load not found")

@router.get("/search", response_model=List[SavedLoad])
async def search_saved_loads(
    origin_city: str = None,
    destination_city: str = None,
    min_rate: float = None,
    max_rate: float = None,
    current_user = Depends(get_current_user)
):
    """Search saved loads with filters"""
    query = {"saved_by": current_user["email"]}
    
    if origin_city:
        query["origin_city"] = {"$regex": origin_city, "$options": "i"}
    if destination_city:
        query["destination_city"] = {"$regex": destination_city, "$options": "i"}
    if min_rate is not None:
        query["pay_rate"] = {"$gte": min_rate}
    if max_rate is not None:
        query["pay_rate"] = query.get("pay_rate", {}) | {"$lte": max_rate}
    
    cursor = saved_loads_collection.find(query).sort("save_date", -1)
    loads = await cursor.to_list(length=100)
    return loads 