"""Reusable career competency catalog and deterministic evidence analysis."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Iterable
import re


@dataclass(frozen=True)
class CareerDefinition:
    id: str
    category: str
    title: str
    description: str
    competencies: tuple[str, ...]


CAREERS: tuple[CareerDefinition, ...] = (
    CareerDefinition("software-engineer", "Software and IT", "Software Engineer", "Builds reliable software products and services.", ("Programming fundamentals", "Data structures and algorithms", "API and system design", "Testing and debugging", "Version control and collaboration", "Communication and problem-solving")),
    CareerDefinition("data-scientist", "Data science and AI", "Data Scientist", "Uses data, statistics, and experimentation to guide decisions.", ("Python or analytical programming", "Statistics and probability", "Data preparation and SQL", "Machine learning fundamentals", "Model evaluation", "Communication and problem-solving")),
    CareerDefinition("systems-engineer", "Engineering", "Systems Engineer", "Applies engineering analysis and operational discipline to complex systems.", ("Engineering mathematics", "Systems analysis", "Simulation and modeling", "Safety and quality standards", "Project delivery", "Communication and problem-solving")),
    CareerDefinition("research-associate", "Science and research", "Research Associate", "Plans, executes, and communicates rigorous research.", ("Research methods", "Experimental design", "Data analysis", "Technical documentation", "Ethics and reproducibility", "Communication and problem-solving")),
    CareerDefinition("financial-analyst", "Commerce, accounting, and finance", "Financial Analyst", "Builds financial analysis for planning, valuation, and decisions.", ("Financial statements", "Excel or financial modeling", "Valuation and forecasting", "Accounting standards", "Risk and controls", "Communication and problem-solving")),
    CareerDefinition("operations-manager", "Business and management", "Operations Manager", "Improves execution, planning, and cross-functional performance.", ("Strategic planning", "Process improvement", "Budgeting and resource allocation", "Project management", "Stakeholder management", "Communication and problem-solving")),
    CareerDefinition("content-communicator", "Arts, humanities, and communication", "Communications Specialist", "Creates clear, audience-aware written and verbal communication.", ("Research and synthesis", "Writing and editing", "Audience strategy", "Presentation and storytelling", "Digital content tools", "Communication and problem-solving")),
    CareerDefinition("healthcare-coordinator", "Healthcare", "Healthcare Operations Coordinator", "Coordinates safe, ethical, and effective healthcare services.", ("Healthcare fundamentals", "Patient communication", "Care coordination", "Records and compliance", "Quality and safety", "Communication and problem-solving")),
    CareerDefinition("legal-associate", "Law", "Legal Associate", "Researches, drafts, and supports legally sound decisions.", ("Legal research", "Statutory interpretation", "Contract drafting", "Case analysis", "Professional ethics", "Communication and problem-solving")),
    CareerDefinition("skilled-professional", "Vocational and other professional careers", "Skilled Professional", "Builds dependable trade or professional capability through practice and standards.", ("Domain foundations", "Tools and equipment", "Safety and compliance", "Practical execution", "Quality control", "Communication and problem-solving")),
)


def _norm(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", " ", str(value or "").lower()).strip()


def get_career(career_id: str) -> CareerDefinition:
    wanted = _norm(career_id)
    for career in CAREERS:
        if wanted in {_norm(career.id), _norm(career.title)}:
            return career
    raise ValueError("Unknown target career")


def _flatten(values: Iterable[Any]) -> list[str]:
    result: list[str] = []
    for value in values:
        if isinstance(value, (list, tuple, set)):
            result.extend(_flatten(value))
        elif value:
            result.append(str(value))
    return result


def analyze_career(career: CareerDefinition, profile: dict, assessments: list[dict], answers: list[dict]) -> dict:
    raw_skills = _flatten([profile.get("skills", []), profile.get("interests", []), profile.get("preferredRoles", [])])
    skills_text = " ".join(_norm(skill) for skill in raw_skills)
    dna = profile.get("skillDNA") if isinstance(profile.get("skillDNA"), dict) else {}
    dna_text = {_norm(key): value for key, value in dna.items() if isinstance(value, (int, float))}
    evidence_items: list[dict] = []
    for competency in career.competencies:
        key = _norm(competency)
        matching_dna = next((value for name, value in dna_text.items() if key in name or name in key), None)
        matching_assessments = [a for a in assessments if key in _norm(a.get("topic")) or _norm(a.get("topic")) in key]
        matching_answers = [a for a in answers if key in _norm(a.get("topic") or a.get("concept"))]
        score_values = [float(a.get("score")) for a in matching_assessments if isinstance(a.get("score"), (int, float))]
        answer_values = [float(a.get("technicalQualityScore")) for a in matching_answers if isinstance(a.get("technicalQualityScore"), (int, float))]
        score = matching_dna if matching_dna is not None else (sum(score_values + answer_values) / len(score_values + answer_values) if score_values or answer_values else None)
        skill_match = key in skills_text or any(part in skills_text for part in key.split() if len(part) > 4)
        if score is None and skill_match:
            classification, confidence = "PARTIALLY_DEVELOPED", "profile_skill"
            score = 50
        elif score is None:
            classification, confidence = "NOT_ASSESSED", "no matching evidence found"
        elif score >= 75:
            classification, confidence = "STRONG", "assessment or verified Skill DNA evidence"
        elif score >= 50:
            classification, confidence = "PARTIALLY_DEVELOPED", "assessment or verified Skill DNA evidence"
        else:
            classification, confidence = "MISSING", "assessed evidence below the minimum threshold"
        evidence_items.append({"competency": competency, "classification": classification, "score": round(score, 1) if score is not None else None, "evidence": confidence})
    assessed = [item for item in evidence_items if item["score"] is not None]
    readiness = round(sum(item["score"] for item in assessed) / len(assessed), 1) if assessed else None
    roadmap = []
    for item in evidence_items:
        if item["classification"] == "STRONG":
            continue
        priority = "High" if item["classification"] in {"MISSING", "NOT_ASSESSED"} else "Medium"
        roadmap.append({"competency": item["competency"], "why": f"This competency is part of the {career.title} requirements.", "activity": f"Study and practice {item['competency']}", "priority": priority, "completionCriterion": "Complete the linked topic and pass its assessment with at least 70%.", "learningPath": f"/learning?topic={item['competency']}"})
    return {"targetCareer": {"id": career.id, "category": career.category, "title": career.title, "description": career.description, "competencies": list(career.competencies)}, "competencies": evidence_items, "readinessScore": readiness, "readinessMethod": "Mean of available competency evidence only; unassessed competencies are excluded and no employment outcome is implied.", "roadmap": roadmap[:8], "nextAction": roadmap[0] if roadmap else {"activity": "Maintain verified evidence across the target competencies.", "priority": "Low"}}
