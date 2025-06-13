from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import date

class LoadSearchRequest(BaseModel):
    origin_city: str
    origin_state: str
    destination_city: Optional[str] = ""
    destination_state: Optional[str] = ""
    max_weight: int = 45000
    truck_type: str = "V"
    ship_date: str
    origin_range: Optional[int] = 300  # Default range for Truckstop origin
    destination_range: Optional[int] = 100  # Default range for Truckstop destination
    data_source: Optional[str] = "truckstop"  # Default to truckstop, can be "direct_freight"
    user_integration_id: Optional[str] = None  # Add Truckstop integration ID field
    backhaul_search: bool = False

class LoadResponse(BaseModel):
    id: Optional[str] = None
    origin_city: Optional[str] = None
    origin_state: Optional[str] = None
    destination_city: Optional[str] = None
    destination_state: Optional[str] = None
    length: Optional[float] = None
    weight: Optional[float] = None
    rate_per_mile_est: Optional[float] = None
    dead_head: Optional[float] = None
    age: Optional[int] = None
    ship_date: Optional[str] = None
    delivery_date: Optional[str] = None
    pickup_time: Optional[str] = None
    delivery_time: Optional[str] = None
    distance: Optional[float] = None
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    description: Optional[str] = None
    score: Optional[float] = None
    equipment_type: Optional[str] = None
    equipment_description: Optional[str] = None
    data_source: Optional[str] = None
    company_name: Optional[str] = None
    company_mc: Optional[str] = None
    company_dot: Optional[str] = None
    fuel_cost: Optional[float] = None
    special_instructions: Optional[str] = None
    load_type: Optional[str] = None
    stops: Optional[int] = None
    credit_rating: Optional[str] = None
    notes: Optional[str] = None
    origin_distance: Optional[int] = None
    destination_distance: Optional[int] = None
    payment: Optional[int] = None
class LoadSearchResponse(BaseModel):
    loads: List[LoadResponse]
    
class SavedLoadBase(BaseModel):
    load_id: str
    origin_city: str
    origin_state: str
    destination_city: str
    destination_state: str
    length: Optional[float] = None
    weight: Optional[float] = None
    rate_per_mile_est: Optional[float] = None
    ship_date: str
    description: Optional[str] = None
    
class SavedLoadCreate(SavedLoadBase):
    pass
    
class SavedLoad(SavedLoadBase):
    id: int
    created_at: str
    
    class Config:
        from_attributes = True 