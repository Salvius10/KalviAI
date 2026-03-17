from pydantic import BaseModel

class QuizGenerateRequest(BaseModel):
    title: str
    topic: str
    course_id: str
    teacher_id: str
    text: str