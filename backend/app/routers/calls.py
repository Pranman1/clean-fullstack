from fastapi import APIRouter, HTTPException, Request, Form, Header
from fastapi.responses import Response, PlainTextResponse, StreamingResponse
from typing import Dict, Optional
import os
from datetime import datetime
import json
from pydantic import BaseModel
from twilio.rest import Client
from twilio.twiml.voice_response import VoiceResponse, Gather, Connect, Stream
from ..agent import DispatchAgent
from ..services.voice_service import text_to_speech
from dotenv import load_dotenv
import io
import subprocess

print("\n[DEBUG] ===== Loading calls.py router =====")
load_dotenv()
print("[DEBUG] Environment variables loaded in calls.py")

router = APIRouter(prefix="/calls", tags=["calls"])

class CallRequest(BaseModel):
    phone_number: str
    message: Optional[str] = None

def get_twilio_client():
    print("\n[DEBUG] ===== Getting Twilio client =====")
    account_sid = os.getenv('TWILIO_ACCOUNT_SID')
    auth_token = os.getenv('TWILIO_AUTH_TOKEN')
    print(f"[DEBUG] Twilio credentials loaded - SID: {account_sid[:4]}...{account_sid[-4:] if account_sid else 'None'}")
    if not account_sid or not auth_token:
        raise ValueError("Missing required Twilio credentials")
    return Client(account_sid, auth_token)

active_calls = {}
CALL_HISTORY = []

@router.get("/test-config")
async def test_twilio_config():
    """Tests if Twilio is properly configured"""
    print("\n[DEBUG] ===== Testing Twilio config =====")
    account_sid = os.getenv("TWILIO_ACCOUNT_SID")
    auth_token = os.getenv("TWILIO_AUTH_TOKEN")
    phone_number = os.getenv("TWILIO_PHONE_NUMBER")
    ngrok_url = os.getenv("NGROK_URL")
    elevenlabs_key = os.getenv("ELEVENLABS_API_KEY")
    
    print(f"[DEBUG] Account SID: {account_sid[:4]}...{account_sid[-4:] if account_sid else 'None'}")
    print(f"[DEBUG] Phone number: {phone_number}")
    print(f"[DEBUG] Ngrok URL: {ngrok_url}")
    print(f"[DEBUG] ElevenLabs API key configured: {bool(elevenlabs_key)}")
    
    config_status = {
        "twilio_account_configured": bool(account_sid and auth_token),
        "twilio_phone_configured": bool(phone_number),
        "ngrok_configured": bool(ngrok_url),
        "elevenlabs_configured": bool(elevenlabs_key),
        "account_sid_masked": f"{account_sid[:4]}...{account_sid[-4:]}" if account_sid else None,
        "phone_number": phone_number,
        "ngrok_url": ngrok_url,
    }
    print(f"[DEBUG] Config status: {config_status}")
    return config_status

@router.post("/initiate")
async def initiate_call(request: CallRequest, authorization: Optional[str] = Header(None)):
    """Initiate a call to the specified phone number."""
    try:
        print("\n[DEBUG] ===== Starting call initiation =====")
        print(f"[DEBUG] Request body: {request}")
        
        client = get_twilio_client()
        twilio_phone = os.getenv('TWILIO_PHONE_NUMBER')
        ngrok_url = os.getenv('NGROK_URL')
        print(f"[DEBUG] Using Twilio phone: {twilio_phone}")
        print(f"[DEBUG] Using NGROK URL: {ngrok_url}")
        
        if not twilio_phone:
            raise ValueError("Missing Twilio phone number")

        if not request.phone_number.startswith('+'):
            request.phone_number = '+1' + request.phone_number.replace('-', '').replace('(', '').replace(')', '').replace(' ', '')
        
        print(f"[DEBUG] Formatted phone number: {request.phone_number}")
        print(f"[DEBUG] Initiating call from {twilio_phone} to {request.phone_number}")
        print(f"[DEBUG] Webhook URL will be: {ngrok_url}/calls/answer")
        
        call = client.calls.create(
            to=request.phone_number,
            from_=twilio_phone,
            url=f"{ngrok_url}/calls/answer",
            method='POST'
        )
        
        print(f"[DEBUG] Call created successfully with SID: {call.sid}")
        # Create agent with auth token
        auth_token = authorization.replace('Bearer ', '') if authorization else None
        active_calls[call.sid] = DispatchAgent(auth_token=auth_token)
        print(f"[DEBUG] Agent created for call {call.sid}")
        print(f"[DEBUG] Active calls: {list(active_calls.keys())}")
        
        return {"status": "success", "call_sid": call.sid}
    except Exception as e:
        print(f"[DEBUG] Error in initiate_call: {str(e)}")
        print(f"[DEBUG] Error type: {type(e)}")
        import traceback
        print(f"[DEBUG] Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/answer", response_model=str)
