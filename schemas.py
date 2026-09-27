from pydantic import BaseModel, Field, EmailStr
from typing import Optional, Any, List, Dict
from datetime import datetime

# ==========================================
# 1. AUTHENTICATION SCHEMAS
# ==========================================

class StudentRegister(BaseModel):
    name: str = Field(..., min_length=2, max_length=100, description="Full legal name of the student")
    email: EmailStr = Field(..., description="Student email address")
    password: str = Field(..., min_length=6, max_length=128, description="Account password (min 6 characters)")

class StudentLogin(BaseModel):
    email: EmailStr = Field(..., description="Registered email address")
    password: str = Field(..., description="Account password")

class GoogleLoginRequest(BaseModel):
    id_token: str = Field(..., description="Google OAuth2 ID token")

class ForgotPasswordRequest(BaseModel):
    email: EmailStr = Field(..., description="Account email to dispatch reset OTP")

class ResetPasswordRequest(BaseModel):
    email: EmailStr = Field(..., description="Account email")
    otp: str = Field(..., min_length=6, max_length=6, description="6-digit verification OTP")
    new_password: str = Field(..., min_length=6, max_length=128, description="New password")

class AdminLoginRequest(BaseModel):
    email: EmailStr = Field(..., description="Administrator email address")
    password: str = Field(..., description="Administrator password")

class AdminVerifyOTPRequest(BaseModel):
    email: EmailStr = Field(..., description="Administrator email address")
    otp: str = Field(..., min_length=6, max_length=6, description="6-digit security OTP")

class VerifyEmailRequest(BaseModel):
    email: EmailStr = Field(..., description="Student email address")
    otp: str = Field(..., min_length=6, max_length=6, description="6-digit registration OTP")

class UserResponse(BaseModel):
    id: str
    name: str
    email: EmailStr
    role: str
    isTestUser: Optional[bool] = False
    isPreProductionUser: Optional[bool] = False
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str = "student"
    user: UserResponse

class AdminResponse(BaseModel):
    id: str
    email: EmailStr
    role: str = "admin"
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class AdminLoginResponse(BaseModel):
    message: str
    requires_otp: bool
    email: EmailStr

class AdminTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str = "admin"
    admin: AdminResponse

class MessageResponse(BaseModel):
    message: str
    status: Optional[str] = "success"

class RegisterResponse(BaseModel):
    message: str
    requires_verification: bool
    email: EmailStr

# ==========================================
# 2. FOOTER & CMS SCHEMAS
# ==========================================

class FooterLink(BaseModel):
    label: str
    url: str

class FooterLinkGroup(BaseModel):
    title: str
    links: List[FooterLink]

class FooterUpdateRequest(BaseModel):
    text: Optional[str] = None
    linkGroups: Optional[List[Dict[str, Any]]] = None
    copyright: Optional[str] = None

class PageSettingUpdateRequest(BaseModel):
    isHidden: bool = Field(..., description="Whether this page is hidden from student navigation")

# ==========================================
# 3. ADMIN & USER MANAGEMENT SCHEMAS
# ==========================================

class AdminCreateRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)
    name: Optional[str] = None
    role: Optional[str] = "ADMIN"

