from datetime import datetime, timedelta
from copy import deepcopy
from app.models.load import LoadSearchRequest, LoadResponse
from app.services.load_search_service import search_loads
from .google_maps_service import google_maps_service
import math
import traceback
from typing import List, Dict, Any
from fastapi import HTTPException
from functools import lru_cache

@lru_cache(maxsize=500)
def parse_date(date_str: str) -> datetime:
    """Parse a date string into a datetime object"""
    try:
        return datetime.strptime(date_str, "%Y-%m-%d")
    except (ValueError, TypeError):
        return datetime.now()

def safe_float(val):
    return float(val or 0)

async def get_loads(
    origin_city: str,
    origin_state: str,
    date: str,
    max_weight: int,
    truck_types: List[str],
    user_integration_id: str,
    backhaul_search: bool = False,
    destination_city: str = "",
    destination_state: str = "",
) -> List[Dict[str, Any]]:
    """
    Get loads from Truckstop API for a specific date and location.
    Returns loads sorted by score.
    """
    try:
        print(f"[BRUTEFORCE] Searching for loads from {origin_city}, {origin_state} on {date}")
        
        all_loads = []
        base_date = datetime.strptime(date, "%Y-%m-%d")
        
        # Search for each truck type
        for truck_type in truck_types:
            search_params = LoadSearchRequest(
                origin_city=origin_city,
                origin_state=origin_state,
                destination_city=destination_city,
                destination_state=destination_state,
                ship_date=date,
                max_weight=max_weight,
                truck_type=truck_type,
                user_integration_id=user_integration_id,
                data_source="truckstop",
                backhaul_search=backhaul_search
            )
            
            response = await search_loads(search_params)
            
            # Filter loads within +3 days of requested date
            filtered_loads = []
            for load in response.loads:
                load_date = datetime.strptime(load.ship_date, "%Y-%m-%d")
                days_diff = (load_date - base_date).days
                if 0 <= days_diff <= 3:  # Allow current date up to 3 days later
                    filtered_loads.append(load)
            
            all_loads.extend(filtered_loads)
        
        # Sort all loads by score
        all_loads.sort(key=lambda x: x.score, reverse=True)
        
        # Convert LoadResponse objects to dictionaries
        load_dicts = [load.dict() for load in all_loads]
        
        print(f"[BRUTEFORCE] Found {len(load_dicts)} loads")
        return load_dicts
        
    except Exception as e:
        print(f"[BRUTEFORCE ERROR] Error getting loads: {str(e)}")
        return []

def calculate_travel_days(miles):
    """Calculate travel days based on distance assuming average speed of 500 miles per day"""
    if miles <= 0:
        return 1
    return max(1, math.ceil(miles / 500))  # At least 1 day, then 1 day per 500 miles

async def calculate_deadhead(from_city, from_state, to_city, to_state):
    """Calculate deadhead miles between cities using Google Maps Routes API"""
    try:
        distance, duration = await google_maps_service.get_driving_distance(
            from_city, from_state, to_city, to_state
        )
        if distance is not None:
            return distance
        print(f"[ROUTE_PLANNER] Warning: Could not calculate distance from {from_city}, {from_state} to {to_city}, {to_state}")
        return None
    except Exception as e:
        print(f"[ROUTE_PLANNER] Error calculating distance: {e}")
        return None

async def calculate_distance_from_origin(city, state, origin_city, origin_state):
    """Calculate distance from a point back to origin"""
    try:
        distance, _ = await google_maps_service.get_driving_distance(
            city, state, origin_city, origin_state
        )
        return safe_float(distance)
    except Exception as e:
        print(f"[ROUTE_PLANNER] Error calculating distance to origin: {e}")
        return 0

def calculate_time_penalty(days):
    """Calculate time penalty multiplier based on days on road"""
    if days <= 3:
        return 1.0
    elif days <= 5:
        return 1.2
    elif days <= 7:
        return 1.5
    else:
        return 2.0

async def score_load(load, start_city, start_state, current_date=None, trip_start_date=None):
    """Score a load based on revenue, deadhead miles, distance from origin, and time on road"""
    revenue = safe_float(load.get("rate_per_mile_est", 0)) * safe_float(load.get("distance", 0))
    
    # Calculate distance from load destination back to origin
    distance_to_origin = await calculate_distance_from_origin(
        load.get("destination_city"), 
        load.get("destination_state"),
        start_city, 
        start_state
    )
    
    # Calculate days on road if dates are provided
    days_penalty = 1
    if current_date and trip_start_date:
        days_on_road = (current_date - trip_start_date).days
        days_penalty = calculate_time_penalty(days_on_road)
    
    # Base score is revenue
    base_score = revenue
    
    # Distance from origin penalty increases with days on road
    distance_penalty = (distance_to_origin / 100) * days_penalty
    
    final_score = base_score - distance_penalty
    
    print(f"[ROUTE_PLANNER] Load score breakdown:")
    print(f"  Revenue: ${revenue:,.2f}")
    print(f"  Distance to origin: {distance_to_origin:.1f} miles")
    print(f"  Days penalty multiplier: {days_penalty:.2f}x")
    print(f"  Distance penalty: -${distance_penalty:.2f}")
    print(f"  Final score: ${final_score:.2f}")
    
    return final_score

