type SkillDNAInput = {
  academicMarks?: number;
  certifications?: string[];
  projects?: Array<string | { title?: string; impact?: string }>;
  skills?: string[];
  interests?: string[];
  communicationLevel?: number;
  aptitudeLevel?: number;
  interviewScore?: number;
};

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));

export const calculateSkillDNA = (profile: SkillDNAInput) => {
  const skillCount = profile.skills?.length ?? 0;
  const certificationCount = profile.certifications?.length ?? 0;
  const projectCount = profile.projects?.length ?? 0;
  const academic = profile.academicMarks ?? 70;
  const communication = profile.communicationLevel ?? 5;
  const aptitude = profile.aptitudeLevel ?? 5;
  const interview = profile.interviewScore ?? 65;

  const technicalScore = clamp(35 + skillCount * 6 + projectCount * 8 + certificationCount * 4);
  const communicationScore = clamp(communication * 10);
  const confidenceScore = clamp((communication * 6 + aptitude * 4 + interview) / 1.7);
  const aptitudeScore = clamp(aptitude * 10);
  const projectsScore = clamp(35 + projectCount * 15);
  const certificationScore = clamp(25 + certificationCount * 12);
  const placementReadinessScore = clamp(
    technicalScore * 0.3 + communicationScore * 0.2 + confidenceScore * 0.2 + aptitudeScore * 0.15 + academic * 0.15,
  );
  const score = clamp(
    technicalScore * 0.25 +
      communicationScore * 0.16 +
      confidenceScore * 0.14 +
      projectsScore * 0.15 +
      certificationScore * 0.1 +
      placementReadinessScore * 0.2,
  );

  const strengths = [
    ...(profile.skills ?? []).slice(0, 4),
    projectCount >= 2 ? 'Project execution' : '',
    certificationCount >= 2 ? 'Certification discipline' : '',
    communication >= 7 ? 'Communication readiness' : '',
  ].filter(Boolean);

  const weaknesses = [
    skillCount < 5 ? 'Add more domain skills' : '',
    projectCount < 2 ? 'Build more proof-of-work projects' : '',
    communication < 7 ? 'Improve spoken communication' : '',
    aptitude < 7 ? 'Practice aptitude and reasoning' : '',
  ].filter(Boolean);

  const primaryInterest = profile.interests?.[0] ?? profile.skills?.[0] ?? 'Career Growth';

  return {
    score: Math.round(score),
    strengths: strengths.length ? strengths : ['Learning consistency'],
    weaknesses: weaknesses.length ? weaknesses : ['Interview storytelling'],
    communicationScore: Math.round(communicationScore),
    technicalScore: Math.round(technicalScore),
    confidenceScore: Math.round(confidenceScore),
    aptitudeScore: Math.round(aptitudeScore),
    projectsScore: Math.round(projectsScore),
    certificationScore: Math.round(certificationScore),
    placementReadinessScore: Math.round(placementReadinessScore),
    careerPathSuggestions: [
      `${primaryInterest} specialist`,
      'Domain analyst',
      'Research associate',
      'Graduate trainee',
    ],
    salaryRangeEstimate: score > 85 ? '8L - 18L INR' : score > 70 ? '5L - 10L INR' : '3L - 6L INR',
    badge: score >= 90 ? 'Platinum' : score >= 78 ? 'Gold' : score >= 62 ? 'Silver' : 'Bronze',
  };
};

export const calculateJobMatch = (profileSkills: string[] = [], jobSkills: string[] = []) => {
  const normalizedProfile = new Set(profileSkills.map((skill) => skill.toLowerCase()));
  const normalizedJob = jobSkills.map((skill) => skill.toLowerCase());
  const matched = normalizedJob.filter((skill) => normalizedProfile.has(skill));
  const missing = normalizedJob.filter((skill) => !normalizedProfile.has(skill));
  const score = normalizedJob.length ? Math.round((matched.length / normalizedJob.length) * 100) : 70;

  return {
    matchScore: clamp(score),
    matchingSkills: matched,
    missingSkills: missing,
    explanation: [
      `${matched.length} required skills already match your profile.`,
      missing.length ? `Improve ${missing.slice(0, 3).join(', ')} to raise the score.` : 'Your skill coverage is strong for this role.',
    ],
    roadmap: missing.slice(0, 5).map((skill) => `Complete one lesson and one project proof for ${skill}`),
  };
};
