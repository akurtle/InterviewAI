from pydantic import BaseModel, EmailStr
from typing import List, Optional

class ResumeData(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    skills: Optional[List[str]] = []
    education: Optional[List[dict]] = []
    experience: Optional[List[dict]] = []
    total_experience: Optional[str] = None
    
class ParseResponse(BaseModel):
    success: bool
    filename: str
    data: Optional[ResumeData] = None
    error: Optional[str] = None
