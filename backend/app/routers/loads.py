from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional, Dict, Any
from datetime import datetime
import traceback
from app.models.load import LoadSearchRequest, LoadResponse, LoadSearchResponse
from app.database import saved_loads_collection, SavedLoad
from app.auth import get_current_user
from app.services.load_search_service import search_loads
from app.services.backhaul_service import get_backhaul_loads
from pydantic import BaseModel
from urllib.parse import unquote

router = APIRouter(prefix="/loads", tags=["loads"])

class TruckstopSearchRequest(BaseModel):
    origin_city: str
    origin_state: str
    destination_city: str = ""
    destination_state: str = ""
    max_weight: int = 45000
    truck_type: str = "V"
    ship_date: str = "2025-06-05"
    origin_range: int = 100
    destination_range: int = 100
    user_integration_id: Optional[str] = None

@router.post("/search", response_model=LoadSearchResponse)
async def search_loads_endpoint(search_params: LoadSearchRequest):
    """Search for loads based on the provided parameters"""
    try:
        return await search_loads(search_params)
    except Exception as e:
        print(f"[API ERROR] Error searching loads: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/saved", response_model=List[SavedLoad])
async def get_saved_loads(current_user = Depends(get_current_user)):
    """Get all saved loads for the current user"""
    cursor = saved_loads_collection.find({"saved_by": current_user["email"]})
    saved_loads = await cursor.to_list(length=100)
    print(f"[API] Retrieving {len(saved_loads)} saved loads for user {current_user['email']}")
    return saved_loads

@router.post("/save", response_model=SavedLoad)
async def save_load(load: dict, current_user = Depends(get_current_user)):
    """Save a new load for the current user"""
    print(f"[API] Saving load: {load.get('origin_city')} to {load.get('destination_city')}")
    print(f"[API] Full load data: {load}")
    
    try:
        # Generate a unique entry_id based on route, date, user email, and pair status
        base_id = f"{current_user['email']}-{load['origin_city']}-{load['origin_state']}-to-{load['destination_city']}-{load['destination_state']}-{load.get('ship_date', '')}-{load.get('data_source', 'direct_freight')}"
        
        # If this is a paired load, include the child load's details in the ID
        if load.get("is_pair") and load.get("child"):
            child = load["child"]
            entry_id = f"{base_id}-pair-{child['origin_city']}-{child['origin_state']}-to-{child['destination_city']}-{child['destination_state']}"
        else:
            entry_id = base_id
            
        print(f"[API] Generated entry_id: {entry_id}")
        
        # Create a SavedLoad object
        try:
            saved_load = SavedLoad(
                entry_id=entry_id,
                origin_city=load["origin_city"],
                origin_state=load["origin_state"],
                destination_city=load["destination_city"],
                destination_state=load["destination_state"],
                distance=float(load.get("distance", 0)),
                pay_rate=float(load.get("pay_rate", 0)),
                rate_per_mile_est=float(load.get("rate_per_mile_est", 0)),
                weight=float(load.get("weight", 0)),
                equipment_type=load.get("equipment_type"),
                other_trailer_types=load.get("other_trailer_types"),
                ship_date=load.get("ship_date"),
                data_source=load.get("data_source", "direct_freight"),
                green_light=bool(load.get("green_light", False)),
                full_load=bool(load.get("full_load", True)),
                dead_head=float(load.get("dead_head", 0)),
                receive_date=load.get("receive_date"),
                saved_by=current_user["email"],
                phone_number=load.get("phone_number"),
                is_pair=load.get("is_pair"),
                child=load.get("child")
            )
            print(f"[API] Created SavedLoad object: {saved_load.dict()}")
        except Exception as e:
            print(f"[API ERROR] Error creating SavedLoad object: {str(e)}")
            print(f"[API ERROR] Error type: {type(e)}")
            raise HTTPException(status_code=400, detail=f"Error creating load object: {str(e)}")
        
        # Check if load already exists for this user
        existing_load = await saved_loads_collection.find_one({
            "entry_id": entry_id
        })
        
        if existing_load:
            print(f"[API] Load already exists with entry_id: {entry_id}")
            raise HTTPException(status_code=400, detail="Load already saved")
        
        # Save to MongoDB
        try:
            result = await saved_loads_collection.insert_one(saved_load.dict())
            print(f"[API] MongoDB insert result: {result}")
        except Exception as e:
            print(f"[API ERROR] Error saving to MongoDB: {str(e)}")
            print(f"[API ERROR] Error type: {type(e)}")
            raise HTTPException(status_code=500, detail=f"Error saving to database: {str(e)}")
        
        if result.inserted_id:
            print(f"[API] Load saved with entry_id {saved_load.entry_id}")
            return saved_load
        else:
            print("[API] Failed to save load - no inserted_id returned")
            raise HTTPException(status_code=500, detail="Failed to save load")
            
    except Exception as e:
        print(f"[API ERROR] Error saving load: {str(e)}")
        print(f"[API ERROR] Error type: {type(e)}")
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/{load_id}")
async def delete_saved_load(load_id: str, current_user = Depends(get_current_user)):
    """Delete a saved load"""
    try:
        # Decode the URL-encoded load ID
        decoded_id = unquote(load_id)
        print(f"[API] Attempting to delete load")
        print(f"[API] Original ID: {load_id}")
        print(f"[API] Decoded ID: {decoded_id}")
        print(f"[API] User: {current_user['email']}")
        
        # List of possible ID formats to try
        id_variants = [
            f"{current_user['email']}-{decoded_id}",
            f"{current_user['email']}-{decoded_id}-truckstop",
            f"{current_user['email']}-{decoded_id.replace(' ', '')}",
            f"{current_user['email']}-{decoded_id.replace(' ', '')}-truckstop",
            decoded_id,  # Fallback for existing entries
            f"{decoded_id}-truckstop"  # Fallback for existing entries
        ]
        
        # Try to find the load with any of the ID variants
        load = None
        used_id = None
        
        print("[API] Trying possible ID formats:")
        for variant in id_variants:
            print(f"[API] Trying ID: {variant}")
            load = await saved_loads_collection.find_one({
                "entry_id": variant,
                "saved_by": current_user["email"]
            })
            if load:
                used_id = variant
                print(f"[API] Found load with ID: {variant}")
                break
        
        if not load:
            # If still not found, let's log all saved loads for this user for debugging
            cursor = saved_loads_collection.find({"saved_by": current_user["email"]})
            saved_loads = await cursor.to_list(length=100)
            print(f"[API] Load not found. User has {len(saved_loads)} saved loads:")
            for saved_load in saved_loads:
                print(f"[API] Saved load ID: {saved_load.get('entry_id')}")
            raise HTTPException(status_code=404, detail=f"Load not found with any ID variant")
        
        # Delete the load using the successful ID variant
        result = await saved_loads_collection.delete_one({
            "entry_id": used_id,
            "saved_by": current_user["email"]
        })
        
        if result.deleted_count:
            print(f"[API] Successfully deleted load with ID: {used_id}")
            return {"message": "Load deleted successfully"}
        
        print(f"[API] Failed to delete load with ID: {used_id}")
        raise HTTPException(status_code=500, detail="Failed to delete load")
        
    except Exception as e:
        print(f"[API ERROR] Error deleting load: {str(e)}")
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Error deleting load: {str(e)}")

