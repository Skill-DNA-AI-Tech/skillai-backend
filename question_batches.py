"""Versioned theory-question batches for curriculum learning."""
from __future__ import annotations
from datetime import datetime, timedelta
from hashlib import sha256
from typing import Any


def _question_id(batch_id: str, index: int) -> str:
    return sha256(f"{batch_id}:{index}".encode()).hexdigest()[:16]


def build_batch(curriculum_id: str, career: dict[str, Any], batch_number: int, now: datetime | None = None) -> dict[str, Any]:
    now = now or datetime.utcnow()
    topics = list(career.get("competencies") or career.get("curriculumTopics") or [])
    if not topics:
        raise ValueError("Curriculum has no topics")
    batch_id = f"{curriculum_id}:batch:{batch_number}"
    questions = []
    index = 0
    prompt_templates = {
        "testing": "A release is passing happy-path checks but regressions keep reaching users. Design a {difficulty} testing strategy around {topic_name}, including what evidence you would collect and why.",
        "api": "A client needs a stable contract while the service evolves. Using {topic_name}, explain the {difficulty} design you would choose, the failure case it prevents, and how you would test it.",
        "sql": "A reporting query over growing transactional data has become slow. Apply {topic_name} to propose a {difficulty} diagnosis and improvement, including the trade-off.",
        "python": "You inherit a Python component that works locally but fails under real input variation. Use {topic_name} to explain a {difficulty} fix and the evidence that would prove it safe.",
        "data structure": "A feature needs predictable performance as its dataset grows. Compare options using {topic_name} and justify the {difficulty} choice with time/space reasoning.",
    }
    def question_text(topic_name: str, difficulty: str, variant: int) -> str:
        lowered = topic_name.lower()
        for key, template in prompt_templates.items():
            if key in lowered:
                return template.format(difficulty=difficulty.lower(), topic_name=topic_name) + f" Compare your approach with alternative {variant} and state when that alternative is preferable."
        return f"For a realistic {career.get('title', 'curriculum')} project, apply {topic_name} to solve a concrete problem (scenario {variant}). Give the steps, one trade-off, and the evidence you would use to verify the {difficulty.lower()} solution."
    for difficulty, count in (("Easy", 4), ("Medium", 7), ("Hard", 4)):
        for _ in range(count):
            topic = topics[index % len(topics)]
            topic_name = topic if isinstance(topic, str) else topic[0]
            questions.append({
                "questionId": _question_id(batch_id, index),
                "topic": topic_name,
                "difficulty": difficulty,
                "type": "theory",
                "question": question_text(topic_name, difficulty, index + 1),
                "options": [],
                "expectedAnswer": f"A strong answer defines {topic_name}, applies it to the stated project scenario, explains the trade-off, and names concrete verification evidence.",
                "explanation": f"The question tests application rather than recall: define {topic_name}, connect the choice to the scenario, explain the {difficulty.lower()} trade-off, and identify how the result would be validated.",
            })
            index += 1
    return {"batchId": batch_id, "curriculumId": curriculum_id, "career": career.get("title"), "batchNumber": batch_number, "status": "PENDING_APPROVAL", "questions": questions, "questionCount": len(questions), "difficultyDistribution": {"Easy": 4, "Medium": 7, "Hard": 4}, "publishedAt": None, "answerKeyAvailableAt": now + timedelta(days=30), "generatedAt": now, "createdAt": now, "updatedAt": now, "generation": {"method": "deterministic curriculum seed", "validated": True}}


def validate_batch(batch: dict[str, Any]) -> list[str]:
    errors = []
    questions = batch.get("questions") or []
    if len(questions) != 15:
        errors.append("batch must contain exactly 15 questions")
    expected = {"Easy": 4, "Medium": 7, "Hard": 4}
    actual = {level: sum(1 for question in questions if question.get("difficulty") == level) for level in expected}
    if actual != expected:
        errors.append(f"difficulty distribution must be 4/7/4, received {actual}")
    ids = [question.get("questionId") for question in questions]
    if len(ids) != len(set(ids)):
        errors.append("question IDs must be unique")
    texts = [str(question.get("question", "")).strip().lower() for question in questions]
    if len(texts) != len(set(texts)):
        errors.append("duplicate question text is not allowed")
    for index, question in enumerate(questions, 1):
        for field in ("questionId", "topic", "question", "expectedAnswer", "explanation"):
            if not str(question.get(field, "")).strip():
                errors.append(f"question {index} is missing {field}")
    return errors


def public_question(question: dict[str, Any], answer_key_available: bool) -> dict[str, Any]:
    visible = {key: value for key, value in question.items() if key not in {"expectedAnswer", "explanation"}}
    if answer_key_available:
        visible.update({"expectedAnswer": question.get("expectedAnswer"), "explanation": question.get("explanation")})
    return visible


async def run_monthly_batch_job(question_batches_collection, audit_logs_collection, lock_collection, careers, owner: str = "api-instance") -> dict:
    """Generate due batches once per curriculum; safe to call from multiple instances."""
    now = datetime.utcnow()
    lock = await lock_collection.find_one_and_update(
        {"_id": "monthly-question-batches", "$or": [{"leaseUntil": {"$lt": now}}, {"leaseUntil": {"$exists": False}}]},
        {"$set": {"leaseUntil": now + timedelta(minutes=10), "owner": owner}},
        upsert=True,
        return_document=True,
    )
    if lock and lock.get("owner") != owner:
        return {"generated": 0, "skipped": "lease-held"}
    generated = 0
    for career in careers:
        latest = await question_batches_collection.find_one({"curriculumId": career.id}, sort=[("batchNumber", -1)])
        if latest and latest.get("publishedAt") and latest["publishedAt"] + timedelta(days=30) > now:
            continue
        number = int((latest or {}).get("batchNumber") or 0) + 1
        batch = build_batch(career.id, {"title": career.title, "competencies": list(career.competencies)}, number, now)
        try:
            await question_batches_collection.insert_one(batch)
            generated += 1
        except Exception as exc:
            await audit_logs_collection.insert_one({"action": "QUESTION_BATCH_MONTHLY_JOB_FAILED", "curriculumId": career.id, "error": str(exc)[:500], "performedBy": owner, "timestamp": now})
            raise
    await lock_collection.update_one({"_id": "monthly-question-batches", "owner": owner}, {"$set": {"lastRunAt": now, "leaseUntil": now}})
    await audit_logs_collection.insert_one({"action": "QUESTION_BATCH_MONTHLY_JOB", "performedBy": owner, "generated": generated, "timestamp": now})
    return {"generated": generated, "ranAt": now}
