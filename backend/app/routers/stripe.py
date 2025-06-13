from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel
import stripe
import os
from dotenv import load_dotenv
from .auth import get_current_user

load_dotenv()

router = APIRouter(prefix="/stripe", tags=["stripe"])

# Initialize Stripe with your secret key
stripe_key = os.getenv('STRIPE_SECRET_KEY')
if not stripe_key:
    raise ValueError("Missing STRIPE_SECRET_KEY environment variable")
print(f"Initializing Stripe with key starting with: {stripe_key[:10]}...")
stripe.api_key = stripe_key.strip()  # Remove any whitespace

class CheckoutSessionRequest(BaseModel):
    priceId: str
    customerEmail: str

@router.post("/create-checkout-session")
async def create_checkout_session(request: CheckoutSessionRequest, current_user = Depends(get_current_user)):
    try:
        print(f"Creating checkout session for email: {request.customerEmail}")
        print(f"Using price ID: {request.priceId}")
        print(f"Using Stripe key starting with: {stripe.api_key[:10]}...")
        
        # Create a checkout session with Stripe
        checkout_session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{
                'price': request.priceId,
                'quantity': 1,
            }],
            mode='subscription',
            success_url=f"{os.getenv('FRONTEND_URL')}/subscription-success",
            cancel_url=f"{os.getenv('FRONTEND_URL')}/pricing",
            customer_email=request.customerEmail,
        )
        
        print(f"Checkout session created: {checkout_session.id}")
        return {"url": checkout_session.url}
    except stripe.error.StripeError as e:
        print(f"Stripe error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"Error creating checkout session: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig_header = request.headers.get('stripe-signature')
    
    try:
        print("Received webhook")
        # Verify webhook signature and parse the event
        event = stripe.Webhook.construct_event(
            payload, sig_header, os.getenv('STRIPE_WEBHOOK_SECRET')
        )
        
        print(f"Webhook event type: {event.type}")

        # Handle the event
        if event.type == 'customer.subscription.created':
            subscription = event.data.object
            print(f"Subscription created: {subscription.id}")
            # TODO: Update user's subscription status in database
        elif event.type == 'customer.subscription.updated':
            subscription = event.data.object
            print(f"Subscription updated: {subscription.id}")
            # TODO: Update user's subscription status in database
        elif event.type == 'customer.subscription.deleted':
            subscription = event.data.object
            print(f"Subscription cancelled: {subscription.id}")
            # TODO: Update user's subscription status in database

        return {"status": "success"}
    except Exception as e:
        print(f"Webhook error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/prices")
async def get_prices():
    try:
        prices = stripe.Price.list(
            active=True,
            type='recurring',
            expand=['data.product']
        )
        return prices.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) 