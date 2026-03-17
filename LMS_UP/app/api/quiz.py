from fastapi import APIRouter, HTTPException
from bson import ObjectId
from datetime import datetime

from app.models.quiz_schema import QuizGenerateRequest
from app.ai.quiz_generator import generate_mcqs_from_text
from app.db.mongodb import db

router = APIRouter()

@router.post("/generate")
def generate_quiz(request: QuizGenerateRequest):

    try:

        # Generate questions from AI
        questions = generate_mcqs_from_text(request.text)

        assessment = {
            "title": request.title,
            "topic": request.topic,
            "course": request.course_id,
            "teacher": request.teacher_id,
            "questions": questions,
            "duration": 60,
            "difficulty": "medium",
            "isPublished": True,
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow()
        }

        result = db.assessments.insert_one(assessment)

        return {
            "message": "AI Quiz Generated Successfully",
            "assessment_id": str(result.inserted_id)
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))