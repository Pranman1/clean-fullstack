from datetime import datetime, timedelta
from typing import List, Dict, Any
from app.services.bruteforce_service import get_loads
from app.models.load import LoadResponse
from app.services.load_search_service import truckstop_search
import asyncio

async def calculate_deadhead_miles(outbound_load, return_load):
    return outbound_load.get('origin_distance', 0) + return_load.get('origin_distance', 0) + return_load.get('destination_distance', 0)

# will likely use PRAWL in the future
async def outbound_score(load):
    return load.get('score', 0)

async def total_score(outbound_load, return_load):
    deadhead_miles = await calculate_deadhead_miles(outbound_load, return_load)
    total_distance = deadhead_miles + outbound_load.get('distance', 0) + return_load.get('distance', 0)
    total_revenue = outbound_load.get('rate_per_mile_est', 0) * outbound_load.get('distance', 0) + return_load.get('rate_per_mile_est', 0) * return_load.get('distance', 0)
    estimate_1 = (outbound_load.get('distance', 0) + outbound_load.get('origin_distance', 0) + return_load.get('origin_distance', 0)) // 550 + (return_load.get('distance', 0) + return_load.get('destination_distance', 0)) // 550
    estimate_2 = (outbound_load.get('distance', 0) + outbound_load.get('origin_distance', 0)) // 550 + (return_load.get('distance', 0) + return_load.get('destination_distance', 0) + return_load.get('origin_distance', 0)) // 550
    estimated_days = 2 + min(estimate_1, estimate_2)
    day_revenue = total_revenue / estimated_days
    return total_revenue / total_distance + 0.004 * day_revenue

async def get_backhaul_loads(
    origin_city: str,
    origin_state: str,
    date: str,
    max_weight: int,
    truck_type: str,
    origin_range: int,
    user_integration_id: str,
    destination_city: str = "",
    destination_state: str = "",
    destination_range: int = 100
) -> List[Dict[str, Any]]:
    """
    Get paired loads (outbound + return) optimized for backhaul routes.
    Returns top 3 return options for each outbound load.
    """
    try:
        print(f"[BACKHAUL] Starting backhaul search from {origin_city}, {origin_state} on {date}")
        
        # Get outbound loads for specified date
        outbound_loads = await get_loads(
            origin_city,
            origin_state,
            date,
            max_weight,
            [truck_type],
            user_integration_id,
            destination_city=destination_city,
            destination_state=destination_state,
        )

        for load in outbound_loads:
            load['score'] = await outbound_score(load)

        #not sure if needed, outbound loads might be sorted already
        sorted_outbound_loads = sorted(outbound_loads, key=lambda x: x['score'], reverse=True)
        
        print(f"[BACKHAUL] Found {len(outbound_loads)} outbound loads")
        
        # Calculate next day for return loads
        date_obj = datetime.strptime(date, "%Y-%m-%d")
        next_day = (date_obj + timedelta(days=1)).strftime("%Y-%m-%d")
        
        load_pairs = []
        
        # For each outbound load, find return loads
        for outbound in sorted_outbound_loads[:min(20, len(sorted_outbound_loads))]:
            print(f"[BACKHAUL] Finding return loads for route to {outbound['destination_city']}, {outbound['destination_state']}")

            if outbound.get('distance', 0) == 0:
                continue

            if outbound.get('rate_per_mile_est', 0) == 0:
                continue

            distance_traveled = outbound.get('distance', 0) + outbound.get('origin_distance', 0)
            estimated_days = 1 + distance_traveled // 550
            next_day = (date_obj + timedelta(days=estimated_days)).strftime("%Y-%m-%d")
            
            
            # Get return loads from destination
            return_loads = await get_loads(
                outbound['destination_city'],
                outbound['destination_state'],
                next_day,
                max_weight,
                [truck_type],
                user_integration_id,
                True,
                destination_city=origin_city,
                destination_state=origin_state
            )
            
            # Filter return loads to those ending near original origin
            # TODO: Implement radius check around original origin
            
            # Calculate scores for each pair
            pairs_for_outbound = []
            for return_load in return_loads:

                if return_load.get('distance', 0) == 0:
                    continue

                if return_load.get('rate_per_mile_est', 0) == 0:
                    continue

                deadhead_miles = await calculate_deadhead_miles(outbound, return_load)
                # Combined score is sum of individual scores minus deadhead penalty
                combined_score = await total_score(outbound, return_load)

                total_revenue = (outbound.get('rate_per_mile_est', 0) * outbound.get('distance', 0) + return_load.get('rate_per_mile_est', 0) * return_load.get('distance', 0))
                total_miles = outbound.get('distance', 0) + return_load.get('distance', 0) + deadhead_miles
                
                pair = {
                    "outbound": outbound,
                    "return": return_load,
                    "combined_score": combined_score,
                    "total_revenue": total_revenue,
                    "total_miles": total_miles,
                    "deadhead_miles": deadhead_miles,
                    "average_rate": total_revenue / total_miles,
                }
                pairs_for_outbound.append(pair)
            
            # Sort pairs by combined score and take top 3
            pairs_for_outbound.sort(key=lambda x: x['combined_score'], reverse=True)
            top_pairs = pairs_for_outbound[:3]
            
            load_pairs.extend(top_pairs)
        
        # Sort all pairs by combined score
        load_pairs.sort(key=lambda x: x['combined_score'], reverse=True)
        
        print(f"[BACKHAUL] Found {len(load_pairs)} valid load pairs")
        return load_pairs
        
    except Exception as e:
        print(f"[BACKHAUL ERROR] Error in backhaul search: {str(e)}")
        return [] 