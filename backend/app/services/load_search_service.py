from typing import List
from datetime import datetime
import xml.etree.ElementTree as ET
import httpx
from app.models.load import LoadSearchRequest, LoadResponse, LoadSearchResponse
from app.services.load_service import find_best_loads
from app.services.load_service import find_distance
from functools import lru_cache

# Truckstop API Configuration
TRUCKSTOP_CONFIG = {
    "USERNAME": "CinesisAIWS",
    "PASSWORD": "3cZ26_!8t491",
    "INTEGRATION_ID": "843982",
    "BASE_URL": "https://webservices.truckstop.com/v13/Searching/LoadSearch.svc",
    "HEADERS": {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'http://webservices.truckstop.com/v12/ILoadSearch/GetMultipleLoadDetailResults'
    }
}

# Equipment type mapping for Truckstop API
EQUIPMENT_TYPE_MAP = {
    "V": "V",  # Van
    "SV": "SV", # Box Truck
    "F": "F",  # Flatbed
    "R": "R",  # Reefer
    "SD": "SD", # Step Deck
    "DD": "DD", # Double Drop
    "LB": "LB", # Lowboy
    "RGN": "RG", # RGN
    "TNK": "TK", # Tanker
    "AC": "AC", # Auto Carrier
    "CONT": "CN", # Container
    "DT": "DT", # Dump Truck
    "HB": "HB", # Hopper Bottom
    "PO": "PO"  # Power Only
}

async def search_loads(search_params: LoadSearchRequest) -> LoadSearchResponse:
    """Search for loads based on the provided parameters"""
    try:
        loads = []
        if search_params.data_source == "direct_freight":
            print("[API] Using DirectFreight API")
            loads = find_best_loads(
                start_city=search_params.origin_city,
                start_state=search_params.origin_state,
                dest_city=search_params.destination_city,
                dest_state=search_params.destination_state,
                max_weight=search_params.max_weight,
                truck_type=search_params.truck_type,
                ship_date=search_params.ship_date
            )
        else:
            print("[API] Using Truckstop API")
            loads = await truckstop_search(
                origin_city=search_params.origin_city,
                origin_state=search_params.origin_state,
                destination_city=search_params.destination_city,
                destination_state=search_params.destination_state,
                max_weight=search_params.max_weight,
                truck_type=search_params.truck_type,
                ship_date=search_params.ship_date,
                origin_range=search_params.origin_range,
                destination_range=search_params.destination_range,
                user_integration_id=search_params.user_integration_id
            )
        
        print(f"[API] Found {len(loads)} loads")
        return LoadSearchResponse(loads=loads)
    except Exception as e:
        print(f"[API ERROR] Error searching loads: {str(e)}")
        raise

