from PyPDF2 import PdfReader

def extract_text(pdf_path: str) -> str:
    """
    Extract text from a PDF file
    """
    reader = PdfReader(pdf_path)
    full_text = ""

    for page in reader.pages:
        text = page.extract_text()
        if text:
            full_text += text + "\n"

    return full_text.strip()