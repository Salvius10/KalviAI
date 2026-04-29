from fastapi import APIRouter, UploadFile, File
from pathlib import Path
from app.pdf.extractor import extract_text
from app.ai.quiz_generator import generate_mcqs_from_text

router = APIRouter()

PDF_DIR = Path("data/pdfs")
PDF_DIR.mkdir(parents=True, exist_ok=True)

@router.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):
    """
    Teacher uploads a study material PDF
    """
    file_path = PDF_DIR / file.filename

    # Save PDF
    with open(file_path, "wb") as f:
        f.write(await file.read())

    # Extract text
    extracted_text = extract_text(str(file_path))
    quiz = generate_mcqs_from_text(extracted_text[:4000])

    if not extracted_text:
        return {
            "error": "No readable text found in PDF"
        }

    return {
    "message": "PDF uploaded successfully",
    "file_name": file.filename,
    "quiz": quiz
}