async def truckstop_search(
    origin_city: str,
    origin_state: str,
    destination_city: str = "",
    destination_state: str = "",
    max_weight: int = 45000,
    truck_type: str = "V",
    ship_date: str = "2025-06-05",
    origin_range: int = 100,
    destination_range: int = 100,
    user_integration_id: str = None
) -> List[LoadResponse]:
    """Search for loads using the Truckstop API"""
    try:
        # Check if integration ID is provided
        if not user_integration_id:
            raise ValueError("Truckstop integration ID is required")
            
        # Create SOAP request
        soap_envelope = create_truckstop_soap_request(
            origin_city=origin_city,
            origin_state=origin_state,
            destination_city=destination_city,
            destination_state=destination_state,
            max_weight=max_weight,
            truck_type=truck_type,
            ship_date=ship_date,
            origin_range=origin_range,
            destination_range=destination_range,
            user_integration_id=user_integration_id
        )
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                TRUCKSTOP_CONFIG["BASE_URL"],
                content=soap_envelope,
                headers=TRUCKSTOP_CONFIG["HEADERS"]
            )
            
        if response.status_code != 200:
            error_msg = f"Truckstop API returned status code {response.status_code}"
            print(f"[API ERROR] {error_msg}")
            print(response.text)
            raise ValueError(error_msg)
            
        # Parse XML response
        root = ET.fromstring(response.text)
        
        namespaces = {
            's': 'http://schemas.xmlsoap.org/soap/envelope/',
            'a': 'http://schemas.datacontract.org/2004/07/WebServices.Objects',
            'b': 'http://schemas.datacontract.org/2004/07/Truckstop2.Objects'
        }
        
        load_results = root.findall('.//a:MultipleLoadDetailResult', namespaces)
        print(f"\n[TRUCKSTOP] Found {len(load_results)} load results in XML\n")
        
        loads = []
        target_date = ship_date
        print(f"[TRUCKSTOP] Filtering for exact date match: {target_date}")
        
        for load in load_results:
            try:
                # Helper function to safely convert numeric values
                def safe_float(value):
                    if not value or value.isspace():
                        return 0.0
                    try:
                        # Remove $ and , from currency strings
                        if isinstance(value, str):
                            value = value.replace('$', '').replace(',', '')
                        return float(value)
                    except (ValueError, TypeError):
                        return 0.0
                
                # Get pickup date for filtering
                pickup_date = load.findtext('a:PickupDate', default='', namespaces=namespaces)
                if not pickup_date:
                    print(f"[TRUCKSTOP] Skipping load - no pickup date")
                    continue
                    
                # Convert date to YYYY-MM-DD format if needed
                try:
                    if '/' in pickup_date:
                        # Convert M/D/YY to YYYY-MM-DD
                        dt = datetime.strptime(pickup_date, "%m/%d/%y")
                        pickup_date = dt.strftime("%Y-%m-%d")
                except Exception as e:
                    print(f"[TRUCKSTOP] Error parsing date {pickup_date}: {e}")
                    continue
                    
                # Skip if not exact date match
                if pickup_date != target_date:
                    print(f"[TRUCKSTOP] Skipping load - date mismatch: {pickup_date} != {target_date}")
                    continue
                
                # Parse load details with safe conversion
                load_dict = {
                    'id': load.findtext('a:ID', default='', namespaces=namespaces),
                    'origin_city': load.findtext('a:OriginCity', default='', namespaces=namespaces),
                    'origin_state': load.findtext('a:OriginState', default='', namespaces=namespaces),
                    'destination_city': load.findtext('a:DestinationCity', default='', namespaces=namespaces),
                    'destination_state': load.findtext('a:DestinationState', default='', namespaces=namespaces),
                    'length': safe_float(load.findtext('a:Length', default='0', namespaces=namespaces)),
                    'weight': safe_float(load.findtext('a:Weight', default='0', namespaces=namespaces)),
                    'distance': safe_float(load.findtext('a:Mileage', default='0', namespaces=namespaces)),
                    'ship_date': pickup_date,
                    'delivery_date': load.findtext('a:DeliveryDate', default='', namespaces=namespaces),
                    'pickup_time': load.findtext('a:PickupTime', default='', namespaces=namespaces),
                    'delivery_time': load.findtext('a:DeliveryTime', default='', namespaces=namespaces),
                    'destination_distance': safe_float(load.findtext('a:DestinationDistance', default='0', namespaces=namespaces)),
                    'origin_distance': safe_float(load.findtext('a:OriginDistance', default='0', namespaces=namespaces)),
                    'contact_name': load.findtext('a:PointOfContact', default='', namespaces=namespaces),
                    'contact_phone': load.findtext('a:PointOfContactPhone', default='', namespaces=namespaces),
                    'contact_email': load.findtext('a:TruckCompanyEmail', default='', namespaces=namespaces),
                    'equipment_type': load.findtext('a:Equipment', default='', namespaces=namespaces),
                    'description': load.findtext('a:SpecInfo', default='', namespaces=namespaces),
                    'age': safe_float(load.findtext('a:Age', default='0', namespaces=namespaces)),
                    'stops': safe_float(load.findtext('a:Stops', default='0', namespaces=namespaces)),
                    'credit_rating': load.findtext('a:Credit', default='', namespaces=namespaces),
                    'payment': safe_float(load.findtext('a:PaymentAmount', default='0', namespaces=namespaces)),
                    'data_source': 'truckstop'
                }
                
                # Calculate rate per mile from payment amount
                distance = safe_float(load.findtext('a:Mileage', default='0', namespaces=namespaces))
                payment = safe_float(load.findtext('a:PaymentAmount', default='0', namespaces=namespaces))

                
                if distance > 0 and payment > 0:
                    load_dict['rate_per_mile_est'] = payment / distance
                    print(f"[API] Load {load_dict['id']}: Payment=${payment:.2f}, Distance={distance} miles, Rate=${load_dict['rate_per_mile_est']:.2f}/mile")
                else:
                    load_dict['rate_per_mile_est'] = 0.0
                    print(f"[API] Load {load_dict['id']}: Could not calculate rate. Payment=${payment:.2f}, Distance={distance} miles")
                load_dict['deadhead_miles'] = load_dict['origin_distance'] + load_dict['destination_distance'] # leg 1/3 deadhead only
                # Calculate load score
                load_dict['score'] = await calculate_load_score(load_dict)
                print(f"[API] Load {load_dict['id']}: Score={load_dict['score']:.2f}")
                
                loads.append(LoadResponse(**load_dict))
                
            except Exception as e:
                print(f"[API ERROR] Error parsing load: {str(e)}")
                continue
        
        # Sort loads by score in descending order
        loads.sort(key=lambda x: x.score, reverse=True)
        
        print(f"[API] Found {len(loads)} loads from Truckstop matching exact date {target_date}")
        return loads
            
    except Exception as e:
        print(f"[API ERROR] Error searching Truckstop loads: {str(e)}")
        raise

