import anthropic
import json
from app.us_city_state_map import CITY_STATE_MAP  # create a dictionary mapping major cities to states
from app.services.load_service import find_best_loads
from datetime import datetime
import logging
import httpx  # Add this import

API_KEY = "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"

REQUIRED_ARGS = ["start_city", "start_state", "dest_city", "dest_state", "max_weight", "truck_type", "date"]

def format_load_for_agent(load, rank):
    """Format a load object into a clean string for the agent"""
    pay_rate = load.get('pay_rate')
    rpm = load.get('rate_per_mile_est')
    
    return (
        f"LOAD #{rank} (Score: {load.get('score', 'N/A')}):\n"
        f"- Route: {load.get('origin_city', 'Unknown')}, {load.get('origin_state', '')} → "
        f"{load.get('destination_city', 'Unknown')}, {load.get('destination_state', '')}\n"
        f"- Distance: {load.get('trip_miles', 'Unknown')} miles\n"
        f"- Rate: {f'${pay_rate:,.2f}' if pay_rate is not None else 'Call for rate'}\n"
        f"- Price per mile: {f'${rpm:,.2f}' if rpm is not None else 'N/A'}\n"
        f"- Pickup: {load.get('ship_date', 'Unknown')}\n"
        f"- Weight: {load.get('weight', 'Unknown')} lbs\n"
        f"- Trailer Types: {load.get('other_trailer_types', 'Unknown')}\n"
        f"- Load ID: CINESIS-{load.get('entry_id', 'UNKNOWN')[:8]}"
    )

def format_load_for_terminal(load, rank):
    """Format a load object for terminal display"""
    pay_rate = load.get('pay_rate')
    rpm = load.get('rate_per_mile_est')
    score = load.get('score')
    
    return (
        f"\n{'='*50}\n"
        f"🚛 LOAD #{rank}" + (f" (Score: {score:.2f})" if score is not None else "") + "\n"
        f"📍 {load.get('origin_city', 'Unknown')}, {load.get('origin_state', '')} → "
        f"{load.get('destination_city', 'Unknown')}, {load.get('destination_state', '')}\n"
        f"📏 Trip Miles: {load.get('trip_miles', 'Unknown')} (Deadhead: {load.get('dead_head', 'Unknown')})\n"
        f"💰 Rate: {f'${pay_rate:,.2f}' if pay_rate is not None else 'Call for rate'}" + 
        (f" (${rpm:,.2f}/mile)" if rpm is not None else "") + "\n"
        f"📅 Ship Date: {load.get('ship_date', 'Unknown')}" +
        (f" (Delivery: {load.get('receive_date')})" if load.get('receive_date') else "") + "\n"
        f"⚖️ Weight: {load.get('weight', 'Unknown')} lbs\n"
        f"🚚 Trailer: {load.get('other_trailer_types', 'Unknown')}\n"
        f"📝 Full Load: {load.get('full_load', 'Unknown')}\n"
        f"✅ Green Light: {load.get('green_light', 'Unknown')}\n"
        f"🔢 ID: {load.get('entry_id', 'UNKNOWN')[:8]}\n"
        f"{'='*50}"
    )

