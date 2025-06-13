from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class CallRequest(BaseModel):
    """Request model for initiating a phone call"""
    phone_number: str
    message: Optional[str] = "Hello, this is your AI assistant calling from SkyWaze. How can I help you with load searches today?"
    callback_url: Optional[str] = None

class CallResponse(BaseModel):
    """Response model for initiated calls"""
    call_sid: str
    status: str
    phone_number: str
    message: str
    timestamp: str

class WebhookRequest(BaseModel):
    """Request model for Twilio webhook handling"""
    CallSid: Optional[str] = None
    From: Optional[str] = None
    To: Optional[str] = None
    CallStatus: Optional[str] = None
    SpeechResult: Optional[str] = None

class AIResponse(BaseModel):
    """Response model for AI-generated content"""
    message: str
    loads: Optional[List] = None
    next_action: Optional[str] = None 