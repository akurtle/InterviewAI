import pdfplumber
from docx import Document
import io
import json
import re
from typing import Dict, Any, Optional
import spacy

from .resume_parser_helpers.helper_functions import ResumeParserHelpers as RPH

import os

class ResumeParser:
    def __init__(self):
        # Load spaCy model

        self.parser = RPH()

        try:
            self.nlp = spacy.load("en_core_web_sm")
            
        except:
            print("Downloading spaCy model...")
            os.system("python -m spacy download en_core_web_sm")
            self.nlp = spacy.load("en_core_web_sm")

        self._section_headings = self.parser._load_section_headings()
        self._month_pattern = (
            r"(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|"
            r"Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|"
            r"Dec(?:ember)?)"
        )
        self._date_range_re = re.compile(
            rf"(?P<range>{self._month_pattern}\s+\d{{4}}\s*[-–—]\s*"
            rf"(?:Present|Current|{self._month_pattern}\s+\d{{4}}))",
            re.IGNORECASE,
        )
        self._year_range_re = re.compile(
            r"(?P<range>(?:19|20)\d{2}\s*[-–—]\s*(?:Present|Current|(?:19|20)\d{2}))",
            re.IGNORECASE,
        )
    
    def parse(self, file_content: bytes, filename: str, filepath: Optional[str] = None) -> Dict[str, Any]:
        """
        Main parsing method
        """
        text = self._extract_text(file_content, filename)
        sections = self._extract_sections(text)

        skills_lines = sections.get("skills", [])
        skills = self.parser._parse_skills_lines(skills_lines) if skills_lines else self._extract_skills(text)

        education_lines = sections.get("education", [])
        if education_lines:
            education = [{"text": line} for line in education_lines]
        else:
            education = self._extract_education(text)

        experience_lines = sections.get("experience", [])
        if experience_lines:
            experience = self.parser._parse_experience_entries(experience_lines)
            if not experience:
                experience = [{"text": line} for line in experience_lines]
        else:
            experience = self._extract_experience(text)

        parsed_data = {
            "name": self._extract_name(text),
            "email": self._extract_email(text),
            "phone": self._extract_phone(text),
            "skills": skills,
            "education": education,
            "experience": experience,
        }

        return parsed_data
    
    def _extract_text(self, file_content: bytes, filename: str) -> str:
        """
        Extract text from PDF or DOCX
        """
        text = ""

        if filename.lower().endswith('.pdf'):
            with pdfplumber.open(io.BytesIO(file_content)) as pdf:
                for page in pdf.pages:
                    text += page.extract_text() or ""
        
        elif filename.lower().endswith('.docx'):
            doc = Document(io.BytesIO(file_content))
            text = "\n".join([para.text for para in doc.paragraphs])
        
        return text

    def _extract_sections(self, text: str) -> Dict[str, list]:
        """
        Extract section blocks (e.g., Skills, Experience, Education) based on headings.
        Returns a dict of section -> list of lines.
        """
        normalized_map = {}
        for key, values in self._section_headings.items():
            normalized_map[key] = set(self.parser._normalize_heading(v) for v in values)

        sections: Dict[str, list] = {}
        current_section = None

        for raw_line in text.splitlines():
            line = raw_line.strip()
            if not line:
                continue

            # Handle "Heading: content" in one line
            if ":" in line:
                head, rest = line.split(":", 1)
                section_key = self.parser._match_heading(head, normalized_map)
                if section_key:
                    current_section = section_key
                    sections.setdefault(current_section, [])
                    for part in self._explode_line(rest):
                        sections[current_section].append(part)
                    continue

            section_key = self.parser._match_heading(line, normalized_map)
            if section_key:
                current_section = section_key
                sections.setdefault(current_section, [])
                continue

            if current_section:
                for part in self._explode_line(line):
                    sections[current_section].append(part)

        return sections


    def _explode_line(self, line: str) -> list:
        line = line.strip()
        if not line:
            return []
        # If the line starts with a bullet, keep the remainder as one item
        if re.match(r'^\s*[-*\u2022]\s+', line):
            return [re.sub(r'^\s*[-*\u2022]\s+', '', line).strip()]
        # Split on middle dots or bullets between items
        if re.search(r'\s[\u2022\u00b7]\s', line):
            return [p.strip() for p in re.split(r'\s[\u2022\u00b7]\s', line) if p.strip()]
        # Split on pipe-separated skills
        if " | " in line:
            return [p.strip() for p in line.split(" | ") if p.strip()]
        return [line]
    
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
        sections = self._extract_sections(text)
        skills_lines = sections.get("skills", [])
        if skills_lines:
            parsed = self.parser._parse_skills_lines(skills_lines)
            if parsed:
                return parsed

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
