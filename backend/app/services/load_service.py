import http.client
import json
import os
import time
from typing import List, Optional
import geopy.distance
from geopy.geocoders import Nominatim
from dotenv import load_dotenv
from datetime import datetime
from functools import lru_cache

# Load API token from environment variables
load_dotenv()
API_TOKEN = os.getenv("DIRECT_FREIGHT_API_TOKEN", "42b0866391150f615ae603d97015920ba0e72ef7")
geolocator = Nominatim(user_agent="skywaze_app")

@lru_cache(maxsize=500)
def geocode_cached(city_state):
    return geolocator.geocode(city_state)

def find_distance(start_city: str, start_state: str, dest_city: str, dest_state: str) -> Optional[float]:
    """
    Finds the distance between two cities using the geopy library
    """
    try:
        print(f"[DISTANCE] Finding distance from {start_city}, {start_state} to {dest_city}, {dest_state}")
        start_time = time.time()
        start_location = geocode_cached(f"{start_city}, {start_state}")
        dest_location = geocode_cached(f"{dest_city}, {dest_state}")

        if start_location and dest_location:
            distance = geopy.distance.distance(
                (start_location.latitude, start_location.longitude),
                (dest_location.latitude, dest_location.longitude)
            ).miles
            
            elapsed = time.time() - start_time
            print(f"[DISTANCE] Found distance: {distance} miles (took {elapsed:.2f}s)")
            return distance
        else:
            print(f"[DISTANCE] Failed to find locations. Start location found: {bool(start_location)}, Dest location found: {bool(dest_location)}")
            return None
    except Exception as e:
        print(f"[DISTANCE ERROR] Error finding distance: {e}")
        return None

def find_loads(
    start_city: str, 
    start_state: str, 
    dest_city: str = "", 
    dest_state: str = "", 
    max_weight: int = 45000, 
    truck_type: str = "V",
    ship_date: str = "2023-04-20"
) -> List[dict]:
    """
    Finds loads based on search criteria using the DirectFreight API
    """
    print(f"[DIRECT_FREIGHT] Searching for loads from {start_city}, {start_state} to {dest_city}, {dest_state}")
    print(f"[DIRECT_FREIGHT] Parameters: truck_type={truck_type}, max_weight={max_weight}, ship_date={ship_date}")
    
    # Ensure ship_date is in YYYY-MM-DD format
    try:
        ship_date_obj = datetime.strptime(ship_date, "%Y-%m-%d")
        ship_date = ship_date_obj.strftime("%Y-%m-%d")
    except ValueError:
        print(f"[DIRECT_FREIGHT] Invalid date format: {ship_date}, using default")
        ship_date = datetime.now().strftime("%Y-%m-%d")
    
    all_results = []
    page_number = 0
    total_pages = 1  # placeholder to enter the loop
    
    # Convert truck_type to list if it's a string
    truck_types = [truck_type] if isinstance(truck_type, str) else truck_type
    
    while page_number < total_pages and page_number < 3:  # Limit to 3 pages for performance
        try:
            print(f"[DIRECT_FREIGHT] Requesting page {page_number+1}")
            start_time = time.time()
            
            conn = http.client.HTTPSConnection("api.directfreight.com")
            payload = {
                "origin_city": start_city,
                "origin_state": [start_state],
                "origin_radius": 200,
                "ship_date": [ship_date],
                "max_weight": max_weight,
                "trailer_type": truck_types,
                "full_load": False,
                "item_count": 50,
                "sort_parameter": "age",
                "sort_direction": "asc",
                "page_number": page_number
            }

            if dest_city:
                print("[DIRECT_FREIGHT] Using origin-destination search payload")
                payload.update({
                    "destination_city": dest_city,
                    "destination_state": [dest_state],
                    "destination_radius": 200
                })
            else:
                print("[DIRECT_FREIGHT] Using origin-only search payload")

            headers = {
                "Accept": "application/json",
                "Content-Type": "application/json",
                "end-user-token": "01234567890abc",
                "x-dont-update-user-last-date": "NO DEFAULT",
                "api-token": API_TOKEN
            }

            print(f"[DIRECT_FREIGHT] Sending request to DirectFreight API with payload: {json.dumps(payload)}")
            
            conn.request("POST", "/v1/boards/loads", json.dumps(payload), headers)
            
            print("[DIRECT_FREIGHT] Waiting for response...")
            res = conn.getresponse()
            data = res.read()
            conn.close()

            elapsed = time.time() - start_time
            print(f"[DIRECT_FREIGHT] Received response in {elapsed:.2f}s with status: {res.status}")
            
            if res.status != 200:
                print(f"[DIRECT_FREIGHT] Error response: {data.decode('utf-8')}")
                
            response = json.loads(data.decode("utf-8"))
            page_results = response.get("list", [])
            
            print(f"[DIRECT_FREIGHT] Got {len(page_results)} loads from page {page_number+1}")
            all_results.extend(page_results)

            total_pages = response.get("total_pages", 1)
            page_number += 1
            
        except Exception as e:
            print(f"[DIRECT_FREIGHT ERROR] Error finding loads: {e}")
            break

    print(f"[DIRECT_FREIGHT] Completed search with {len(all_results)} total loads")
    return all_results

