from fastapi import UploadFile

ALLOWED_EXTENSIONS = {'.pdf', '.docx'}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

def validate_file(file: UploadFile) -> bool:
    """
    Validate uploaded file
    """
    if not file.filename:
        return False
    
    # Check extension
    file_ext = '.' + file.filename.split('.')[-1].lower()
    return file_ext in ALLOWED_EXTENSIONS

def save_upload_file(upload_file: UploadFile, destination: str) -> str:
    """
    Save uploaded file to disk (optional)
    """
    with open(destination, "wb") as buffer:
        buffer.write(upload_file.file.read())
    return destination