def create_truckstop_soap_request(
    origin_city: str,
    origin_state: str,
    destination_city: str = "",
    destination_state: str = "",
    max_weight: int = 45000,
    truck_type: str = "V",
    ship_date: str = "2025-06-05",
    origin_range: int = 100,
    destination_range: int = 100,
    user_integration_id: str = None
) -> str:
    """Create SOAP envelope for Truckstop API request"""
    # Map equipment type
    equipment_type = EQUIPMENT_TYPE_MAP.get(truck_type.upper(), "V")
    
    # Format date for exact match
    pickup_date = ship_date
    
    # Create SOAP envelope
    soap_envelope = f"""<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                          xmlns:v12="http://webservices.truckstop.com/v12" 
                          xmlns:web="http://schemas.datacontract.org/2004/07/WebServices" 
                          xmlns:web1="http://schemas.datacontract.org/2004/07/WebServices.Searching" 
                          xmlns:truc="http://schemas.datacontract.org/2004/07/Truckstop2.Objects">
            <soapenv:Header/>
            <soapenv:Body>
                <v12:GetMultipleLoadDetailResults>
                    <v12:searchRequest>
                        <web:IntegrationId>{user_integration_id}</web:IntegrationId>
                <web:Password>{TRUCKSTOP_CONFIG["PASSWORD"]}</web:Password>
                <web:UserName>{TRUCKSTOP_CONFIG["USERNAME"]}</web:UserName>
                        <web1:Criteria>  
                    <web1:DestinationCity>{destination_city}</web1:DestinationCity>
                            <web1:DestinationCountry>usa</web1:DestinationCountry>
                    <web1:DestinationRange>{destination_range}</web1:DestinationRange>
                    <web1:DestinationState>{destination_state}</web1:DestinationState>
                    <web1:EquipmentOptions>
                        <truc:EquipmentOption>
                            <truc:Code>{equipment_type}</truc:Code>
                            <truc:IsCombo>false</truc:IsCombo>
                        </truc:EquipmentOption>
                    </web1:EquipmentOptions>
                    <web1:EquipmentType>{equipment_type}</web1:EquipmentType>
                    <web1:HoursOld>48</web1:HoursOld>
                    <web1:LoadType>Full</web1:LoadType>
                    <web1:OriginCity>{origin_city}</web1:OriginCity>
                            <web1:OriginCountry>usa</web1:OriginCountry>
                    <web1:OriginRange>{origin_range}</web1:OriginRange>
                    <web1:OriginState>{origin_state}</web1:OriginState>
                            <web1:PageNumber>0</web1:PageNumber>
                            <web1:PageSize>200</web1:PageSize>
                    <web1:PickupDate>{pickup_date}</web1:PickupDate>
                            <web1:SortBy>Age</web1:SortBy>
                            <web1:SortDescending>false</web1:SortDescending>
                    <web1:MaxWeight>{max_weight}</web1:MaxWeight>
                        </web1:Criteria>
                    </v12:searchRequest>
                </v12:GetMultipleLoadDetailResults>
            </soapenv:Body>
</soapenv:Envelope>"""

    print(f"[API] Created SOAP request for {origin_city}, {origin_state} to {destination_city}, {destination_state}")
    print(f"[API] Equipment type: {equipment_type}, Max weight: {max_weight}")
    print(f"[API] Exact pickup date: {pickup_date}")
    print(f"[API] Using integration ID: {user_integration_id}")
    
    return soap_envelope