@router.delete("/clear/all")
async def clear_saved_loads(current_user = Depends(get_current_user)):
    """Clear all saved loads for the current user"""
    try:
        print(f"[API] Clearing all saved loads for user: {current_user['email']}")
        
        # Get count before deletion for logging
        count = await saved_loads_collection.count_documents({"saved_by": current_user["email"]})
        print(f"[API] Found {count} loads to delete")
        
        # Delete all loads for this user
        result = await saved_loads_collection.delete_many({
            "saved_by": current_user["email"]
        })
        
        print(f"[API] Deleted {result.deleted_count} loads")
        return {
            "message": f"Successfully cleared {result.deleted_count} saved loads",
            "deleted_count": result.deleted_count
        }
        
    except Exception as e:
        print(f"[API ERROR] Error clearing loads: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error clearing loads: {str(e)}")

@router.post("/truckstop-search", response_model=LoadSearchResponse)
async def truckstop_search_endpoint(request: TruckstopSearchRequest):
    """Search for loads using the Truckstop API"""
    try:
        # Convert TruckstopSearchRequest to LoadSearchRequest
        search_params = LoadSearchRequest(
            origin_city=request.origin_city,
            origin_state=request.origin_state,
            destination_city=request.destination_city,
            destination_state=request.destination_state,
            max_weight=request.max_weight,
            truck_type=request.truck_type,
            ship_date=request.ship_date,
            origin_range=request.origin_range,
            destination_range=request.destination_range,
            user_integration_id=request.user_integration_id,
            data_source="truckstop"
        )
        return await search_loads(search_params)
    except Exception as e:
        print(f"[API ERROR] Error searching Truckstop loads: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/backhaul-search", response_model=List[Dict[str, Any]])
async def search_backhaul_loads_endpoint(request: TruckstopSearchRequest):
    """Search for paired loads (outbound + return) optimized for backhaul routes"""
    try:
        # Check if integration ID is provided
        if not request.user_integration_id:
            raise HTTPException(
                status_code=400, 
                detail="Truckstop integration ID is required. Please set it in your profile settings."
            )
            
        # Get backhaul load pairs
        load_pairs = await get_backhaul_loads(
            origin_city=request.origin_city,
            origin_state=request.origin_state,
            destination_city=request.destination_city,
            destination_state=request.destination_state,
            date=request.ship_date,
            max_weight=request.max_weight,
            truck_type=request.truck_type,
            origin_range=request.origin_range,
            destination_range=request.destination_range,
            user_integration_id=request.user_integration_id
        )
        
        print(f"[API] Found {len(load_pairs)} backhaul load pairs")
        return load_pairs
        
    except Exception as e:
        error_msg = f"Error searching backhaul loads: {str(e)}"
        print(f"[API ERROR] {error_msg}")
        raise HTTPException(status_code=500, detail=error_msg) 
        