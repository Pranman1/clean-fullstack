from fastapi import APIRouter, HTTPException, Depends
from typing import List
from datetime import datetime
from app.database import booked_loads_collection, BookedLoad
from app.auth import get_current_user

router = APIRouter(prefix="/booked-loads", tags=["booked-loads"])

@router.get("/", response_model=List[BookedLoad])
async def get_booked_loads(current_user = Depends(get_current_user)):
    """Get all booked loads for the current user"""
    cursor = booked_loads_collection.find({"booked_by": current_user["email"]})
    booked_loads = await cursor.to_list(length=100)
    print(f"[API] Retrieving {len(booked_loads)} booked loads for user {current_user['email']}")
    return booked_loads

@router.post("/", response_model=BookedLoad)
async def create_booked_load(load: BookedLoad, current_user = Depends(get_current_user)):
    """Create a new booked load"""
    print(f"[API] Creating booked load: {load.origin_city} to {load.destination_city}")
    
    # Set the booking date and user
    load.booking_date = datetime.utcnow()
    load.booked_by = current_user["email"]
    
    # Generate a new ID
    last_load = await booked_loads_collection.find_one(
        sort=[("id", -1)]
    )
    load.id = (last_load["id"] + 1) if last_load else 1
    
    # Insert into MongoDB
    result = await booked_loads_collection.insert_one(load.dict())
    
    if result.inserted_id:
        print(f"[API] Load booked with ID {load.id}")
        return load
    else:
        raise HTTPException(status_code=500, detail="Failed to book load")

@router.get("/{load_id}", response_model=BookedLoad)
async def get_booked_load(load_id: int, current_user = Depends(get_current_user)):
    """Get a specific booked load by its ID"""
    load = await booked_loads_collection.find_one({
        "id": load_id,
        "booked_by": current_user["email"]
    })
    if load:
        return load
    raise HTTPException(status_code=404, detail="Booked load not found")

@router.put("/{load_id}/status", response_model=BookedLoad)
async def update_load_status(
    load_id: int, 
    status: str,
    current_user = Depends(get_current_user)
):
    """Update the status of a booked load"""
    if status not in ["booked", "in_transit", "completed", "cancelled"]:
        raise HTTPException(status_code=400, detail="Invalid status")
        
    result = await booked_loads_collection.update_one(
        {"id": load_id, "booked_by": current_user["email"]},
        {"$set": {"status": status}}
    )
    
    if result.modified_count:
        load = await booked_loads_collection.find_one({"id": load_id})
        return load
    raise HTTPException(status_code=404, detail="Booked load not found") 