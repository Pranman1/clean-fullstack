import os
import httpx
from typing import Optional, Tuple

class GoogleMapsRoutesService:
    def __init__(self):
        self.api_key = os.getenv('GOOGLE_MAPS_API_KEY')
        self.base_url = "https://routes.googleapis.com/directions/v2:computeRoutes"
        
        if not self.api_key:
            raise ValueError("GOOGLE_MAPS_API_KEY environment variable is not set")
    
    async def get_driving_distance(
        self, 
        origin_city: str, 
        origin_state: str, 
        dest_city: str, 
        dest_state: str
    ) -> Tuple[Optional[float], Optional[float]]:
        """
        Get driving distance and duration between two locations using Google Maps Routes API.
        Returns a tuple of (distance_in_miles, duration_in_hours)
        """
        try:
            # Format addresses
            origin = f"{origin_city}, {origin_state}, USA"
            destination = f"{dest_city}, {dest_state}, USA"
            
            # Prepare the request payload
            payload = {
                "origin": {
                    "address": origin
                },
                "destination": {
                    "address": destination
                },
                "travelMode": "DRIVE",
                "routingPreference": "TRAFFIC_AWARE",
                "computeAlternativeRoutes": False,
                "extraComputations": ["TOLLS"],
                "languageCode": "en-US",
                "units": "IMPERIAL"
            }
            
            headers = {
                "Content-Type": "application/json",
                "X-Goog-Api-Key": self.api_key,
                "X-Goog-FieldMask": "routes.duration,routes.distanceMeters"
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.base_url,
                    json=payload,
                    headers=headers,
                    timeout=10.0
                )
                
                if response.status_code != 200:
                    print(f"[GOOGLE_MAPS] Error: {response.status_code} - {response.text}")
                    return None, None
                
                data = response.json()
                if not data.get("routes"):
                    print(f"[GOOGLE_MAPS] No routes found for {origin} to {destination}")
                    return None, None
                
                # Get the first (best) route
                route = data["routes"][0]
                
                # Convert meters to miles
                distance_miles = float(route["distanceMeters"]) / 1609.34
                
                # Convert seconds to hours
                duration_hours = float(route["duration"].rstrip('s')) / 3600
                
                print(f"[GOOGLE_MAPS] Found route: {distance_miles:.1f} miles, {duration_hours:.1f} hours")
                return distance_miles, duration_hours
                
        except Exception as e:
            print(f"[GOOGLE_MAPS] Error calculating distance: {str(e)}")
            return None, None

# Create a singleton instance
google_maps_service = GoogleMapsRoutesService() 