import os
from twilio.rest import Client
from datetime import datetime
import urllib.parse
import anthropic
import json
from typing import List, Dict, Any, Optional
from app.services.load_service import find_best_loads

# Twilio credentials from environment variables
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN")
TWILIO_PHONE_NUMBER = os.getenv("TWILIO_PHONE_NUMBER")

# Claude API key (placeholder)
CLAUDE_API_KEY = os.getenv("CLAUDE_API_KEY", "your_claude_api_key")

# Initialize Twilio client
client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)

# Initialize Claude client
claude = anthropic.Anthropic(api_key=CLAUDE_API_KEY)

def make_call(phone_number: str, message: str, callback_url: Optional[str] = None) -> Dict[str, Any]:
    """
    Initiates a phone call to the specified number with Twilio
    
    Args:
        phone_number: The phone number to call
        message: Initial message to say
        callback_url: URL for Twilio to send webhooks to
    
    Returns:
        Dictionary with call details
    """
    try:
        print(f"Making call to {phone_number} with callback_url {callback_url}")
        
        # Ensure the callback URL is valid
        if not callback_url:
            raise ValueError("Callback URL must be provided")
            
        # Format the TwiML to control the call
        twiml = f"""
        <Response>
            <Say voice="Polly.Matthew">{message}</Say>
            <Gather input="speech" action="{callback_url}" method="POST" speechTimeout="2" speechModel="phone_call">
                <Say voice="Polly.Matthew">Please tell me what kind of loads you're looking for.</Say>
            </Gather>
        </Response>
        """
        
        # Make the call
        call = client.calls.create(
            to=phone_number,
            from_=TWILIO_PHONE_NUMBER,
            twiml=twiml
        )
        
        print(f"Call initiated: {call.sid}")
        
        return {
            "call_sid": call.sid,
            "status": call.status,
            "phone_number": phone_number,
            "message": message,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        print(f"Error making call: {str(e)}")
        raise e

def parse_user_query(speech_text: str) -> Dict[str, Any]:
    """
    Parses the user's spoken query to extract search parameters for loads
    
    Args:
        speech_text: The transcribed speech from the user
    
    Returns:
        Dictionary with extracted parameters
    """
    # Use Claude to extract structured information from the user's query
    prompt = f"""
    Extract load search parameters from this user query: "{speech_text}"
    
    Please extract the following parameters if mentioned:
    - Origin city and state
    - Destination city and state (if specified)
    - Truck type (options: Van, Flatbed, Reefer, etc.)
    - Weight (if specified)
    - Date (if specified, otherwise use today's date)
    
    Return ONLY the extracted parameters in this exact JSON format:
    {{
      "origin_city": "extracted city name",
      "origin_state": "two-letter state code",
      "destination_city": "extracted city name or null if not specified",
      "destination_state": "two-letter state code or null if not specified",
      "truck_type": "extracted truck type or null if not specified",
      "max_weight": extracted weight as number or null if not specified,
      "ship_date": "extracted date in YYYY-MM-DD format or null if not specified",
      "query_type": "load_search" or "saved_loads" if the user is asking about saved loads
    }}
    
    Provide ONLY the JSON output without explanation or formatting.
    """
    
    try:
        # Call Claude to extract parameters
        response = claude.messages.create(
            model="claude-3-haiku-20240307",
            max_tokens=1000,
            messages=[
                {"role": "user", "content": prompt}
            ]
        )
        
        # Parse the JSON response
        extracted_text = response.content[0].text
        # Clean up any markdown formatting that Claude might add
        cleaned_text = extracted_text.replace("```json", "").replace("```", "").strip()
        parsed_params = json.loads(cleaned_text)
        
        # Apply some defaults for missing values
        if not parsed_params.get("truck_type"):
            parsed_params["truck_type"] = "V"  # Default to Van
        if not parsed_params.get("max_weight"):
            parsed_params["max_weight"] = 45000  # Default max weight
        if not parsed_params.get("ship_date"):
            parsed_params["ship_date"] = datetime.now().strftime("%Y-%m-%d")  # Today's date
        
        return parsed_params
    except Exception as e:
        print(f"Error parsing user query: {str(e)}")
        # Return default parameters if parsing fails
        return {
            "origin_city": "Los Angeles",  # Default
            "origin_state": "CA",  # Default
            "destination_city": None,
            "destination_state": None,
            "truck_type": "V",  # Default to Van
            "max_weight": 45000,  # Default max weight
            "ship_date": datetime.now().strftime("%Y-%m-%d"),  # Today's date
            "query_type": "load_search"
        }

def search_loads_for_call(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Searches for loads based on extracted parameters
    
    Args:
        params: Dictionary with search parameters
    
    Returns:
        Dictionary with loads and AI-generated response
    """
    try:
        # Handle edge case where origin isn't specified
        if not params.get("origin_city") or not params.get("origin_state"):
            return {
                "message": "I need to know the origin city and state to search for loads. Could you please provide them?",
                "loads": [],
                "next_action": "ask_origin"
            }
        
        # Check if this is a request for saved loads
        if params.get("query_type") == "saved_loads":
            # In a real implementation, we would fetch the user's saved loads
            return {
                "message": "Here are your saved loads. You have 3 saved loads from various locations.",
                "loads": [],  # Would be populated with actual saved loads
                "next_action": "present_saved_loads"
            }
        
        # Search for loads using the load_service
        loads = find_best_loads(
            start_city=params["origin_city"],
            start_state=params["origin_state"],
            dest_city=params.get("destination_city", ""),
            dest_state=params.get("destination_state", ""),
            max_weight=params.get("max_weight", 45000),
            truck_type=params.get("truck_type", "V"),
            ship_date=params.get("ship_date", datetime.now().strftime("%Y-%m-%d"))
        )
        
        # Generate AI response based on results
        if not loads:
            return {
                "message": f"I couldn't find any loads matching your criteria from {params['origin_city']}, {params['origin_state']}. Would you like to try a different search?",
                "loads": [],
                "next_action": "no_results"
            }
        
        # Generate a human-like summary of the loads found
        load_prompt = f"""
        Create a brief, conversational summary of these {len(loads)} loads I found:
        {json.dumps(loads[:5])}
        
        Your summary should:
        1. Mention the number of loads found
        2. Highlight key details of the top loads (origin, destination, equipment type, rate)
        3. Sound natural and conversational
        4. Be brief (2-3 sentences)
        
        Return ONLY the summary text without explanations or additional formatting.
        """
        
        summary_response = claude.messages.create(
            model="claude-3-haiku-20240307",
            max_tokens=300,
            messages=[
                {"role": "user", "content": load_prompt}
            ]
        )
        
        summary = summary_response.content[0].text.strip()
        
        return {
            "message": summary,
            "loads": loads[:5],  # Send back the top 5 loads
            "next_action": "present_loads"
        }
    except Exception as e:
        print(f"Error searching loads for call: {str(e)}")
        return {
            "message": "I encountered an error while searching for loads. Let's try again. What kind of loads are you looking for?",
            "loads": [],
            "next_action": "error"
        }

def generate_call_response(speech_text: str, call_sid: str) -> str:
    """
    Generates a TwiML response for a phone call based on the user's speech
    
    Args:
        speech_text: Transcribed speech from the user
        call_sid: The Twilio call SID
    
    Returns:
        TwiML response string
    """
    try:
        # Parse the user's query
        params = parse_user_query(speech_text)
        
        # Search for loads based on the parameters
        result = search_loads_for_call(params)
        
        # Construct the TwiML response
        load_count = len(result.get("loads", []))
        response_message = result["message"]
        
        # Get the ngrok URL from environment variables
        ngrok_url = os.getenv("NGROK_URL")
        if not ngrok_url:
            raise ValueError("NGROK_URL environment variable is not set")
        
        # Ensure the ngrok URL doesn't have a trailing slash
        if ngrok_url.endswith('/'):
            ngrok_url = ngrok_url[:-1]
            
        # Construct the fully qualified webhook URL
        webhook_url = f"{ngrok_url}/calls/webhook?call_sid={call_sid}"
        print(f"Using webhook URL for response: {webhook_url}")
        
        twiml = f"""
        <Response>
            <Say voice="Polly.Matthew">{response_message}</Say>
        """
        
        if result["next_action"] == "no_results" or result["next_action"] == "error":
            twiml += f"""
            <Gather input="speech" action="{webhook_url}" method="POST" speechTimeout="2" speechModel="phone_call">
                <Say voice="Polly.Matthew">Would you like to try a different search? Please tell me the details.</Say>
            </Gather>
            """
        elif result["next_action"] == "ask_origin":
            twiml += f"""
            <Gather input="speech" action="{webhook_url}" method="POST" speechTimeout="2" speechModel="phone_call">
                <Say voice="Polly.Matthew">Please tell me the origin city and state you're interested in.</Say>
            </Gather>
            """
        elif load_count > 0:
            twiml += f"""
            <Gather input="speech" action="{webhook_url}" method="POST" speechTimeout="2" speechModel="phone_call">
                <Say voice="Polly.Matthew">Would you like more details about any of these loads, or would you like to try a different search?</Say>
            </Gather>
            """
        else:
            twiml += f"""
            <Gather input="speech" action="{webhook_url}" method="POST" speechTimeout="2" speechModel="phone_call">
                <Say voice="Polly.Matthew">Is there anything else you'd like to know about loads?</Say>
            </Gather>
            """
        
        twiml += """
        </Response>
        """
        
        return twiml
    except Exception as e:
        print(f"Error generating call response: {str(e)}")
        # Fallback response
        
        # Get the ngrok URL from environment variables
        ngrok_url = os.getenv("NGROK_URL")
        if not ngrok_url:
            ngrok_url = "http://localhost:8000"  # Fallback, though this won't work for Twilio
        
        # Ensure the ngrok URL doesn't have a trailing slash
        if ngrok_url.endswith('/'):
            ngrok_url = ngrok_url[:-1]
            
        # Construct the fully qualified webhook URL
        webhook_url = f"{ngrok_url}/calls/webhook?call_sid={call_sid}"
        
        return f"""
        <Response>
            <Say voice="Polly.Matthew">I'm sorry, I encountered an issue processing your request. Let's try again. What kind of loads are you looking for?</Say>
            <Gather input="speech" action="{webhook_url}" method="POST" speechTimeout="2" speechModel="phone_call" />
        </Response>
        """ 