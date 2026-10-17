from datetime import datetime, timedelta

from question_batches import build_batch, public_question, validate_batch


def test_question_batch_has_exact_distribution_and_valid_ids():
    batch = build_batch("software-engineer", {"title": "Software Engineer", "competencies": ["Testing", "APIs"]}, 1)
    assert batch["questionCount"] == 15
    assert batch["difficultyDistribution"] == {"Easy": 4, "Medium": 7, "Hard": 4}
    assert len({question["questionId"] for question in batch["questions"]}) == 15
    assert all(question["question"] and question["expectedAnswer"] and question["explanation"] for question in batch["questions"])
    assert batch["status"] == "PENDING_APPROVAL"
    assert validate_batch(batch) == []


def test_question_answer_key_is_hidden_before_release():
    question = {"questionId": "q1", "question": "Explain", "expectedAnswer": "Answer", "explanation": "Why"}
    hidden = public_question(question, False)
    released = public_question(question, True)
    assert "expectedAnswer" not in hidden
    assert "explanation" not in hidden
    assert released["expectedAnswer"] == "Answer"


def test_batch_release_is_thirty_days_after_publication():
    published = datetime.utcnow()
    batch = build_batch("software-engineer", {"title": "Software Engineer", "competencies": ["Testing"]}, 2, published)
    assert batch["answerKeyAvailableAt"] == published + timedelta(days=30)


def test_question_batch_api_requires_authentication():
    from fastapi.testclient import TestClient
    from main import app

    response = TestClient(app).get("/api/learning/question-batches")
    assert response.status_code == 401
