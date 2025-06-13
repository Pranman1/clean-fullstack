from app.main import app

# Optional: just to prove it's loading
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
