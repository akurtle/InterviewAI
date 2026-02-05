import tempfile
import pdfplumber
from docx import Document
import io
import re
from typing import Dict, Any
import spacy
from pyresparser import ResumeParser as PyResumeParser
import nltk

import os

class ResumeParser:
    def __init__(self):
        # Load spaCy model
        try:
            self.nlp = spacy.load("en_core_web_sm")
            
        except:
            print("Downloading spaCy model...")
            import os
            os.system("python -m spacy download en_core_web_sm")
            self.nlp = spacy.load("en_core_web_sm")
    
    def parse(self, file_content: bytes, filename: str, filepath:str) -> Dict[str, Any]:
        """
        Main parsing method
        """
        # Extract text
        # text = self._extract_text(file_content, filename)
        
        # # Parse information
        # parsed_data = {
        #     "name": self._extract_name(text),
        #     "email": self._extract_email(text),
        #     "phone": self._extract_phone(text),
        #     "skills": self._extract_skills(text),
        #     "education": self._extract_education(text),
        #     "experience": self._extract_experience(text),
        # }
        
        # return parsed_data

        suffix = os.path.splitext(filename)[1].lower()  # ".pdf" or ".docx"

        # pyresparser usage is based on a file path [web:114]
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(file_content)
            tmp_path = tmp.name

        print("here")
        try:
            data = PyResumeParser(tmp_path).get_extracted_data()
            print(data)
            return data or {}
        finally:
            try:
                os.remove(tmp_path)
            except OSError:
                pass
    
    def _extract_text(self, file_content: bytes, filename: str) -> str:
        """
        Extract text from PDF or DOCX
        """
        text = ""

        data = PyResumeParser(filename).get_extracted_data()


        print(data)
        
        if filename.lower().endswith('.pdf'):
            with pdfplumber.open(io.BytesIO(file_content)) as pdf:
                for page in pdf.pages:
                    text += page.extract_text() or ""
        
        elif filename.lower().endswith('.docx'):
            doc = Document(io.BytesIO(file_content))
            text = "\n".join([para.text for para in doc.paragraphs])
        
        return text
    
    def _extract_name(self, text: str) -> str:
        """
        Extract name using NLP
        """
        doc = self.nlp(text[:500])  # Check first 500 chars
        for ent in doc.ents:
            if ent.label_ == "PERSON":
                return ent.text
        
        # Fallback: first line
        lines = text.split('\n')
        return lines[0].strip() if lines else None
    
    def _extract_email(self, text: str) -> str:
        """
        Extract email using regex
        """
        email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
        matches = re.findall(email_pattern, text)
        return matches[0] if matches else None
    
    def _extract_phone(self, text: str) -> str:
        """
        Extract phone number
        """
        phone_pattern = r'[\+\(]?[1-9][0-9 .\-\(\)]{8,}[0-9]'
        matches = re.findall(phone_pattern, text)
        return matches[0] if matches else None
    
    def _extract_skills(self, text: str) -> list:
        """
        Extract skills (basic implementation)
        """
        # Common skills to look for
        common_skills = [
            'python', 'java', 'javascript', 'c++', 'sql', 'react', 'angular',
            'node.js', 'fastapi', 'django', 'flask', 'mongodb', 'postgresql',
            'aws', 'azure', 'docker', 'kubernetes', 'git', 'machine learning',
            'data analysis', 'project management'
        ]
        
        text_lower = text.lower()
        found_skills = [skill for skill in common_skills if skill in text_lower]
        
        return found_skills
    
    def _extract_education(self, text: str) -> list:
        """
        Extract education information
        """
        education = []
        degree_patterns = [
            r'(bachelor|master|phd|b\.tech|m\.tech|mba|b\.sc|m\.sc)',
            r'(engineering|computer science|business administration)'
        ]
        
        for pattern in degree_patterns:
            matches = re.finditer(pattern, text, re.IGNORECASE)
            for match in matches:
                context = text[max(0, match.start()-50):min(len(text), match.end()+50)]
                education.append({"degree": match.group(), "context": context})
        
        return education[:3]  # Limit to 3 entries
    
    def _extract_experience(self, text: str) -> list:
        """
        Extract work experience
        """
        experience = []
        # Look for year patterns
        year_pattern = r'(20\d{2}|19\d{2})'
        years = re.findall(year_pattern, text)
        
        if years:
            experience.append({
                "years_found": list(set(years)),
                "note": "Full experience parsing requires more sophisticated NLP"
            })
        
        return experience

    
    # def _extract_companies(self, text: str) -> list:

    #     """
    #     Extracting companies
    #     """
    #     companies = []

    #     doc = self.