async def get_best_load(loads, start_city, start_state, filter_dest=None, current_date=None, trip_start_date=None):
    """Get best load from a list of loads, optionally filtering by destination"""
    if filter_dest:
        loads = [l for l in loads if l.get("destination_city") == filter_dest[0] 
                and l.get("destination_state") == filter_dest[1]]
    
    if not loads:
        return None
        
    # Score all loads
    scored_loads = []
    for load in loads:
        score = await score_load(load, start_city, start_state, current_date, trip_start_date)
        scored_loads.append((load, score))
    
    # Sort by score and take top 3
    scored_loads.sort(key=lambda x: x[1], reverse=True)
    top_loads = scored_loads[:3]
    
    # Return the load with best score
    return max(top_loads, key=lambda x: x[1])[0] if top_loads else None

def is_nearby_city(city1, state1, city2, state2):
    """Check if two cities are in the same state or neighboring states"""
    if state1 == state2:
        return True
    # Add common neighboring states - this is a simplified version
    neighboring_states = {
        'CA': ['NV', 'OR', 'AZ'],
        'NV': ['CA', 'OR', 'ID', 'AZ'],
        'AZ': ['CA', 'NV', 'NM'],
        'OR': ['CA', 'NV', 'WA', 'ID'],
        'WA': ['OR', 'ID'],
        'ID': ['OR', 'WA', 'NV', 'MT', 'WY', 'UT'],
        'TX': ['NM', 'OK', 'AR', 'LA'],
        # Add more as needed
    }
    return state2 in neighboring_states.get(state1, [])

def score_route(outbound, return_load, origin_city, origin_state):
    """Score a complete route considering distance from final destination to origin"""
    total_revenue = safe_float(outbound.get("pay_rate", 0)) + safe_float(return_load.get("pay_rate", 0))
    total_deadhead = safe_float(outbound.get("deadhead_miles", 0)) + safe_float(return_load.get("deadhead_miles", 0))
    
    # Add penalty if return load doesn't end at origin
    if return_load.get("destination_city") != origin_city or return_load.get("destination_state") != origin_state:
        # Smaller penalty for nearby city
        if is_nearby_city(return_load.get("destination_city"), return_load.get("destination_state"), 
                         origin_city, origin_state):
            total_deadhead += 100  # Small penalty for nearby city
        else:
            total_deadhead += 300  # Larger penalty for distant city
    
    return total_revenue - (total_deadhead * 2)

async def create_deadhead_segment(from_city, from_state, to_city, to_state, date_str):
    """Create a deadhead segment between two points"""
    # Calculate deadhead distance
    distance = await calculate_route_distance(from_city, from_state, to_city, to_state)
    
    if not distance:
        print(f"[ROUTE_PLANNER] Warning: Could not calculate deadhead distance from {from_city}, {from_state} to {to_city}, {to_state}")
        distance = 0
    
    # Calculate travel days for this distance
    travel_days = calculate_travel_days(distance)
    current_date = parse_date(date_str)
    receive_date = current_date + timedelta(days=travel_days)
    
    return {
        "origin_city": from_city,
        "origin_state": from_state,
        "destination_city": to_city,
        "destination_state": to_state,
        "distance": distance,
        "is_deadhead": True,
        "ship_date": date_str,
        "receive_date": receive_date.strftime("%Y-%m-%d"),
        "rate_per_mile_est": 0,
        "revenue": 0,
        "equipment_type": "DEADHEAD"
    }