async def answer_call(request: Request):
    print("[DEBUG] Received answer webhook")
    try:
        form_data = await request.form()
        speech_result = form_data.get("SpeechResult", "")
        call_sid = form_data.get("CallSid", "")
        
        print(f"[DEBUG] Speech result: {speech_result}")
        print(f"[DEBUG] Call SID: {call_sid}")
        
        response = VoiceResponse()
        
        # Get or create agent for this call
        agent = active_calls.get(call_sid)
        if not agent:
            print("[DEBUG] Creating new agent for call")
            agent = DispatchAgent()
            active_calls[call_sid] = agent
        
        if not speech_result:
            print("[DEBUG] No speech result, sending initial greeting")
            greeting = "Hey there, you've reached Cinesis — this is Skye. What are you hauling and where are you headed?"
            
            # Try ElevenLabs first
            audio_data = text_to_speech(greeting)
            if audio_data:
                # Create a Stream with the audio data
                stream = Stream(url=f"{os.getenv('NGROK_URL')}/calls/stream/{call_sid}")
                response.append(stream)
            else:
                # Fallback to Polly
                print("[DEBUG] Falling back to Polly for initial greeting")
                response.say(greeting, voice="Polly.Matthew-Neural")
            
            # Set up next interaction
            gather = Gather(
                input="speech",
                action="/calls/answer",
                method="POST",
                timeout=3,
                barge_in=True,
                speech_timeout="auto"
            )
            response.append(gather)
            print("[DEBUG] Initial greeting TwiML created")
            return Response(content=str(response), media_type="text/xml")
        
        print(f"[DEBUG] Processing speech input: {speech_result}")
        ai_response = await agent.process_input(speech_result, call_sid)
        print(f"[DEBUG] AI response received: {ai_response}")
        
        if "*typing*" in ai_response:
            print("[DEBUG] Adding typing sound to response")
            response.play("https://pumpkin-heron-5238.twil.io/assets/yt1z.net%20-%20Keyboard%20typing%20sound%20effect%20(no%20copyright%20free%20to%20use)%20(320%20KBps).mp3")
            ai_response = ai_response.replace("*typing*", "")
        
        # Try ElevenLabs first
        audio_data = text_to_speech(ai_response)
        if audio_data:
            # Create a Stream with the audio data
            stream = Stream(url=f"{os.getenv('NGROK_URL')}/calls/stream/{call_sid}")
            response.append(stream)
        else:
            # Fallback to Polly
            print("[DEBUG] Falling back to Polly for response")
            response.say(ai_response, voice="Polly.Matthew-Neural")
        
        # Set up next interaction
        gather = Gather(
            input="speech",
            action="/calls/answer",
            method="POST",
            timeout=3,
            barge_in=True,
            speech_timeout="auto"
        )
        response.append(gather)
        
        final_twiml = str(response)
        print(f"[DEBUG] Final TwiML response: {final_twiml}")
        return Response(content=final_twiml, media_type="text/xml")
        
    except Exception as e:
        print(f"[DEBUG] Error in answer_call: {str(e)}")
        print(f"[DEBUG] Error type: {type(e)}")
        import traceback
        print(f"[DEBUG] Traceback: {traceback.format_exc()}")
        error_response = VoiceResponse()
        error_response.say(
            "I apologize, but I'm experiencing technical difficulties. Please try again later.",
            voice="Polly.Matthew-Neural"  # Fallback to Polly if ElevenLabs fails
        )
        return Response(content=str(error_response), media_type="text/xml")

@router.get("/stream/{call_sid}")
async def stream_audio(call_sid: str):
    """Stream audio data for Twilio to play"""
    try:
        print(f"[DEBUG] Streaming audio for call {call_sid}")
        # Get the audio data from ElevenLabs
        audio_data = text_to_speech("Loading...")  # This is just a placeholder
        if not audio_data:
            print("[DEBUG] No audio data generated")
            raise HTTPException(status_code=500, detail="Failed to generate audio")
        
        print(f"[DEBUG] Audio data length: {len(audio_data)} bytes")
        
        # Try to determine if the audio is in μ-law format
        is_mulaw = False
        try:
            # Check if ffmpeg is installed and working
            subprocess.run(['ffmpeg', '-version'], capture_output=True, check=True)
            is_mulaw = True
            print("[DEBUG] ffmpeg found, using μ-law format")
        except (subprocess.SubprocessError, FileNotFoundError):
            is_mulaw = False
            print("[DEBUG] ffmpeg not found, using MP3 format")
        
        # Create a BytesIO object with the audio data
        audio_stream = io.BytesIO(audio_data)
        audio_stream.seek(0)  # Ensure we're at the start of the stream
        
        # Set appropriate headers
        headers = {
            'Content-Type': 'audio/x-mulaw;rate=8000' if is_mulaw else 'audio/mpeg',
            'Content-Length': str(len(audio_data))
        }
        
        print(f"[DEBUG] Streaming audio with headers: {headers}")
        return StreamingResponse(
            audio_stream,
            media_type=headers['Content-Type'],
            headers=headers
        )
    except Exception as e:
        print(f"[DEBUG] Error streaming audio for call {call_sid}: {str(e)}")
        print(f"[DEBUG] Error type: {type(e)}")
        import traceback
        print(f"[DEBUG] Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=404, detail="Audio not found")

@router.post("/status")
async def call_status(request: Request):
    """Handle call status updates."""
    try:
        print("\n[DEBUG] ===== Handling call status update =====")
        form_data = await request.form()
        call_sid = form_data.get("CallSid")
        call_status = form_data.get("CallStatus")
        print(f"[DEBUG] Call status update - SID: {call_sid}, Status: {call_status}")
        print(f"[DEBUG] Full status data: {dict(form_data)}")
        
        if call_status in ["completed", "failed", "busy", "no-answer", "canceled"]:
            if call_sid in active_calls:
                print(f"[DEBUG] Cleaning up agent for call {call_sid}")
                del active_calls[call_sid]
        
        return {"status": "success"}
    except Exception as e:
        print(f"[DEBUG] Error in call_status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/history", response_model=list)
async def get_call_history():
    return CALL_HISTORY 