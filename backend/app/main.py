from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import time
import os
from dotenv import load_dotenv
import stripe as stripe_lib
from pydantic import BaseModel
from twilio.rest import Client

from app.routers import (
    tasks, loads, calls, auth, stripe, chat,
    booked_loads, saved_loads, trip, voice_preferences, user
)
from app.database import init_db

# Load environment variables
load_dotenv()

# Validate Stripe secret key
stripe_key = os.getenv('STRIPE_SECRET_KEY')
if not stripe_key:
    raise ValueError("Missing STRIPE_SECRET_KEY environment variable")

print(f"\n[SERVER] Initializing Stripe with key: {stripe_key[:10]}...")
try:
    stripe_lib.api_key = stripe_key.strip()
    stripe_lib.Price.list(limit=1)  # validate key
    print("[SERVER] Stripe key verified successfully!")
except Exception as e:
    print(f"[SERVER] Error verifying Stripe key: {str(e)}")
    raise ValueError(f"Invalid Stripe key: {str(e)}")

# Instantiate FastAPI app
app = FastAPI(title="SkyWaze API")

# ✅ CORS setup — MUST be correct for frontend/backend to talk
origins = [
    "https://production-zeta-eight.vercel.app",  # your Vercel frontend
    "http://localhost:3000",                     # local dev frontend
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Logging requests
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    print(f"[SERVER] Request: {request.method} {request.url.path}")
    response = await call_next(request)
    duration = time.time() - start_time
    print(f"[SERVER] Done: {request.method} {request.url.path} - {response.status_code} in {duration:.2f}s")
    return response

# Mount routers
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

# Root route
@app.get("/")
async def root():
    return {"message": "Welcome to SkyWaze API"}

# Health check endpoint
@app.get("/test")
async def test():
    return {"status": "ok", "message": "Backend is running"}

# MongoDB init
@app.on_event("startup")
async def startup_event():
    print("[SERVER] Initializing MongoDB...")
    try:
        await init_db()
        print("[SERVER] MongoDB connection successful.")
    except Exception as e:
        print(f"[SERVER] MongoDB init error: {str(e)}")
        raise e