async def connect_route_segments(route, start_city, start_state, start_date):
    """Connect route segments with deadhead moves where needed"""
    if not route:
        return []
    
    complete_route = []
    current_date = parse_date(start_date)
    
    # Add deadhead from start location to first load if needed
    first_load = route[0]
    if (first_load.get("origin_city") != start_city or
        first_load.get("origin_state") != start_state):
        print(f"[ROUTE_PLANNER] Adding initial deadhead: {start_city}, {start_state} -> {first_load.get('origin_city')}, {first_load.get('origin_state')}")
        initial_deadhead = await create_deadhead_segment(
            start_city, start_state,
            first_load.get("origin_city"), first_load.get("origin_state"),
            current_date.strftime("%Y-%m-%d")
        )
        complete_route.append(initial_deadhead)
        current_date = parse_date(initial_deadhead.get("receive_date"))
    
    # Add first load
    if not first_load.get("receive_date"):
        # Calculate receive date based on distance
        travel_days = calculate_travel_days(safe_float(first_load.get("distance", 0)))
        ship_date = parse_date(first_load.get("ship_date"))
        first_load["receive_date"] = (ship_date + timedelta(days=travel_days)).strftime("%Y-%m-%d")
    
    complete_route.append(first_load)
    current_date = parse_date(first_load.get("receive_date"))
    
    # Connect subsequent loads
    for i in range(1, len(route)):
        prev_load = route[i-1]
        next_load = route[i]
        
        # Add deadhead if locations don't match
        if (prev_load.get("destination_city") != next_load.get("origin_city") or
            prev_load.get("destination_state") != next_load.get("origin_state")):
            print(f"[ROUTE_PLANNER] Adding connecting deadhead: {prev_load.get('destination_city')}, {prev_load.get('destination_state')} -> {next_load.get('origin_city')}, {next_load.get('origin_state')}")
            deadhead = await create_deadhead_segment(
                prev_load.get("destination_city"), prev_load.get("destination_state"),
                next_load.get("origin_city"), next_load.get("origin_state"),
                current_date.strftime("%Y-%m-%d")
            )
            complete_route.append(deadhead)
            current_date = parse_date(deadhead.get("receive_date"))
        
        # Calculate receive date for the load if not present
        if not next_load.get("receive_date"):
            travel_days = calculate_travel_days(safe_float(next_load.get("distance", 0)))
            ship_date = parse_date(next_load.get("ship_date"))
            next_load["receive_date"] = (ship_date + timedelta(days=travel_days)).strftime("%Y-%m-%d")
        
        # Add the load
        complete_route.append(next_load)
        current_date = parse_date(next_load.get("receive_date"))
    
    # Add final deadhead back to start if needed
    last_load = route[-1]
    if (last_load.get("destination_city") != start_city or
        last_load.get("destination_state") != start_state):
        print(f"[ROUTE_PLANNER] Adding return deadhead: {last_load.get('destination_city')}, {last_load.get('destination_state')} -> {start_city}, {start_state}")
        final_deadhead = await create_deadhead_segment(
            last_load.get("destination_city"), last_load.get("destination_state"),
            start_city, start_state,
            current_date.strftime("%Y-%m-%d")
        )
        complete_route.append(final_deadhead)
    
    return complete_route

async def calculate_route_distance(origin_city, origin_state, dest_city, dest_state):
    """Calculate route distance between cities using Google Maps Routes API"""
    try:
        distance, duration = await google_maps_service.get_driving_distance(
            origin_city, origin_state, dest_city, dest_state
        )
        if distance is not None:
            return distance
        print(f"[ROUTE_PLANNER] Warning: Could not calculate distance from {origin_city}, {origin_state} to {dest_city}, {dest_state}")
        return None
    except Exception as e:
        print(f"[ROUTE_PLANNER] Error calculating distance: {e}")
        return None

async def calculate_route_metrics(route):
    """Calculate total revenue, miles, and rate per mile for a route"""
    total_revenue = 0
    total_miles = 0
    total_deadhead = 0
    
    print("\n[ROUTE_PLANNER] Calculating final route metrics:")
    
    for i, load in enumerate(route):
        # Handle revenue based on load type
        if load.get("is_deadhead"):
            # Deadhead segments have no revenue
            revenue = 0
            total_deadhead += safe_float(load.get("distance", 0))
            print(f"\nSegment {i+1} (DEADHEAD):")
            print(f"  From: {load['origin_city']}, {load['origin_state']}")
            print(f"  To: {load['destination_city']}, {load['destination_state']}")
            print(f"  Date: {load['ship_date']} (same day deadhead)")
            print(f"  Distance: {load.get('distance', 0)} miles")
        else:
            # Use the pre-calculated revenue from the load
            revenue = safe_float(load.get("revenue", 0))
            if revenue == 0:
                # Fallback calculation if revenue wasn't pre-calculated
                pay_rate = safe_float(load.get("pay_rate", 0))
                rate_per_mile = safe_float(load.get("rate_per_mile_est", 0))
                distance = safe_float(load.get("distance", 0) or 0)
                revenue = pay_rate if pay_rate > 0 else (rate_per_mile * distance)
            
            print(f"\nSegment {i+1} (LOAD):")
            print(f"  From: {load['origin_city']}, {load['origin_state']}")
            print(f"  To: {load['destination_city']}, {load['destination_state']}")
            print(f"  Ship Date: {load['ship_date']}")
            print(f"  Delivery Date: {load['receive_date']}")
            print(f"  Rate/Mile: ${safe_float(load.get('rate_per_mile_est', 0)):.2f}")
            print(f"  Distance: {load.get('distance', 0)} miles")
            print(f"  Revenue: ${revenue:.2f}")
        
        total_revenue += revenue
        total_miles += safe_float(load.get("distance", 0))
    
    # Calculate rate per mile (excluding deadhead)
    revenue_miles = total_miles - total_deadhead
    rate_per_mile = total_revenue / revenue_miles if revenue_miles > 0 else 0
    
    print(f"\n[ROUTE_PLANNER] Final Route Summary:")
    print(f"  Total Revenue: ${total_revenue:.2f}")
    print(f"  Total Miles: {total_miles:.1f}")
    print(f"  Revenue Miles: {revenue_miles:.1f}")
    print(f"  Deadhead Miles: {total_deadhead:.1f}")
    print(f"  Average Rate: ${rate_per_mile:.2f}/mile")
    print(f"  Route Duration: {route[-1]['receive_date']} - {route[0]['ship_date']}")
    
    return total_revenue, total_miles, rate_per_mile

