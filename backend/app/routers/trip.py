from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, validator
from typing import List, Optional
from datetime import datetime
from ..services.bruteforce_service import brute_force_with_home_gravity
from ..auth import get_current_user
import traceback

router = APIRouter(prefix="/trip", tags=["trip"])

class TripPlanRequest(BaseModel):
    start_city: str
    start_state: str
    start_date: str
    max_weight: int
    truck_types: List[str]
    max_loads: int
    user_integration_id: str

    @validator('start_date')
    def validate_date(cls, v):
        try:
            datetime.strptime(v, "%Y-%m-%d")
            return v
        except ValueError:
            raise ValueError("start_date must be in YYYY-MM-DD format")

    @validator('max_weight')
    def validate_weight(cls, v):
        if v < 1000 or v > 80000:
            raise ValueError("max_weight must be between 1,000 and 80,000 lbs")
        return v

    @validator('max_loads')
    def validate_max_loads(cls, v):
        if v < 1 or v > 10:
            raise ValueError("max_loads must be between 1 and 10")
        return v

    @validator('truck_types')
    def validate_truck_types(cls, v):
        if not v:
            raise ValueError("At least one truck type must be specified")
        valid_types = {"V", "SV", "F", "R", "SD", "DD", "LB", "RGN", "TNK", "AC", "CONT", "DT", "HB", "PO"}
        invalid = [t for t in v if t not in valid_types]
        if invalid:
            raise ValueError(f"Invalid truck types: {', '.join(invalid)}")
        return v

class TripPlanResponse(BaseModel):
    route: List[dict]
    total_revenue: float
    total_miles: float
    total_deadhead: float
    rate_per_mile: float
    total_days: int
    total_loads: int

@router.post("/plan", response_model=TripPlanResponse)
async def plan_trip(request: TripPlanRequest, current_user = Depends(get_current_user)):
    """Plan a multi-load trip with optimized loads"""
    try:
        print(f"[TRIP_PLANNER] Planning trip from {request.start_city}, {request.start_state}")
        print(f"[TRIP_PLANNER] Parameters: max_loads={request.max_loads}, start_date={request.start_date}")
        
        # Get the route
        route = await brute_force_with_home_gravity(
            start_city=request.start_city,
            start_state=request.start_state,
            start_date_str=request.start_date,
            max_weight=request.max_weight,
            truck_types=request.truck_types,
            max_loads=request.max_loads,
            user_integration_id=request.user_integration_id
        )
        
        if not route:
            raise HTTPException(status_code=404, detail="No valid route found with the given parameters")
        
        # Calculate totals
        total_revenue = 0
        total_miles = 0
        total_deadhead = 0
        total_loads = 0
        
        # Process each segment
        for segment in route:
            miles = float(segment.get("distance", 0) or 0)
            total_miles += miles
            
            if segment.get("is_deadhead"):
                total_deadhead += miles
            else:
                total_loads += 1
                # Use pre-calculated revenue if available
                revenue = float(segment.get("revenue", 0) or 0)
                if revenue == 0:
                    # Fallback calculation
                    pay_rate = float(segment.get("pay_rate", 0) or 0)
                    rate_per_mile = float(segment.get("rate_per_mile_est", 0) or 0)
                    revenue = pay_rate if pay_rate > 0 else (rate_per_mile * miles)
                total_revenue += revenue
        
        # Calculate rate per mile (excluding deadhead)
        revenue_miles = total_miles - total_deadhead
        rate_per_mile = total_revenue / revenue_miles if revenue_miles > 0 else 0
        
        # Calculate total days
        try:
            first_date = datetime.strptime(route[0]["ship_date"], "%Y-%m-%d")
            last_date = datetime.strptime(route[-1]["receive_date"], "%Y-%m-%d")
            total_days = (last_date - first_date).days + 1
        except (KeyError, ValueError, IndexError) as e:
            print(f"[TRIP_PLANNER] Error calculating days: {str(e)}")
            total_days = 0
        
        print(f"[TRIP_PLANNER] Route summary:")
        print(f"  Total Revenue: ${total_revenue:.2f}")
        print(f"  Total Miles: {total_miles:.1f}")
        print(f"  Revenue Miles: {revenue_miles:.1f}")
        print(f"  Deadhead Miles: {total_deadhead:.1f}")
        print(f"  Rate per Mile: ${rate_per_mile:.2f}")
        print(f"  Total Days: {total_days}")
        print(f"  Total Loads: {total_loads}")
        
        return {
            "route": route,
            "total_revenue": total_revenue,
            "total_miles": total_miles,
            "total_deadhead": total_deadhead,
            "rate_per_mile": rate_per_mile,
            "total_days": total_days,
            "total_loads": total_loads
        }
        
    except HTTPException as he:
        # Re-raise HTTP exceptions as is
        raise he
    except ValueError as ve:
        # Handle validation errors
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        # Log unexpected errors and return a 500
        print(f"[TRIP_PLANNER] Error planning trip: {str(e)}")
        print(f"[TRIP_PLANNER] Traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred while planning the trip. Please try again."
        ) 