def find_best_loads(
    start_city: str, 
    start_state: str, 
    dest_city: str = "", 
    dest_state: str = "", 
    max_weight: int = 45000, 
    truck_type: str = "V",
    ship_date: str = "2023-04-20",
    origin_city: str = None, 
    origin_state: str = None
) -> List[dict]:
    """
    Finds the best loads for a given start city and destination city.
    Ranks loads based on length, weight, rate, age, and deadhead distance.
    """
    print(f"[BEST_LOADS] Finding best loads from {start_city}, {start_state} to {dest_city or 'anywhere'}")
    
    # Use the provided origin as the fallback if not specified
    if not origin_city:
        origin_city = start_city
    if not origin_state:
        origin_state = start_state

    # Define weights for ranking criteria
    length_weight = -0.2  # Less is better
    weight_weight = -0.1  # Less is better
    rate_weight = 0.4     # Higher is better
    age_weight = -0.1     # Less is better
    deadhead_weight = -0.2  # Less is better

    loads = find_loads(start_city, start_state, dest_city, dest_state, max_weight, truck_type, ship_date)
    
    if not loads:
        print("[BEST_LOADS] No loads found, returning empty list")
        return []
    
    print(f"[BEST_LOADS] Found {len(loads)} loads, applying ranking algorithm")
        
    # Extract values for normalization
    lengths = [load.get("length", 0) or 0 for load in loads]
    weights = [load.get("weight", 0) or 0 for load in loads]
    pay_rates = [load.get("rate_per_mile_est", 0) or 0 for load in loads]
    deadheads = [load.get("dead_head", 0) or 0 for load in loads]
    ages = [load.get("age", 0) or 0 for load in loads]

    # Compute min/max for normalization
    min_len, max_len = min(lengths) if lengths else 0, max(lengths) if lengths else 1
    min_wt, max_wt = min(weights) if weights else 0, max(weights) if weights else 1
    min_rate, max_rate = min(pay_rates) if pay_rates else 0, max(pay_rates) if pay_rates else 1
    min_dead, max_dead = min(deadheads) if deadheads else 0, max(deadheads) if deadheads else 1
    min_age, max_age = min(ages) if ages else 0, max(ages) if ages else 1

    def normalize(value, min_val, max_val):
        if max_val == min_val:
            return 0  # Avoid divide-by-zero; treat as neutral
        return (value - min_val) / (max_val - min_val)
    
    criteria = [
    ("length", length_weight, min_len, max_len),
    ("weight", weight_weight, min_wt, max_wt),
    ("rate_per_mile_est", rate_weight, min_rate, max_rate),
    ("dead_head", deadhead_weight, min_dead, max_dead),
    ("age", age_weight, min_age, max_age),
]
        
    def score(load):
        total = 0
        for key, weight, min_val, max_val in criteria:
            val = normalize(load.get(key, 0) or 0, min_val, max_val)
            total += weight * val
        load["score"] = round(total, 2) # Add the score to the load object
        return total

    # Sort loads by score in descending order
    sorted_loads = sorted(loads, key=score, reverse=True)
    
    # Limit to top 10 results (changed from 20 back to 10 as requested)
    result = sorted_loads[:10] if len(sorted_loads) > 10 else sorted_loads
    print(f"[BEST_LOADS] Returning top {len(result)} loads")
    
    return result 