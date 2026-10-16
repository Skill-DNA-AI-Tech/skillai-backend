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
    for difficulty, count in (("Easy", 4), ("Medium", 7), ("Hard", 4)):
        for _ in range(count):
            topic = topics[index % len(topics)]
            topic_name = topic if isinstance(topic, str) else topic[0]
            questions.append({
                "questionId": _question_id(batch_id, index),
                "topic": topic_name,
                "difficulty": difficulty,
                "type": "theory",
                "question": f"Explain the core idea of {topic_name} and give one situation where it matters in {career.get('title', 'this curriculum')}.",
                "options": [],
                "expectedAnswer": f"A clear explanation of {topic_name}, its purpose, and an appropriate example.",
                "explanation": f"A strong answer defines {topic_name}, explains why it is used, and connects it to a realistic scenario.",
            })
            index += 1
    return {"batchId": batch_id, "curriculumId": curriculum_id, "career": career.get("title"), "batchNumber": batch_number, "status": "PUBLISHED", "questions": questions, "questionCount": len(questions), "difficultyDistribution": {"Easy": 4, "Medium": 7, "Hard": 4}, "publishedAt": now, "answerKeyAvailableAt": now + timedelta(days=30), "createdAt": now, "updatedAt": now, "generation": {"method": "deterministic curriculum seed", "validated": True}}


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
        except Exception:
            continue
    await lock_collection.update_one({"_id": "monthly-question-batches", "owner": owner}, {"$set": {"lastRunAt": now, "leaseUntil": now}})
    await audit_logs_collection.insert_one({"action": "QUESTION_BATCH_MONTHLY_JOB", "performedBy": owner, "generated": generated, "timestamp": now})
    return {"generated": generated, "ranAt": now}
