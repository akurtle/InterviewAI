import shutil
from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from typing import List
import os,tempfile
from app.parsers.resume_parser import ResumeParser
from app.models import ResumeData, ParseResponse
from app.utils.file_handler import save_upload_file, validate_file

app = FastAPI(
    title="Resume Parser API",
    description="API for parsing resumes and extracting structured data",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize parser
resume_parser = ResumeParser()

@app.get("/")
async def root():
    return {"message": "Resume Parser API", "status": "active"}

@app.post("/parse-resume/", response_model=ParseResponse)
async def parse_resume(file: UploadFile = File(...),filePath: str = Form(...)  ):
    """
    Parse a resume file (PDF or DOCX) and extract structured information
    """

    print(filePath)
    # Validate file
    if not validate_file(file):
        raise HTTPException(status_code=400, detail="Invalid file format. Only PDF and DOCX are supported.")
    
    try:
        # Read file content
        contents = await file.read()
        # print("here",filePath)
        # suffix = os.path.splitext(file.filename)[1].lower()
        # tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
        # tmp_path = tmp.name
        # tmp.close()

        # print("here2")
        
        # with open(tmp_path, "wb") as buffer:
        #     # Copying file data to the temporary file
        #     print("error")
        #     shutil.copyfileobj(file.file, buffer)

        # # The 'temp_path' is the path you can use
        # print(f"File saved at: {tmp_path}")
        # print(file.path)
        
        # Parse resume
        parsed_data = resume_parser.parse(contents, file.filename,"")
        
        print("data read")
        return ParseResponse(
            success=True,
            filename=file.filename,
            data=parsed_data
        )
    
    except Exception as e:
        print( 'why?')
        raise HTTPException(status_code=500, detail=f"Error parsing resume: {str(e)}")
    
    finally:
        await file.close()

@app.post("/parse-resumes-batch/", response_model=List[ParseResponse])
async def parse_resumes_batch(files: List[UploadFile] = File(...)):
    """
    Parse multiple resume files in batch
    """
    results = []
    
    for file in files:
        try:
            if not validate_file(file):
                results.append(ParseResponse(
                    success=False,
                    filename=file.filename,
                    error="Invalid file format"
                ))
                continue
            
            contents = await file.read()
            parsed_data = resume_parser.parse(contents, file.filename)
            
            results.append(ParseResponse(
                success=True,
                filename=file.filename,
                data=parsed_data
            ))
        
        except Exception as e:
            results.append(ParseResponse(
                success=False,
                filename=file.filename,
                error=str(e)
            ))
        
        finally:
            await file.close()
    
    return results

# Health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "healthy"}