async def brute_force_with_home_gravity(
    start_city, 
    start_state, 
    start_date_str, 
    max_weight, 
    truck_types, 
    max_loads,
    user_integration_id
):
    """Find the best route using a brute force approach with home gravity"""
    try:
        print(f"\n[ROUTE_PLANNER] Starting route planning from {start_city}, {start_state}")
        print(f"[ROUTE_PLANNER] Parameters:")
        print(f"  Start Date: {start_date_str}")
        print(f"  Max Weight: {max_weight}")
        print(f"  Truck Types: {truck_types}")
        print(f"  Max Loads: {max_loads}")
        
        start_date = datetime.strptime(start_date_str, "%Y-%m-%d")
        current_city = start_city
        current_state = start_state
        current_date = start_date
        route = []
        
        for i in range(max_loads):
            print(f"\n[ROUTE_PLANNER] Finding load {i+1} of {max_loads}")
            print(f"[ROUTE_PLANNER] Current location: {current_city}, {current_state}")
            print(f"[ROUTE_PLANNER] Current date: {current_date.strftime('%Y-%m-%d')}")
            
            # Get available loads from current location
            loads = await get_loads(
                current_city, 
                current_state, 
                current_date.strftime("%Y-%m-%d"),
                max_weight, 
                truck_types,
                user_integration_id
            )
            
            if not loads:
                print(f"[ROUTE_PLANNER] No loads found from {current_city}, {current_state}")
                break
            
            print(f"[ROUTE_PLANNER] Found {len(loads)} potential loads")
            
            # Score each load
            for load in loads:
                load["score"] = await score_load(
                    load, 
                    start_city, 
                    start_state,
                    current_date,
                    start_date
                )
            
            # Sort loads by score
            loads.sort(key=lambda x: x["score"], reverse=True)
            
            # Take the best load
            best_load = loads[0]
            print(f"[ROUTE_PLANNER] Selected best load:")
            print(f"  From: {best_load['origin_city']}, {best_load['origin_state']}")
            print(f"  To: {best_load['destination_city']}, {best_load['destination_state']}")
            
            # Calculate revenue
            rate_per_mile = safe_float(best_load.get("rate_per_mile_est", 0))
            distance = safe_float(best_load.get("distance", 0))
            pay_rate = safe_float(best_load.get("pay_rate", 0))
            revenue = pay_rate if pay_rate > 0 else (rate_per_mile * distance)
            best_load["revenue"] = revenue
            
            print(f"  Revenue: ${revenue:.2f}")
            print(f"  Distance: {best_load.get('distance', 0)} miles")
            print(f"  Score: {best_load.get('score', 0):.2f}")
            
            # Calculate and set receive_date for the load
            travel_days = calculate_travel_days(safe_float(best_load.get("distance", 0)))
            ship_date = datetime.strptime(best_load["ship_date"], "%Y-%m-%d")
            best_load["receive_date"] = (ship_date + timedelta(days=travel_days)).strftime("%Y-%m-%d")
            
            route.append(best_load)
            
            # Update current location and date
            current_city = best_load["destination_city"]
            current_state = best_load["destination_state"]
            current_date = datetime.strptime(best_load["receive_date"], "%Y-%m-%d")
        
        if not route:
            print("[ROUTE_PLANNER] No valid route found")
            return None
            
        # Connect route segments with deadheads
        print("\n[ROUTE_PLANNER] Connecting route segments with deadheads...")
        complete_route = await connect_route_segments(route, start_city, start_state, start_date_str)
        
        # Calculate final route metrics
        total_revenue, total_miles, rate_per_mile = await calculate_route_metrics(complete_route)
        
        print("\n[ROUTE_PLANNER] Route planning complete!")
        return complete_route
        
    except Exception as e:
        print(f"[ROUTE_PLANNER] Error in route planning: {str(e)}")
        print(f"[ROUTE_PLANNER] Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e)) 