class AdminUpdateRequest(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    status: Optional[str] = None
    password: Optional[str] = None

class HRCreateRequest(BaseModel):
    email: EmailStr
    password: Optional[str] = "Recruiter@123"
    name: Optional[str] = None
    company: Optional[str] = "SkillDNA Partner"

class HRUpdateRequest(BaseModel):
    name: Optional[str] = None
    company: Optional[str] = None
    status: Optional[str] = None

class TestUserCreateRequest(BaseModel):
    name: str = "Test Candidate"
    email: EmailStr
    password: Optional[str] = "TestPass123!"
    role: Optional[str] = "student"

class TestUserStatusUpdateRequest(BaseModel):
    status: Optional[str] = None
    isActive: Optional[bool] = None

class FeedbackStatusUpdateRequest(BaseModel):
    status: str = Field("RESOLVED", description="New status for feedback item")

# ==========================================
# 4. INTERVIEW & QUESTION ENGINE SCHEMAS
# ==========================================

class InterviewStartRequest(BaseModel):
    field: Optional[str] = Field("Software Engineering", description="Career domain (e.g. Software Engineering, Data Science)")
    topic: Optional[str] = Field("Full Stack Developer", description="Specialized topic or target role")
    targetRole: Optional[str] = Field(None, description="Target job title")
    difficulty: Optional[str] = Field("Medium", description="Question difficulty: Easy, Medium, Hard")
    questionCount: Optional[int] = Field(5, ge=1, le=20, description="Total questions for this session")

class InterviewAnswerRequest(BaseModel):
    sessionId: str = Field(..., description="Active session ID (e.g. SES-XXXX)")
    questionId: str = Field(..., description="ID of the question being answered")
    answer: str = Field(..., min_length=1, description="Student's articulated answer text")
    answerType: Optional[str] = Field("Text", description="Format: Text, Audio, Code")
    timeTaken: Optional[int] = Field(45, description="Time taken in seconds")
    visualMetrics: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Camera and engagement telemetry")

class ReassessConceptRequest(BaseModel):
    topic: Optional[str] = Field("System Resilience", description="Remediated concept to reassess")

# ==========================================
# 5. AI COACHING & ANALYTICS SCHEMAS
# ==========================================

class AIInterviewRequest(BaseModel):
    question: Optional[str] = Field("Explain the core architectural principles of modern scalable applications.", description="Interview prompt")
    answer: str = Field(..., description="Candidate's technical answer")
    topic: Optional[str] = Field(None, description="Topic or technology area")

class AIDeepAnalysisRequest(BaseModel):
    domain: Optional[str] = Field(None, description="Domain to analyze")
    role: Optional[str] = Field(None, description="Target role")

class AIJobMatchRequest(BaseModel):
    jobTitle: Optional[str] = Field("Software Engineer", description="Target job title")
    skills: Optional[List[str]] = Field(default_factory=lambda: ["React", "TypeScript", "Node.js", "Python", "MongoDB"], description="Required job skills")

class AISkillDNARequest(BaseModel):
    domain: Optional[str] = Field(None, description="Domain for SkillDNA generation")

class AILearningRecommendRequest(BaseModel):
    topics: Optional[List[str]] = Field(default_factory=list, description="Weakness topics")

class AIResumeRequest(BaseModel):
    resumeText: Optional[str] = Field("Full stack software engineer with 3 years experience building cloud applications.", description="Plaintext or extracted resume text")
    targetRole: Optional[str] = Field("Full Stack Engineer", description="Target role to match")

# ==========================================
# 6. LEARNING HUB & CHATBOT SCHEMAS
# ==========================================

class LearningTopicContentRequest(BaseModel):
    topic: str = Field(..., description="Topic name to retrieve structured learning guide")

class LearningContentRequest(BaseModel):
    topic: str = Field(..., description="Topic name to generate AI learning module")

class LearningChatbotRequest(BaseModel):
    message: str = Field(..., description="Student query to AI learning coach")

# ==========================================
# 7. MCQ ASSESSMENT SCHEMAS
# ==========================================

class MCQStartRequest(BaseModel):
    topic: Optional[str] = Field("Data Structures", description="Assessment topic")

class MCQSubmitRequest(BaseModel):
    answers: Dict[str, Any] = Field(..., description="Mapping of question IDs to selected option indices")

# ==========================================
# 8. CAREER TWIN & PROFILE SCHEMAS
# ==========================================

class ProfileUpdateRequest(BaseModel):
    name: Optional[str] = None
    headline: Optional[str] = None
    bio: Optional[str] = None
    skills: Optional[List[str]] = None
    github: Optional[str] = None
    linkedin: Optional[str] = None
    resumeUrl: Optional[str] = None
    targetRole: Optional[str] = None

class CareerChangeRequestCreate(BaseModel):
    fromRole: Optional[str] = "General"
    toRole: str = Field(..., description="Target role to transition to")
    reason: Optional[str] = Field(None, description="Reason for requesting career track transition")

# ==========================================
# 9. CERTIFICATES & QUESTION BANK SCHEMAS
# ==========================================

class CertificateCreateRequest(BaseModel):
    careerPath: Optional[str] = "Software Engineering"
    technicalScore: Optional[int] = 80
    communicationScore: Optional[int] = 80
    problemSolvingScore: Optional[int] = 80
    confidenceScore: Optional[int] = 80
    sessionsCompleted: Optional[int] = 1
    strengths: Optional[List[str]] = None
    improvements: Optional[List[str]] = None

class CertificateTemplateCreateRequest(BaseModel):
    templateName: str
    templateHtml: Optional[str] = None
    signatureUrl: Optional[str] = None
    isActive: Optional[bool] = False

class CertificateSignatureRequest(BaseModel):
    signatureBase64: Optional[str] = None
    signatureUrl: Optional[str] = None

class QuestionCreateRequest(BaseModel):
    question: str
    field: str
    topic: str
    difficulty: Optional[str] = "Medium"
    bloomLevel: Optional[str] = "Apply"
    expectedAnswer: Optional[str] = None

class QuestionGenerateRequest(BaseModel):
    topic: str
    count: Optional[int] = 5
    difficulty: Optional[str] = "Medium"
