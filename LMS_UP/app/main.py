from fastapi import FastAPI
from app.api.pdf import router as pdf_router
from app.api.quiz import router as quiz_router

app = FastAPI(title="AI LMS – Quiz Engine")

app.include_router(pdf_router, prefix="/pdf", tags=["PDF"])
app.include_router(quiz_router, prefix="/quiz", tags=["Quiz"])

@app.get("/")
def root():
    return {"status": "AI LMS backend running"}