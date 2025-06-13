import os
import requests
from dotenv import load_dotenv
import json
from typing import Optional, Dict
import hashlib
import subprocess
import tempfile

load_dotenv()

ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")
VOICE_ID = "21m00Tcm4TlvDq8ikWAM"  # Rachel voice ID - you can change this to any voice you prefer

# Simple in-memory cache for audio responses
audio_cache: Dict[str, bytes] = {}

def get_cache_key(text: str) -> str:
    """Generate a cache key for the given text"""
    return hashlib.md5(text.encode()).hexdigest()

def convert_to_ulaw(audio_data: bytes) -> bytes:
    """Convert audio to μ-law 8000 Hz format using ffmpeg"""
    try:
        # Check if ffmpeg is installed
        try:
            subprocess.run(['ffmpeg', '-version'], capture_output=True, check=True)
        except (subprocess.SubprocessError, FileNotFoundError):
            print("[DEBUG] ffmpeg not found, using original audio format")
            return audio_data

        # Create temporary files for input and output
        with tempfile.NamedTemporaryFile(suffix='.mp3', delete=False) as input_file, \
             tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as output_file:
            
            # Write input audio data
            input_file.write(audio_data)
            input_file.flush()
            
            # Convert to μ-law 8000 Hz using ffmpeg
            subprocess.run([
                'ffmpeg', '-y',
                '-i', input_file.name,
                '-ar', '8000',  # Set sample rate to 8000 Hz
                '-ac', '1',     # Set to mono
                '-acodec', 'pcm_mulaw',  # Use μ-law codec
                output_file.name
            ], check=True, capture_output=True)
            
            # Read the converted audio
            with open(output_file.name, 'rb') as f:
                converted_audio = f.read()
            
            # Clean up temporary files
            os.unlink(input_file.name)
            os.unlink(output_file.name)
            
            return converted_audio
    except Exception as e:
        print(f"[DEBUG] Error converting audio to μ-law: {str(e)}")
        return audio_data  # Return original audio if conversion fails

def text_to_speech(text: str) -> Optional[bytes]:
    """
    Convert text to speech using ElevenLabs API
    Returns the audio data as bytes in μ-law 8000 Hz format if possible, otherwise returns original format
    """
    if not text:
        print("[DEBUG] Empty text provided to text_to_speech")
        return None

    # Check cache first
    cache_key = get_cache_key(text)
    if cache_key in audio_cache:
        print(f"[DEBUG] Using cached audio for text: {text[:50]}...")
        return audio_cache[cache_key]

    if not ELEVENLABS_API_KEY:
        print("[DEBUG] ElevenLabs API key not found")
        return None

    url = f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}"
    
    headers = {
        "Accept": "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": ELEVENLABS_API_KEY
    }
    
    data = {
        "text": text,
        "model_id": "eleven_monolingual_v1",
        "voice_settings": {
            "stability": 0.5,
            "similarity_boost": 0.5
        }
    }
    
    try:
        print(f"[DEBUG] Sending request to ElevenLabs API for text: {text[:50]}...")
        response = requests.post(url, json=data, headers=headers)
        
        if response.status_code == 200:
            audio_data = response.content
            print(f"[DEBUG] Received audio data of length: {len(audio_data)} bytes")
            
            # Convert to μ-law 8000 Hz if possible
            converted_audio = convert_to_ulaw(audio_data)
            print(f"[DEBUG] Converted audio data length: {len(converted_audio)} bytes")
            
            # Cache the converted response
            audio_cache[cache_key] = converted_audio
            print("[DEBUG] Successfully generated and cached audio")
            return converted_audio
        else:
            print(f"[DEBUG] Error in text-to-speech conversion: {response.status_code}")
            print(f"[DEBUG] Response: {response.text}")
            return None
    except Exception as e:
        print(f"[DEBUG] Exception in text_to_speech: {str(e)}")
        print(f"[DEBUG] Error type: {type(e)}")
        import traceback
        print(f"[DEBUG] Traceback: {traceback.format_exc()}")
        return None

def clear_cache():
    """Clear the audio cache"""
    audio_cache.clear()
    print("[DEBUG] Audio cache cleared") 