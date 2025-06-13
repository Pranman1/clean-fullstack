from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import MongoClient
import os
from dotenv import load_dotenv
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime

load_dotenv()

MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DATABASE_NAME = "skywaze"

# Async client for FastAPI
async_client = AsyncIOMotorClient(MONGODB_URL)
async_db = async_client[DATABASE_NAME]

# Collections
booked_loads_collection = async_db["booked_loads"]
saved_loads_collection = async_db["saved_loads"]
user_profiles_collection = async_db["user_profiles"]
voice_preferences_collection = async_db["voice_preferences"]
chat_history_collection = async_db["chat_history"]

# Create indexes
async def init_db():
    # Create indexes for booked loads
    await booked_loads_collection.create_index("id", unique=True)
    await booked_loads_collection.create_index("booking_date")
    
    # Create indexes for saved loads
    await saved_loads_collection.create_index("entry_id", unique=True)
    await saved_loads_collection.create_index("save_date")
    
    # Create indexes for user profiles
    await user_profiles_collection.create_index("email", unique=True)
    await user_profiles_collection.create_index("google_id", unique=True, sparse=True)
    
    # Create indexes for voice preferences
    await voice_preferences_collection.create_index("user_id", unique=True)

    # Create indexes for chat history
    await chat_history_collection.create_index([("user_id", 1), ("timestamp", 1)])
    await chat_history_collection.create_index("timestamp")
    
# Database models (using Pydantic for validation)
class UserProfile(BaseModel):
    email: str
    name: str
    picture: Optional[str] = None
    google_id: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    company_name: Optional[str] = None
    phone_number: Optional[str] = None
    mc_number: Optional[str] = None
    dot_number: Optional[str] = None
    truckstop_integration_id: Optional[str] = None

class SavedLoad(BaseModel):
    entry_id: str
    origin_city: str
    origin_state: str
    destination_city: str
    destination_state: str
    distance: Optional[float] = None
    pay_rate: Optional[float] = None
    rate_per_mile_est: Optional[float] = None
    weight: Optional[float] = None
    equipment_type: Optional[str] = None
    other_trailer_types: Optional[str] = None
    ship_date: Optional[str] = None
    save_date: datetime = Field(default_factory=datetime.utcnow)
    data_source: str = "direct_freight"
    green_light: bool = False
    full_load: bool = True
    dead_head: Optional[float] = None
    receive_date: Optional[str] = None
    saved_by: str  # user email
    phone_number: Optional[str] = None
    is_pair: Optional[bool] = None
    child: Optional[Dict[str, Any]] = None

class BookedLoad(BaseModel):
    id: int
    origin_city: str
    origin_state: str
    destination_city: str
    destination_state: str
    distance: Optional[float] = None
    pay_rate: Optional[float] = None
    rate_per_mile_est: Optional[float] = None
    weight: Optional[float] = None
    equipment_type: Optional[str] = None
    other_trailer_types: Optional[str] = None
    ship_date: Optional[str] = None
    booking_date: datetime = Field(default_factory=datetime.utcnow)
    data_source: str = "direct_freight"
    green_light: bool = False
    full_load: bool = True
    dead_head: Optional[float] = None
    receive_date: Optional[str] = None
    booked_by: str  # user email
    status: str = "booked"  # booked, in_transit, completed, cancelled

class VoicePreferences(BaseModel):
    """Voice agent preferences for automated load notifications"""
    user_id: str
    is_active: bool = False
    phone_number: str
    truck_type: str
    origin_city: str
    origin_state: str
    min_rate_per_mile: float = 0.0
    max_deadhead: int = 0
    last_notification: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow) 

class ChatHistoryEntry(BaseModel):
    user_id: str  # You can use email or session ID
    role: str     # 'user' or 'assistant'
    content: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)