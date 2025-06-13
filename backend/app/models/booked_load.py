from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class BookedLoad(BaseModel):
    id: str  # CINESIS ID (e.g., CIN-0123-4567)
    booking_date: datetime
    origin_city: str
    origin_state: str
    destination_city: str
    destination_state: str
    distance: Optional[float]
    equipment_type: Optional[str]
    weight: Optional[float]
    length: Optional[float]
    rate_per_mile_est: Optional[float]
    pay_rate: Optional[float]
    ship_date: Optional[str]
    receive_date: Optional[str]
    full_load: Optional[bool]
    green_light: Optional[bool]
    other_trailer_types: Optional[str]
    dead_head: Optional[float]
    entry_id: str  # Original Direct Freight ID
    data_source: str = "direct_freight"  # Source of the load
    score: Optional[float] 