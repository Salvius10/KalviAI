from openai import OpenAI
import os
from dotenv import load_dotenv
import json

load_dotenv()

client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=os.getenv("OPENROUTER_API_KEY")
)

def generate_mcqs_from_text(text: str, num_questions: int = 5):

    prompt = f"""
Generate {num_questions} MCQ questions from the following study material.

Return ONLY JSON in this format:

[
  {{
    "questionText": "Question here",
    "type": "mcq",
    "options": ["A", "B", "C", "D"],
    "correctAnswer": "A",
    "marks": 1
  }}
]

Study Material:
{text[:3000]}
"""

    response = client.chat.completions.create(
        model="openai/gpt-3.5-turbo",
        messages=[
            {"role": "user", "content": prompt}
        ],
        temperature=0.3
    )

    content = response.choices[0].message.content

    return json.loads(content)