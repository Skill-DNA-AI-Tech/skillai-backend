from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import Optional, Any, List, Dict, Union
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
    model_config = ConfigDict(extra="allow")

    name: Optional[str] = None
    headline: Optional[str] = None
    bio: Optional[str] = None
    skills: Optional[List[str]] = None
    github: Optional[str] = None
    linkedin: Optional[str] = None
    resumeUrl: Optional[str] = None
    targetRole: Optional[str] = None
    mobile: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    college: Optional[str] = None
    degree: Optional[str] = None
    branch: Optional[str] = None
    semester: Optional[Union[str, int]] = None
    experienceLevel: Optional[str] = None
    interests: Optional[List[str]] = None
    preferredRoles: Optional[List[str]] = None
    career: Optional[str] = None
    career_aspirations: Optional[str] = None
    domain: Optional[str] = None
    isProfileCompleted: Optional[bool] = None
    skillDNA: Optional[Dict[str, Any]] = None

class ProfileCreateRequest(BaseModel):
    model_config = ConfigDict(extra="allow")

    name: Optional[str] = None
    headline: Optional[str] = None
    bio: Optional[str] = None
    skills: Optional[List[str]] = None
    github: Optional[str] = None
    linkedin: Optional[str] = None
    resumeUrl: Optional[str] = None
    targetRole: Optional[str] = None
    mobile: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    college: Optional[str] = None
    degree: Optional[str] = None
    branch: Optional[str] = None
    semester: Optional[Union[str, int]] = None
    experienceLevel: Optional[str] = None
    interests: Optional[List[str]] = None
    preferredRoles: Optional[List[str]] = None
    career: Optional[str] = None
    career_aspirations: Optional[str] = None
    domain: Optional[str] = None
    isProfileCompleted: Optional[bool] = None
    skillDNA: Optional[Dict[str, Any]] = None

class CareerChangeRequestCreate(BaseModel):
    fromRole: Optional[str] = "General"
    toRole: str = Field(..., description="Target role to transition to")
    reason: Optional[str] = Field(None, description="Reason for requesting career track transition")

class CareerChangeReviewRequest(BaseModel):
    model_config = ConfigDict(extra="allow")
    status: str = Field(..., description="APPROVED or REJECTED")
    reviewNotes: Optional[str] = None

# ==========================================
# 9. CERTIFICATES & QUESTION BANK SCHEMAS
# ==========================================

class CertificateCreateRequest(BaseModel):
    model_config = ConfigDict(extra="allow")
    assessmentId: Optional[str] = None
    sessionId: Optional[str] = None
    careerPath: Optional[str] = "Software Engineering"
    technicalScore: Optional[int] = 80
    communicationScore: Optional[int] = 80
    problemSolvingScore: Optional[int] = 80
    confidenceScore: Optional[int] = 80
    overallScore: Optional[int] = None
    sessionsCompleted: Optional[int] = 1
    strengths: Optional[List[str]] = None
    improvements: Optional[List[str]] = None
    adminRemark: Optional[str] = None
    officialRemark: Optional[str] = None

class CertificateShareRequest(BaseModel):
    model_config = ConfigDict(extra="allow")
    recruiterEmail: EmailStr
    message: Optional[str] = None

class ReportCreateRequest(BaseModel):
    model_config = ConfigDict(extra="allow")
    profileId: Optional[str] = None
    interviewScore: Optional[int] = 0

class ReportShareRequest(BaseModel):
    model_config = ConfigDict(extra="allow")
    recruiterEmail: EmailStr
    company: Optional[str] = "Hiring Partner"
    expiryDays: Optional[int] = 14

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

class QuestionUpdateRequest(BaseModel):
    question: Optional[str] = None
    field: Optional[str] = None
    topic: Optional[str] = None
    difficulty: Optional[str] = None
    bloomLevel: Optional[str] = None
    expectedAnswer: Optional[str] = None
    status: Optional[str] = None

# ==========================================
# 10. HELPDESK & SUPPORT SCHEMAS
# ==========================================

class HelpdeskTicketCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    phone: str = Field(..., min_length=7, max_length=20)
    issue_type: str = Field(..., min_length=2, max_length=50)
    message: str = Field(..., min_length=10, max_length=2000)

class HelpdeskStatusUpdateRequest(BaseModel):
    status: str = Field(..., pattern="^(NEW|IN_PROGRESS|RESOLVED|CLOSED)$")
    admin_response: Optional[str] = None

# ==========================================
# 11. USER MANAGEMENT SCHEMAS
# ==========================================

class UserStatusUpdateRequest(BaseModel):
    status: Optional[str] = None  # ACTIVE, SUSPENDED
    is_verified: Optional[bool] = None

