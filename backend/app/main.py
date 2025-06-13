from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import time
from app.routers import tasks, loads, calls, auth, stripe, chat, booked_loads, saved_loads, trip, voice_preferences, user
from pydantic import BaseModel
from twilio.rest import Client
import os
from dotenv import load_dotenv
import stripe as stripe_lib
from app.database import init_db

# Load environment variables from .env file
load_dotenv()

# Verify Stripe key on startup
stripe_key = os.getenv('STRIPE_SECRET_KEY')
if not stripe_key:
    raise ValueError("Missing STRIPE_SECRET_KEY environment variable")
print(f"\n[SERVER] Initializing Stripe with key starting with: {stripe_key[:10]}...")
try:
    stripe_lib.api_key = stripe_key.strip()
    # Test the key by making a simple API call
    stripe_lib.Price.list(limit=1)
    print("[SERVER] Stripe key verified successfully!")
except Exception as e:
    print(f"[SERVER] Error verifying Stripe key: {str(e)}")
    raise ValueError(f"Invalid Stripe key: {str(e)}")

app = FastAPI(title="SkyWaze API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Frontend URL
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# Middleware to log requests
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    
    # Log the request
    print(f"[SERVER] Request started: {request.method} {request.url.path}")
    
    # Process the request
    response = await call_next(request)
    
    # Calculate processing time
    process_time = time.time() - start_time
    print(f"[SERVER] Request completed: {request.method} {request.url.path} - Status: {response.status_code} - Took: {process_time:.2f}s")
    
    return response

# Include routers
app.include_router(tasks.router)
app.include_router(loads.router)
app.include_router(calls.router)
app.include_router(auth.router)
app.include_router(stripe.router)
app.include_router(chat.router)
app.include_router(booked_loads.router)
app.include_router(saved_loads.router)
app.include_router(trip.router)
app.include_router(voice_preferences.router)
app.include_router(user.router)

@app.get("/")
async def root():
    print("[SERVER] Root endpoint accessed")
    return {"message": "Welcome to SkyWaze API"}

# Test endpoint
@app.get("/test")
async def test_endpoint():
    return {"status": "ok", "message": "Backend is running"}

@app.on_event("startup")
async def startup_event():
    print("[SERVER] Initializing MongoDB connection and indexes...")
    try:
        await init_db()
        print("[SERVER] MongoDB initialized successfully!")
    except Exception as e:
        print(f"[SERVER] Error initializing MongoDB: {str(e)}")
        raise e 