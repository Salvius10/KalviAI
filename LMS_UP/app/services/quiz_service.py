import json
from app.db.mongodb import quiz_collection
from datetime import datetime

def save_quiz(pdf_name: str, quiz_json: str):
    quiz_data = json.loads(quiz_json)

    quiz_document = {
        "pdf_name": pdf_name,
        "created_at": datetime.utcnow(),
        "questions": quiz_data
    }

    result = quiz_collection.insert_one(quiz_document)
    return str(result.inserted_id)