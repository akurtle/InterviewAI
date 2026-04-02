from __future__ import annotations

from typing import List

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.models import ParseResponse
from app.parsers.resume_parser import ResumeParser
from app.utils.file_handler import validate_file


router = APIRouter(tags=["resumes"])
resume_parser = ResumeParser()


@router.post("/parse-resume/", response_model=ParseResponse)
async def parse_resume(file: UploadFile = File(...), filePath: str = Form(...)):
    """
    Parse a resume file (PDF or DOCX) and extract structured information.
    """

    print(filePath)
    if not validate_file(file):
        raise HTTPException(
            status_code=400,
            detail="Invalid file format. Only PDF and DOCX are supported.",
        )

    try:
        contents = await file.read()
        parsed_data = resume_parser.parse(contents, file.filename, "")
        print("data read")
        return ParseResponse(
            success=True,
            filename=file.filename,
            data=parsed_data,
        )
    except Exception as exc:
        print("why?")
        raise HTTPException(
            status_code=500,
            detail=f"Error parsing resume: {str(exc)}",
        ) from exc
    finally:
        await file.close()


@router.post("/parse-resumes-batch/", response_model=List[ParseResponse])
async def parse_resumes_batch(files: List[UploadFile] = File(...)):
    """
    Parse multiple resume files in batch.
    """

    results = []

    for file in files:
        try:
            if not validate_file(file):
                results.append(
                    ParseResponse(
                        success=False,
                        filename=file.filename,
                        error="Invalid file format",
                    )
                )
                continue

            contents = await file.read()
            parsed_data = resume_parser.parse(contents, file.filename)

            results.append(
                ParseResponse(
                    success=True,
                    filename=file.filename,
                    data=parsed_data,
                )
            )
        except Exception as exc:
            results.append(
                ParseResponse(
                    success=False,
                    filename=file.filename,
                    error=str(exc),
                )
            )
        finally:
            await file.close()

    return results