class UserUpdateRequest(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    college: Optional[str] = None
    degree: Optional[str] = None
    branch: Optional[str] = None
    mobile: Optional[str] = None
    status: Optional[str] = None
    is_verified: Optional[bool] = None

class UserCreateAdminRequest(BaseModel):
    name: str
    email: EmailStr
    password: str = Field(..., min_length=6)
    role: str = "student"  # student, teacher, hr, admin
    college: Optional[str] = None
    degree: Optional[str] = None
    branch: Optional[str] = None
    mobile: Optional[str] = None

# ==========================================
# 12. CERTIFICATE VERSIONING & VERIFY
# ==========================================

class CertificateEditRequest(BaseModel):
    studentName: Optional[str] = None
    careerPath: Optional[str] = None
    technicalScore: Optional[int] = None
    communicationScore: Optional[int] = None
    problemSolvingScore: Optional[int] = None
    confidenceScore: Optional[int] = None
    overallScore: Optional[int] = None
    notes: Optional[str] = None

class PublicCertificateVerifyResponse(BaseModel):
    valid: bool
    verificationStatus: str  # VERIFIED, REVOKED, EXPIRED, NOT_FOUND
    certificateId: Optional[str] = None
    studentName: Optional[str] = None
    certificateTitle: Optional[str] = None
    achievement: Optional[str] = None
    careerPath: Optional[str] = None
    issueDate: Optional[str] = None
    issuer: Optional[str] = None
    seal: Optional[str] = None
    verificationUrl: Optional[str] = None
    scores: Optional[Dict[str, Any]] = None
    message: Optional[str] = None

# ==========================================
# 13. BULK USER ACTION & AI STUDY NOTES SCHEMAS
# ==========================================

class BulkUserActionRequest(BaseModel):
    user_ids: Optional[List[str]] = None
    userIds: Optional[List[str]] = None
    action: str = Field(..., pattern="^(?i)(DEACTIVATE|ACTIVATE|DELETE|VERIFY)$")
    reason: Optional[str] = None

    def get_user_ids(self) -> List[str]:
        ids = self.user_ids or self.userIds or []
        if isinstance(ids, list):
            return [str(x) for x in ids if str(x).strip()]
        return []

class AINotesGenerateRequest(BaseModel):
    topic: Optional[str] = None
    domain: Optional[str] = None
    discipline: Optional[str] = None
    detail_level: Optional[str] = "comprehensive"
    sourceText: Optional[str] = None
    level: Optional[str] = "Intermediate"

class StudentNoteSaveRequest(BaseModel):
    topic: str
    domain: Optional[str] = "General"
    discipline: Optional[str] = None
    artifacts: Optional[Dict[str, Any]] = None
    summary: Optional[str] = None
    detailedNotes: Optional[str] = None
    keyPoints: Optional[List[str]] = []
    quickRevision: Optional[List[str]] = []
    questions: Optional[List[Dict[str, Any]]] = []
    flashcards: Optional[List[Dict[str, str]]] = []
    quiz: Optional[List[Dict[str, Any]]] = []

class StudentNoteUpdateRequest(BaseModel):
    topic: Optional[str] = None
    domain: Optional[str] = None
    discipline: Optional[str] = None
    artifacts: Optional[Dict[str, Any]] = None
    summary: Optional[str] = None
    detailedNotes: Optional[str] = None
    keyPoints: Optional[List[str]] = None
    quickRevision: Optional[List[str]] = None
    questions: Optional[List[Dict[str, Any]]] = None
    flashcards: Optional[List[Dict[str, str]]] = None
    quiz: Optional[List[Dict[str, Any]]] = None

class NoteQuizSubmitRequest(BaseModel):
    answers: Dict[str, Any]

# ==========================================
# 14. ADMIN TOPIC NOTES & CURRICULUM SCHEMAS
# ==========================================

class TopicNoteCreateRequest(BaseModel):
    career: Optional[str] = ""
    domain: Optional[str] = "Computer Science"
    topic: str
    subtopic: Optional[str] = "General"
    title: Optional[str] = None
    overview: Optional[str] = None
    richText: Optional[str] = None
    content: Optional[str] = None
    keyTakeaways: Optional[Union[List[str], str]] = None
    examples: Optional[Any] = None
    codeExamples: Optional[List[Dict[str, Any]]] = None
    resources: Optional[List[Dict[str, Any]]] = None
    status: Optional[str] = "Published"

class TopicNoteUpdateRequest(BaseModel):
    career: Optional[str] = None
    domain: Optional[str] = None
    topic: Optional[str] = None
    subtopic: Optional[str] = None
    title: Optional[str] = None
    overview: Optional[str] = None
    richText: Optional[str] = None
    content: Optional[str] = None
    keyTakeaways: Optional[Union[List[str], str]] = None
    examples: Optional[Any] = None
    codeExamples: Optional[List[Dict[str, Any]]] = None
    resources: Optional[List[Dict[str, Any]]] = None
    status: Optional[str] = None

class TopicNoteAiGenerateRequest(BaseModel):
    career: Optional[str] = None
    careerDomain: Optional[str] = None
    domain: Optional[str] = "Computer Science"
    topic: str
    subtopic: Optional[str] = "General"
    studentLevel: Optional[str] = "Intermediate"
    level: Optional[str] = "Intermediate"

class ContentRequestFulfillRequest(BaseModel):
    noteId: Optional[str] = None
    adminRemarks: Optional[str] = None

# ==========================================
# 15. PDF WATERMARK & EXPORT SCHEMAS
# ==========================================

class PdfWatermarkSettingsRequest(BaseModel):
    enabled: bool = True
    text: str = "SkillDNA AI"
    opacity: float = 0.08
    fontSize: int = 52
    rotation: int = 45
    position: str = "center"  # center, diagonal, top, bottom
    colorHex: Optional[str] = "#0f172a"
    customLogoUrl: Optional[str] = None

class PdfWatermarkSettingsResponse(BaseModel):
    enabled: bool = True
    text: str = "SkillDNA AI"
    opacity: float = 0.08
    fontSize: int = 52
    rotation: int = 45
    position: str = "center"
    colorHex: Optional[str] = "#0f172a"
    customLogoUrl: Optional[str] = None
    updatedAt: Optional[str] = None

class NotePdfExportRequest(BaseModel):
    topic: str
    domain: Optional[str] = "General"
    level: Optional[str] = "Intermediate"
    summary: Optional[str] = None
    detailedNotes: Optional[str] = None
    keyPoints: Optional[List[str]] = []
    quickRevision: Optional[List[Union[str, Dict[str, Any]]]] = []
    questions: Optional[List[Dict[str, Any]]] = []
    flashcards: Optional[List[Dict[str, str]]] = []
    quiz: Optional[List[Dict[str, Any]]] = []
    artifacts: Optional[Dict[str, Any]] = None

