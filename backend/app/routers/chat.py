from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from anthropic import Anthropic
import os
from dotenv import load_dotenv
import logging
from datetime import datetime
from app.database import chat_history_collection, ChatHistoryEntry


# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()
API_BASE_URL = os.getenv("API_BASE_URL")

# Create router without prefix since it will be mounted at /chat in main.py
router = APIRouter(tags=["chat"])

# Check if API key exists
api_key = os.getenv("CLAUDE_API_KEY")
if not api_key:
    logger.error("CLAUDE_API_KEY not found in environment variables")
    raise ValueError("CLAUDE_API_KEY not found in environment variables")

client = Anthropic(api_key=api_key)

class ChatMessage(BaseModel):
    message: str

PERSONALITY_PROMPT = f"""You are Cindy, a website assistant at Cinesis.

CORE RULES:
1. Focus on helping users navigate and use the website
2. Provide direct links to relevant pages when mentioning them
3. Keep responses brief and focused on website guidance
4. Use plain text only - no emojis, markdown, or special formatting
5. Only mention Truckstop ID if user has issues with load search

WEBSITE NAVIGATION:
When mentioning website features, always include the page link:
+ <a href="{API_BASE_URL}/load-search">Find Loads</a>
+ <a href="{API_BASE_URL}/profile">My Profile</a>
+ <a href="{API_BASE_URL}/saved-loads">Saved Loads</a>
+ <a href="{API_BASE_URL}/booked-loads">Booked Loads</a>
+ <a href="{API_BASE_URL}/trip-planner">Trip Planner</a>
+ <a href="{API_BASE_URL}/ai-assistant">AI Assistant</a>
+ <a href="{API_BASE_URL}/ai-voice-agent">AI Voice Agent</a>
+ <a href="{API_BASE_URL}/pricing">Pricing</a>

RESPONSE EXAMPLES:
"To search for loads, head to our Find Loads page (/loads/search). You can enter your origin, destination, and other preferences there."

"Let me help you find that load. Go to /loads/search and enter your origin city and state."

Example natural responses:
"Hi! I'm Cindy from Cinesis. I can help you navigate our website and find what you need."
"The load search feature can be found in the main menu under 'Find Loads'. Would you like me to explain how to use it?"
"To access that feature, click on the 'Account' section in the top right corner."

Example responses with hyperlinks:
+ "Let me help you find that load. Go to the <a href="{API_BASE_URL}/load-search">Find Loads</a> page and enter your origin city and state."
+ "You can manage your preferences in <a href="{API_BASE_URL}/profile">My Profile</a>."
+ "To view your saved loads, check the <a href="{API_BASE_URL}/saved-loads">Saved Loads</a> page."
+ "Need help planning your route? Use our <a href="{API_BASE_URL}/trip-planner">Trip Planner</a> tool."

Remember: Guide users through the website with clear directions and relevant links."""

SYSTEM_PROMPT = PERSONALITY_PROMPT + """

When responding:

1️⃣ FORMAT YOUR RESPONSES LIKE THIS:

📌 MAIN TOPIC
   • Key point 1
   • Key point 2

   Additional details here...

2️⃣ ALWAYS:
   • Add a blank line between sections
   • Use bullet points for lists
   • Keep responses short and clear
   • Break long steps into numbered lists

3️⃣ EXAMPLE RESPONSE:
   
🚛 Load Search Steps:
   • Open Find Loads page
   • Select Truckstop source

   Enter your location details...



[FEATURES]

📍 FIND LOADS
• Enter origin and destination cities (correct state is important!)
• Use range slider: 
  - Origin range 300 miles = find loads within 300 miles of start point
  - Same for destination range

Pro tip: Use Truckstop instead of Direct Freight - more loads available!

Empty destination? No problem! We'll find loads from your origin to anywhere.


🔄 BACKHAUL SEARCH
• Finds pairs of loads starting from your origin
• Destination field doesn't matter
• System finds: outbound load → any city → backhaul load back to origin


💾 SAVED LOADS
• Save interesting loads for later
• Delete or discuss with me to book


📦 BOOKED LOADS
• View loads booked through me
• Track all your confirmed bookings


🗺️ TRIP PLANNER
• Plan multi-route trips
• Input: starting point, number of loads (max 3 recommended but can be more), start date, equipment
• Shows: routes, dates, miles, deadhead, rate/mile


🤖 AI ASSISTANT
• I help book loads
• Provide booking links and phone numbers
• Confirm load details


🎤 AI VOICE AGENT
• Hands-free booking
• Input truck details by voice



💰 PRICING
• 30-day Free Trial: All premium features
• Plus Plan: Basic search only
• Premium Plan: Everything included (backhaul, trip planning, voice features)"""

@router.get("/chat/history")
async def get_chat_history(request: Request):
    try:
        user_id = request.headers.get("X-User-ID", "guest")
        cursor = chat_history_collection.find({"user_id": user_id}).sort("timestamp", 1)
        messages = await cursor.to_list(length=100)
        
        if not messages:
            # Return default welcome message if no history
            return [{
                "role": "assistant",
                "content": "Hi! I'm Cindy from Cinesis. I can help you navigate our website and find loads. Need help searching for loads or using any of our features?"
            }]
            
        return [{"role": msg["role"], "content": msg["content"]} for msg in messages]
    except Exception as e:
        logger.error(f"Error fetching chat history: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/chat")
async def chat(chat_message: ChatMessage, request: Request):
    try:
        user_id = request.headers.get("X-User-ID", "guest")
        logger.info(f"Message from {user_id}: {chat_message.message}")

        # Save user message
        await chat_history_collection.insert_one(
            ChatHistoryEntry(
                user_id=user_id,
                role="user",
                content=chat_message.message
            ).dict()
        )

        message = client.messages.create(
            model="claude-3-opus-20240229",
            max_tokens=1000,
            system=SYSTEM_PROMPT,
            messages=[{ "role": "user", "content": chat_message.message }]
        )

        assistant_reply = message.content[0].text

        # Save assistant response
        await chat_history_collection.insert_one(
            ChatHistoryEntry(
                user_id=user_id,
                role="assistant",
                content=assistant_reply
            ).dict()
        )

        return {"message": assistant_reply}
    except Exception as e:
        logger.error(f"Error: {e}")
        raise HTTPException(status_code=500, detail=f"Chat failed: {e}")