class DispatchAgent:
    def __init__(self, api_key=API_KEY, auth_token=None):
        self.client = anthropic.Anthropic(
            api_key=api_key,
        )
        self.chat_history = []
        self.extraction_history = []  # Separate history for extraction model
        self.args_collected = {}
        self.call_sid = None
        self.is_first_message = True
        self.current_loads = None
        self.load_offered = False
        self.last_search_params = None
        self.booked_load = None  # Track the currently booked load
        self.booking_id = None   # Track the booking ID
        self.auth_token = auth_token  # Store the auth token

    def reset(self):
        """Only reset state that should be cleared between calls"""
        self.args_collected = {}
        self.call_sid = None
        self.is_first_message = True
        self.current_loads = None
        self.load_offered = False
        self.last_search_params = None
        self.booked_load = None
        self.booking_id = None
        # Note: We don't reset chat_history, extraction_history, or auth_token

    def is_ready(self):
        return all(arg in self.args_collected for arg in REQUIRED_ARGS)

    def get_missing_args(self):
        return [arg for arg in REQUIRED_ARGS if arg not in self.args_collected]

    def _params_changed(self, new_args):
        """Check if any search parameters have changed"""
        if not new_args:
            return False
        for key, value in new_args.items():
            if key not in self.args_collected or self.args_collected[key] != value:
                return True
        return False

    def _should_search_loads(self, extracted_info):
        """Determine if we should perform a new load search"""
        if not self.is_ready():
            return False
        if self.current_loads is not None and not self._params_changed(extracted_info):
            return False
        current_params = {k: self.args_collected[k] for k in REQUIRED_ARGS}
        if current_params == self.last_search_params:
            return False
        return True

    async def process_input(self, user_input: str, call_sid: str = None) -> str:
        if call_sid and call_sid != self.call_sid:
            # Only reset if this is a new call
            self.reset()
            self.call_sid = call_sid

        # Update histories with user input
        message = {"role": "user", "content": [{"type": "text", "text": user_input}]}
        self.chat_history.append(message)
        self.extraction_history.append(message)

        # Handle common voice commands without needing extraction
        if user_input.lower() in ['hi', 'hello', 'hey', 'start', 'begin', 'hi there']:
            response = "Hi! I'm Skye from Cinesis. What route are you looking for loads on?"
            self._update_histories("assistant", response)
            return response
            
        if user_input.lower() in ['quit', 'exit', 'stop', 'end', 'goodbye', 'bye']:
            response = "Thanks for calling. Have a great day!"
            self._update_histories("assistant", response)
            return response

        # Handle requests for next/different load
        next_load_phrases = [
            'next load', 'another load', 'different load', 'what else', 
            'other loads', 'show more', 'more loads', 'what other', 
            'got anything else', 'other options'
        ]
        if any(phrase in user_input.lower() for phrase in next_load_phrases) and self.current_loads:
            loads_str = "\n\n".join(
                format_load_for_agent(load, idx) 
                for idx, load in enumerate(self.current_loads[:5], 1)
            )
            result = f"SHOW_ALTERNATIVES:\n{loads_str}"
            
            main_prompt = (
                "You are Skye, a freight broker agent at Cinesis. The driver is asking about alternative loads. " +
                "Previous conversation:\n" + "\n".join([
                    f"{'Driver' if m['role'] == 'user' else 'Skye'}: {m['content'][0]['text']}"
                    for m in self.chat_history[-5:]
                ]) + "\n\n"
                "Rules for showing alternatives:\n"
                "1. The loads are already ranked by our algorithm (Load #1 is best)\n"
                "2. If they didn't like Load #1, offer Load #2 and mention its key advantages\n"
                "3. Always compare the alternative to the previous load (rate, distance, etc)\n"
                "4. Be brief but highlight why this might be a better option\n"
                "5. If they've seen all loads, let them know those are all the current options\n"
                "Available loads:\n" + loads_str
            )

            chat_response = self.client.messages.create(
                model="claude-3-haiku-20240307",
                max_tokens=500,
                messages=[{
                    "role": "user",
                    "content": main_prompt
                }]
            )
            spoken_response = chat_response.content[0].text
            self._update_histories("assistant", spoken_response)
            return spoken_response

        # Handle conversation endings
        ending_phrases = [
            'that\'s it', 'thanks', 'thank you', 'bye', 'goodbye', 'done',
            'that\'s all', 'have a good day', 'see you', 'take care'
        ]
        if any(phrase in user_input.lower() for phrase in ending_phrases):
            if self.booked_load:
                response = (
                    f"Thanks for booking with Cinesis! Your load (ID: {self.booking_id}) has been confirmed. "
                    f"You can view all the details in the Booked Loads tab on our website. "
                    f"Have a great day!"
                )
            else:
                response = "Thanks for calling Cinesis! Have a great day!"
            self._update_histories("assistant", response)
            return response

        # Handle requests to remove/delete loads
        delete_phrases = [
            'remove that load', 'delete that load', 'cancel that load', 
            'remove the load', 'delete the load', 'cancel the load',
            'remove it', 'delete it', 'cancel it', 'take it off',
            'remove this load', 'delete this load', 'cancel this load'
        ]
        if any(phrase in user_input.lower() for phrase in delete_phrases) and self.booked_load:
            try:
                # Delete the load via the API
                async with httpx.AsyncClient(follow_redirects=True) as client:
                    if not self.auth_token:
                        print("[AGENT] No auth token available for deleting load")
                        response_text = "I apologize, but you need to be logged in to remove loads. Please log in on our website and try again."
                        self._update_histories("assistant", response_text)
                        return response_text

                    headers = {
                        "Content-Type": "application/json",
                        "Authorization": f"Bearer {self.auth_token}"
                    }
                        
                    print(f"[AGENT] Attempting to delete load with ID: {self.booking_id}")
                    
                    response = await client.delete(
                        f"http://localhost:8000/booked-loads/{self.booking_id}",
                        headers=headers,
                        timeout=10.0
                    )
                    
                    print(f"[AGENT] Delete response status: {response.status_code}")
                    
                    if response.status_code in [200, 204]:
                        print(f"[AGENT] Successfully deleted load with ID: {self.booking_id}")
                        self.booked_load = None
                        self.booking_id = None
                        response_text = "Alright, I've removed that load for you. Anything else you need help with?"
                    elif response.status_code == 401:
                        print(f"[AGENT] Authentication failed. Status: {response.status_code}")
                        response_text = "I apologize, but I'm having trouble with the authentication. Please try again in a moment."
                    elif response.status_code == 404:
                        print(f"[AGENT] Load not found. Status: {response.status_code}")
                        response_text = "I couldn't find that load in your booked loads. It may have already been removed."
                    else:
                        print(f"[AGENT] Failed to delete load. Status: {response.status_code}")
                        response_text = "I apologize, but I encountered an issue while trying to remove the load. Please try again or contact support if the issue persists."
            except Exception as e:
                print(f"[AGENT] Error deleting load: {str(e)}")
                response_text = "I apologize, but I encountered an issue while trying to remove the load. Please try again or contact support if the issue persists."
            
            self._update_histories("assistant", response_text)
            return response_text

        # Handle booking confirmations
        booking_phrases = [
            'book it', 'lets book', 'book this', 'get it booked', 'take it',
            'ill take it', 'sounds good', 'book that', 'get me booked',
            'yes', 'yeah', 'sure', 'okay', 'ok', 'great', 'perfect',
            'that works', 'that\'ll work', 'i\'ll take that', 'book it',
            'go ahead', 'do it', 'yes please', 'that\'s good', 'that sounds good',
            'that\'ll be great', 'that\'s great', 'i\'ll be great', 'that\'s perfect',
            'let\'s do it', 'let\'s go with that'
        ]
        if any(phrase in user_input.lower().replace("'", "") for phrase in booking_phrases) and self.current_loads:
            try:
                # Book the load via the API
                async with httpx.AsyncClient(follow_redirects=True) as client:
                    if not self.auth_token:
                        print("[AGENT] No auth token available for booking")
                        response_text = "I apologize, but you need to be logged in to book loads. Please log in on our website and try again."
                        self._update_histories("assistant", response_text)
                        return response_text

                    headers = {
                        "Content-Type": "application/json",
                        "Authorization": f"Bearer {self.auth_token}"
                    }
                        
                    print(f"[AGENT] Attempting to book load with headers: {headers}")
                    print(f"[AGENT] Load data: {self.current_loads[0]}")
                    
                    # Convert entry_id to a numeric hash for the database
                    load_id = hash(self.current_loads[0].get('entry_id', '')) % (2**31)
                    
                    response = await client.post(
                        "http://localhost:8000/booked-loads",
                        json={
                            "id": load_id,  # Send as integer
                            "load_id": f"CINESIS-{self.current_loads[0].get('entry_id', '')[:8]}",  # Keep the original ID as a reference
                            "booked_by": "voice_agent",
                            "origin_city": self.current_loads[0]["origin_city"],
                            "origin_state": self.current_loads[0]["origin_state"],
                            "destination_city": self.current_loads[0]["destination_city"],
                            "destination_state": self.current_loads[0]["destination_state"],
                            "distance": float(self.current_loads[0].get("trip_miles", 0) or self.current_loads[0].get("distance", 0)),
                            "pay_rate": float(self.current_loads[0].get("pay_rate") or 0),
                            "rate_per_mile_est": float(self.current_loads[0].get("rate_per_mile_est") or 0),
                            "weight": float(self.current_loads[0].get("weight", 0)),
                            "equipment_type": self.current_loads[0].get("equipment_type") or self.current_loads[0].get("truck_type"),
                            "other_trailer_types": self.current_loads[0].get("other_trailer_types"),
                            "ship_date": self.current_loads[0].get("ship_date"),
                            "data_source": self.current_loads[0].get("data_source", "direct_freight"),
                            "green_light": bool(self.current_loads[0].get("green_light", False)),
                            "full_load": bool(self.current_loads[0].get("full_load", True)),
                            "dead_head": float(self.current_loads[0].get("dead_head", 0)),
                            "receive_date": self.current_loads[0].get("receive_date"),
                            "status": "booked"
                        },
                        headers=headers,
                        timeout=10.0
                    )
                    
                    print(f"[AGENT] Booking response status: {response.status_code}")
                    print(f"[AGENT] Booking response: {response.text}")
                    
                    if response.status_code == 200:
                        booked_load = response.json()
                        self.booked_load = booked_load
                        self.booking_id = booked_load["id"]
                        print(f"[AGENT] Successfully booked load with ID: {self.booking_id}")
                        response_text = (
                            f"Perfect! I've booked that load for you. "
                            f"You can view all the details in the Booked Loads tab on our website. "
                            f"Is there anything else you need help with?"
                        )
                    elif response.status_code == 401:
                        print(f"[AGENT] Authentication failed. Status: {response.status_code}")
                        response_text = "I apologize, but I'm having trouble with the booking system authentication. Please try again in a moment."
                    else:
                        print(f"[AGENT] Failed to book load. Status: {response.status_code}, Response: {response.text}")
                        response_text = "I apologize, but I encountered an issue while trying to book the load. Please try again or contact support if the issue persists."
            except Exception as e:
                print(f"[AGENT] Error booking load: {str(e)}")
                response_text = "I apologize, but I encountered an issue while trying to book the load. Please try again or contact support if the issue persists."
            
            self._update_histories("assistant", response_text)
            return response_text

        # Regular extraction and processing continues...
        extracted = {}
        try:
            extract_prompt = (
                "You are a professional load matching agent parsing driver requests. Your task is to extract structured info as a JSON dictionary.\n"
                "CRITICAL: You MUST ALWAYS return a valid JSON object, even if empty.\n\n"
                "Rules for extraction:\n"
                "1. ALWAYS return valid JSON - this is critical for our phone system\n"
                "2. Expand common city codes: SF→San Francisco, LA→Los Angeles, NYC→New York City, etc\n"
                "3. Convert dates to YYYY-MM-DD format (e.g., 'June 4th 2025' → '2025-06-04')\n"
                "4. For unclear cities (like 'SS'), omit them and let the conversation continue\n"
                "5. Extract ONLY what's explicitly mentioned\n"
                "6. Use two-letter state codes (CA, NY, etc)\n"
                "7. For weights, convert to standard format (e.g., '45k' → '45000')\n"
                "8. For truck types: V (Van), R (Reefer), F (Flatbed)\n"
                "9. If multiple cities are mentioned for origin, ask for clarification\n"
                "10. Never accept multiple start cities - if unclear which one, don't set start_city\n\n"
                "Example inputs and outputs:\n"
                '# "Looking for loads from SF to LA leaving June 4th 2025"\n'
                '{"start_city": "San Francisco", "start_state": "CA", "dest_city": "Los Angeles", "dest_state": "CA", "date": "2025-06-04"}\n\n'
                '# "Got a reefer, max 45k pounds"\n'
                '{"truck_type": "R", "max_weight": "45000"}\n\n'
                '# "From either SF or LA"\n'
                '{}\n\n'
                '# "Change it to Dallas"\n'
                '{"dest_city": "Dallas", "dest_state": "TX"}\n\n'
                '# "Hello there"\n'
                '{}\n\n'
                "Previous messages:\n" + "\n".join([f"User: {m['content'][0]['text']}" for m in self.extraction_history[-5:] if m['role'] == 'user']) + "\n\n"
                "Current context: " + str(self.args_collected) + "\n"
                "User message: " + user_input + "\n"
                "Remember: ALWAYS return valid JSON, even if empty {}"
            )

            extract_response = self.client.messages.create(
                model="claude-3-haiku-20240307",
                max_tokens=200,
                messages=[{
                    "role": "user",
                    "content": extract_prompt
                }]
            )
            
            # Ensure we get valid JSON
            response_text = extract_response.content[0].text.strip()
            if not response_text.startswith('{'): # Find the first JSON object
                response_text = response_text[response_text.find('{'):]
            if not response_text.endswith('}'): # Trim anything after the JSON
                response_text = response_text[:response_text.rfind('}')+1]
            
            extracted = json.loads(response_text)
            
            # Validate extracted data
            if isinstance(extracted.get('start_city'), list):
                # If multiple start cities were extracted, clear it and ask for clarification
                extracted.pop('start_city', None)
                extracted.pop('start_state', None)
                print("[AGENT] Multiple start cities detected - clearing and asking for clarification")
            
            # Only update if we got new valid information
            if self._params_changed(extracted):
                for key, value in extracted.items():
                    if value is not None and len(str(value).strip()) > 0:
                        self.args_collected[key] = value

            # Update extraction history with the parsed result
            self._update_histories("assistant", f"Extracted: {json.dumps(extracted)}", extraction_only=True)

        except Exception as e:
            print(f"❌ Parser error: {e}\nAttempted to parse: {response_text}")
            extracted = {}

        print("🧠 Current args_collected:", self.args_collected)

        # Search for loads only if necessary
        if self._should_search_loads(extracted):
            print("\n🔍 Searching for loads with:", self.args_collected)
            temp = self.args_collected
            
            result = find_best_loads(
                start_city=temp['start_city'],
                start_state=temp['start_state'],
                dest_city=temp['dest_city'],
                dest_state=temp['dest_state'],
                max_weight=temp['max_weight'],
                truck_type=temp['truck_type'],
                ship_date=temp['date'],
                origin_city=temp['start_city'],
                origin_state=temp['start_state']
            )
            
            # Format and print loads to terminal
            print("\n📦 Direct Freight API Response:")
            for idx, load in enumerate(result[:5], 1):
                print(format_load_for_terminal(load, idx))
            
            self.current_loads = result[:5]  # Keep top 5 loads
            self.last_search_params = {k: self.args_collected[k] for k in REQUIRED_ARGS}
            
            if len(result) == 0: 
                result = "NO_LOADS"
            else: 
                # Format just the best load for the agent
                loads_str = format_load_for_agent(result[0], 1)
                result = f"FOUND_LOADS:\n{loads_str}"
                self.load_offered = True
        else:
            if self.current_loads and len(self.current_loads) > 0:
                loads_str = "\n\n".join(
                    format_load_for_agent(load, idx) 
                    for idx, load in enumerate(self.current_loads[:5], 1)
                )
                result = f"FOUND_LOADS:\n{loads_str}"
            elif not self.is_ready():
                missing = self.get_missing_args()
                result = "NEED_INFO:" + ",".join(missing)
            else:
                result = "NO_LOADS"

        # Update main prompt rules for normal load offering
        main_prompt = (
            "You are Skye, a friendly freight broker at Cinesis talking to a truck driver. " + 
            ("" if self.is_first_message else "DO NOT introduce yourself again. ") +
            "Previous conversation:\n" + "\n".join([
                f"{'Driver' if m['role'] == 'user' else 'Skye'}: {m['content'][0]['text']}"
                for m in self.chat_history[-5:]
            ]) + "\n\n"
            "Current context: " + (
                "NO LOADS FOUND - Apologize and suggest checking back later for new loads" if result == "NO_LOADS"
                else "NEED MORE INFO - Ask for: " + result.split(":")[1] if result.startswith("NEED_INFO")
                else result  # Now includes just the best load
            ) + "\n"
            "Rules:\n"
            "1. Be casual and friendly - talk like a real person\n"
            "2. Keep responses VERY brief - drivers are often driving\n"
            "3. Only show one load at a time (the best one)\n"
            "4. Don't list every detail - focus on key points (rate, miles, pickup date)\n"
            "5. If they want more options, then show the next best load\n"
            "6. Compare new loads to previous ones when showing alternatives\n"
            "7. Current info collected: " + str(self.args_collected) + "\n"
            "8. Never ask for info you already have\n"
            "9. Use natural language - avoid robotic responses\n"
            "10. When they agree to a load, just confirm briefly\n"
            "11. No need to repeat load details after initial offer"
        )

        chat_response = self.client.messages.create(
            model="claude-3-haiku-20240307",
            max_tokens=500,
            messages=[{
                "role": "user",
                "content": main_prompt + "\n\n" + user_input
            }]
        )
        spoken_response = chat_response.content[0].text

        # Update histories with the response
        self._update_histories("assistant", spoken_response)
        
        self.is_first_message = False
        return spoken_response

    def _update_histories(self, role: str, content: str, extraction_only: bool = False):
        """Update chat histories with new message"""
        message = {"role": role, "content": [{"type": "text", "text": content}]}
        if extraction_only:
            self.extraction_history.append(message)
        else:
            self.chat_history.append(message)
            self.extraction_history.append(message)

    def _infer_missing_states(self):
        """Fills in start_state or dest_state based on CITY_STATE_MAP if only city is available."""
        if "start_city" in self.args_collected and "start_state" not in self.args_collected:
            city = self.args_collected["start_city"].lower()
            if city in CITY_STATE_MAP:
                self.args_collected["start_state"] = CITY_STATE_MAP[city]
        if "dest_city" in self.args_collected and "dest_state" not in self.args_collected:
            city = self.args_collected["dest_city"].lower()
            if city in CITY_STATE_MAP:
                self.args_collected["dest_state"] = CITY_STATE_MAP[city] 