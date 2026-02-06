import json
import os
import re
from typing import Dict, Any, Optional

class ResumeParserHelpers:
    def _load_section_headings(self) -> Dict[str, list]:
        defaults = {
            "summary": [
                "summary", "professional summary", "profile", "objective"
            ],
            "skills": [
                "skills", "technical skills", "core competencies", "skills and tools",
                "skills & tools", "technologies", "tech stack"
            ],
            "experience": [
                "experience", "work experience", "professional experience", "employment",
                "employment history", "work history", "career history"
            ],
            "education": [
                "education", "academics", "academic background", "academic qualifications"
            ],
            "projects": [
                "projects", "project experience", "personal projects"
            ],
            "certifications": [
                "certifications", "certificates", "licenses"
            ],
            "awards": [
                "awards", "honors", "achievements", "accomplishments"
            ],
            "languages": [
                "languages", "language"
            ],
            "interests": [
                "interests", "hobbies"
            ],
        }

        override = self._read_heading_override()
        if not override:
            return defaults

        mode = os.getenv("RESUME_SECTION_HEADINGS_MODE", "merge").strip().lower()
        if mode == "replace":
            return override

        merged = {k: list(v) for k, v in defaults.items()}
        for key, values in override.items():
            if not isinstance(values, list):
                continue
            merged.setdefault(key, [])
            for item in values:
                if item not in merged[key]:
                    merged[key].append(item)
        return merged

    def _read_heading_override(self) -> Optional[Dict[str, list]]:
        raw_json = os.getenv("RESUME_SECTION_HEADINGS_JSON", "").strip()
        path = os.getenv("RESUME_SECTION_HEADINGS_PATH", "").strip()

        try:
            if raw_json:
                data = json.loads(raw_json)
                return data if isinstance(data, dict) else None
            if path and os.path.isfile(path):
                with open(path, "r", encoding="utf-8") as handle:
                    data = json.load(handle)
                return data if isinstance(data, dict) else None
        except Exception:
            return None
        return None

    def _parse_experience_entries(self, lines: list) -> list:
        """
        Convert experience section lines into structured entries.
        """
        normalized = self._normalize_experience_lines(lines)
        entries = []
        current = None

        for line in normalized:
            date_range, remainder = self._extract_date_range(line)
            if date_range:
                if current:
                    entries.append(current)
                title = remainder.strip(" -–—,:")
                current = {
                    "title": title or None,
                    "dates": date_range,
                    "company": None,
                    "location": None,
                    "details": [],
                }
                continue

            if not current:
                continue

            if current["company"] is None and self._looks_like_company_line(line):
                company, location = self._split_company_location(line)
                current["company"] = company
                current["location"] = location
                continue

            current["details"].append(line)

        if current:
            entries.append(current)

        return entries

    def _normalize_experience_lines(self, lines: list) -> list:
        expanded = []
        for line in lines:
            expanded.extend(self._split_line_on_date_range(line))
        expanded = [l.strip() for l in expanded if l and l.strip()]
        return self._merge_wrapped_lines(expanded)

    def _split_line_on_date_range(self, line: str) -> list:
        """
        If a date range appears mid-line, split it into separate lines.
        """
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
        match = self._date_range_re.search(line) or self._year_range_re.search(line)
        if not match:
            return [line]

        idx = match.start()
        pre = line[:idx].strip()
        post = line[idx:].strip()

        if "." in pre:
            last = pre.rfind(".")
            pre1 = pre[: last + 1].strip()
            pre2 = pre[last + 1 :].strip()
            out = []
            if pre1:
                out.append(pre1)
            if pre2:
                out.append(f"{pre2} {post}".strip())
            else:
                out.append(post)
            return out

        if pre and len(pre.split()) > 8:
            return [pre, post]

        return [line]

    def _merge_wrapped_lines(self, lines: list) -> list:
        merged = []
        for line in lines:
            if not merged:
                merged.append(line)
                continue

            prev = merged[-1]
            if prev.endswith("-") and line and line[0].isalpha():
                merged[-1] = f"{prev[:-1]}{line}"
                continue

            if not re.search(r"[\.!?;:]$", prev) and line and (line[0].islower() or line[0].isdigit()):
                merged[-1] = f"{prev} {line}"
                continue

            merged.append(line)
        return merged

    def _extract_date_range(self, line: str) -> tuple:
        match = self._date_range_re.search(line) or self._year_range_re.search(line)
        if not match:
            return None, line
        date_range = match.group("range").strip()
        remainder = (line[: match.start()] + " " + line[match.end() :]).strip()
        remainder = re.sub(r"\s+", " ", remainder)
        return date_range, remainder

    def _looks_like_company_line(self, line: str) -> bool:
        if any(ch.isdigit() for ch in line):
            return False
        if len(line) > 90:
            return False
        if re.match(r"^\s*[-*\u2022]\s+", line):
            return False
        return (" - " in line) or (" — " in line) or (" – " in line) or ("," in line)

    def _split_company_location(self, line: str) -> tuple:
        if " - " in line:
            parts = line.split(" - ", 1)
        elif " — " in line:
            parts = line.split(" — ", 1)
        elif " – " in line:
            parts = line.split(" – ", 1)
        elif "," in line:
            parts = line.rsplit(",", 1)
        else:
            return line.strip(), None

        company = parts[0].strip()
        location = parts[1].strip() if len(parts) > 1 else None
        return company or None, location or None

    def _normalize_heading(self, text: str) -> str:
        text = text.strip().lower()
        text = re.sub(r'^[\d\.\)\-\s]+', '', text)
        text = text.replace("&", "and")
        text = re.sub(r'[:\s]+$', '', text)
        text = re.sub(r'[^a-z\s]', '', text)
        text = re.sub(r'\s+', ' ', text)
        return text

    def _match_heading(self, line: str, normalized_map: Dict[str, set]) -> Optional[str]:
        if len(line) > 60:
            return None
        norm = self._normalize_heading(line)
        if not norm:
            return None
        for key, values in normalized_map.items():
            if norm in values:
                return key
        return None

    def _expand_parenthetical(self, item: str) -> list:
        match = re.match(r'^(.*?)\s*\(([^)]+)\)\s*$', item)
        if not match:
            return [item]
        base = match.group(1).strip()
        inner = match.group(2).strip()
        inner_parts = [p.strip() for p in inner.split(",") if p.strip()]
        if base and inner_parts:
            return [base] + inner_parts
        if base:
            return [base]
        return inner_parts or [item]


    # Skills Parsing Helpers
    def _add_skill(self, skill: str, out: list, seen: set) -> None:
        cleaned = re.sub(r'\s+', ' ', skill).strip().strip(",;")
        if len(cleaned) < 2:
            return
        key = cleaned.lower()
        if key in seen:
            return
        seen.add(key)
        out.append(cleaned)

    
    def _parse_skills_lines(self, lines: list) -> list:
        """
        Parse skill lines (e.g., "Languages: Java, Python") into a flat list of skills.
        """
        skills = []
        seen = set()
        current_category = None

        # Normalize skill headings to skip the title line itself
        skill_headings = set(self._normalize_heading(v) for v in self._section_headings.get("skills", []))

        for raw in lines:
            line = raw.strip()
            if not line:
                continue

            if self._normalize_heading(line) in skill_headings:
                current_category = None
                continue

            # Remove bullets
            line = re.sub(r'^\s*[-*\u2022]\s+', '', line)

            # Category: items
            if ":" in line:
                left, right = line.split(":", 1)
                if len(left.strip()) <= 40:
                    current_category = left.strip()
                    for item in self._split_skill_items(right):
                        self._add_skill(item, skills, seen)
                    continue

            # Category - items
            if " - " in line or " – " in line or " — " in line:
                for sep in [" - ", " – ", " — "]:
                    if sep in line:
                        left, right = line.split(sep, 1)
                        if len(left.strip()) <= 40:
                            current_category = left.strip()
                            for item in self._split_skill_items(right):
                                self._add_skill(item, skills, seen)
                            break
                else:
                    current_category = None
                if current_category:
                    continue

            # No category on this line; parse items directly
            for item in self._split_skill_items(line):
                self._add_skill(item, skills, seen)

        return skills

    def _split_skill_items(self, text: str) -> list:
        text = text.strip().rstrip(".")
        if not text:
            return []

        parts = re.split(r'\s*(?:,|;|\||\s+/\s+)\s*', text)
        items = []
        for part in parts:
            part = part.strip()
            if not part:
                continue
            items.extend(self._expand_parenthetical(part))
        return items