async def calculate_load_score(load_data: dict) -> float:
    """
    Calculate a score for a load based on various factors.
    Returns a score between 0 and 1, with 0 for loads missing rates.
    """
    try:
        # Check if rate is missing or zero - rank these loads at the bottom
        rate = load_data.get('rate_per_mile_est', 0)
        if not rate or rate <= 0:
            print(f"[API] Load {load_data.get('id', 'unknown')}: No rate or zero rate - ranking at bottom")
            return 0.0
            
        score = 0.0
        
        # Factor 1: Rate per mile (higher is better) - 45% weight
        rate_score = min(rate / 5.0, 1.0)  # Normalize to 0-1, assuming $5/mile is excellent
        score += rate_score * 0.45
        
        # Factor 2: Distance (prefer medium-range loads) - 25% weight
        distance = load_data.get('distance', 0)
        if distance > 0:
            # Score peaks at 500 miles, falls off for shorter or longer
            distance_score = 1.0 - abs(distance - 500) / 1000
            distance_score = max(0, min(distance_score, 1))  # Clamp between 0 and 1
            score += distance_score * 0.25
        
        # Factor 3: Age of posting (newer is better) - 15% weight
        if load_data.get('age', 0) > 0:
            age_score = 1.0 - min(load_data['age'] / 48, 1)  # Normalize to 0-1, 48 hours old = 0
            score += age_score * 0.15
        
        # Factor 4: Number of stops (fewer is better) - 5% weight
        if load_data.get('stops') is not None:
            stops_score = 1.0 - min(load_data['stops'] / 3, 1)  # 0 stops = 1.0, 3+ stops = 0
            score += stops_score * 0.05

        # Factor 5: Deadhead miles (less is better) - 10% weight
        deadhead_miles = load_data.get('deadhead_miles', 0)
        # Normalize: 0 miles = 1.0, 300+ miles = 0.0
        deadhead_score = 1.0 - min(deadhead_miles / 300, 1.0)
        score += deadhead_score * 0.10

        print(f"[API] Load {load_data.get('id', 'unknown')} score breakdown:")
        print(f"  Rate: ${rate}/mile -> Score contribution: {rate_score * 0.45:.2f}")
        print(f"  Distance: {distance} miles -> Score contribution: {distance_score * 0.25:.2f}")
        print(f"  Age: {load_data.get('age', 0)} hours -> Score contribution: {age_score * 0.15:.2f}")
        print(f"  Stops: {load_data.get('stops', 0)} -> Score contribution: {stops_score * 0.05:.2f}")
        print(f"  Deadhead miles: {deadhead_miles} -> Score contribution: {deadhead_score * 0.10:.2f}")
        print(f"  Final score: {score:.2f}")
        
        return min(max(score, 0), 1)  # Ensure final score is between 0 and 1

    except Exception as e:
        print(f"[API WARNING] Error calculating score: {str(e)}")
        return 0.0  # Return 0 on error to rank at bottom