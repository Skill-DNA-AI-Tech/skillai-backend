/**
 * Technical Vocabulary Dictionary and Transcript Normalizer
 * Preserves multi-domain technical terms against phonetic misrecognition.
 */

export interface DomainTermMap {
  [domain: string]: {
    [phoneticRegex: string]: string;
  };
}

// Universal phonetic corrections applicable across speech recognition engines
const COMMON_PHONETIC_REPLACEMENTS: Array<{ regex: RegExp; replacement: string }> = [
  { regex: /\b(pie\s*thon|piethon|phyton|py thon)\b/gi, replacement: 'Python' },
  { regex: /\b(sequel|s\s*q\s*l|es queue el)\b/gi, replacement: 'SQL' },
  { regex: /\b(no\s*sequel|no\s*s\s*q\s*l)\b/gi, replacement: 'NoSQL' },
  { regex: /\b(java\s*script|js|jscript)\b/gi, replacement: 'JavaScript' },
  { regex: /\b(type\s*script|ts)\b/gi, replacement: 'TypeScript' },
  { regex: /\b(react\s*js|reactjs|riact)\b/gi, replacement: 'React' },
  { regex: /\b(node\s*js|nodejs)\b/gi, replacement: 'Node.js' },
  { regex: /\b(mongo\s*db|mongodb|mango\s*db)\b/gi, replacement: 'MongoDB' },
  { regex: /\b(post\s*gres|post\s*gray|postgresql)\b/gi, replacement: 'PostgreSQL' },
  { regex: /\b(dock\s*er|darker|doker)\b/gi, replacement: 'Docker' },
  { regex: /\b(coober\s*netes|k8s|kuber\s*neties|kube\s*netes)\b/gi, replacement: 'Kubernetes' },
  { regex: /\b(a\s*w\s*s|amazon\s*web\s*services)\b/gi, replacement: 'AWS' },
  { regex: /\b(github|git\s*hub)\b/gi, replacement: 'GitHub' },
  { regex: /\b(rest\s*a\s*p\s*i|restful|rest\s*api)\b/gi, replacement: 'REST API' },
  { regex: /\b(graph\s*q\s*l|graphql)\b/gi, replacement: 'GraphQL' },
  { regex: /\b(see\s*plus\s*plus|c\s*plus\s*plus)\b/gi, replacement: 'C++' },
  { regex: /\b(see\s*sharp|c\s*sharp)\b/gi, replacement: 'C#' },
  { regex: /\b(o\s*o\s*p|object\s*oriented\s*programming)\b/gi, replacement: 'OOP' },
  { regex: /\b(d\s*s\s*a|data\s*structures\s*and\s*algorithms)\b/gi, replacement: 'DSA' },
  { regex: /\b(c\s*i\s*c\s*d|ci\s*slash\s*cd)\b/gi, replacement: 'CI/CD' },
  
  // Mechanical Engineering
  { regex: /\b(see\s*add|c\s*a\s*d|cad\s*software)\b/gi, replacement: 'CAD' },
  { regex: /\b(c\s*a\s*m|cam\s*software)\b/gi, replacement: 'CAM' },
  { regex: /\b(solid\s*works|solidwork)\b/gi, replacement: 'SolidWorks' },
  { regex: /\b(f\s*e\s*a|finite\s*element\s*analysis)\b/gi, replacement: 'FEA' },
  { regex: /\b(c\s*f\s*d|computational\s*fluid\s*dynamics)\b/gi, replacement: 'CFD' },
  { regex: /\b(g\s*d\s*and\s*t|gee\s*dee\s*and\s*tee|g\s*d\s*t)\b/gi, replacement: 'GD&T' },
  { regex: /\b(thermo\s*dynamics)\b/gi, replacement: 'Thermodynamics' },
  { regex: /\b(rankine\s*cycle|carnot\s*cycle)\b/gi, replacement: 'Rankine Cycle' },
  
  // Civil Engineering
  { regex: /\b(b\s*i\s*m|building\s*information\s*modeling)\b/gi, replacement: 'BIM' },
  { regex: /\b(auto\s*cad|autocad)\b/gi, replacement: 'AutoCAD' },
  { regex: /\b(r\s*c\s*c|reinforced\s*cement\s*concrete)\b/gi, replacement: 'RCC' },
  { regex: /\b(staad\s*pro|stad\s*pro)\b/gi, replacement: 'STAAD.Pro' },
  { regex: /\b(soil\s*mechanics|geotechnical)\b/gi, replacement: 'Geotechnical Engineering' },
  
  // Commerce & Finance
  { regex: /\b(balance\s*sheet|balence\s*sheet)\b/gi, replacement: 'Balance Sheet' },
  { regex: /\b(profit\s*and\s*loss|p\s*and\s*l|p\s*l\s*statement)\b/gi, replacement: 'P&L Statement' },
  { regex: /\b(d\s*c\s*f|discounted\s*cash\s*flow)\b/gi, replacement: 'DCF' },
  { regex: /\b(g\s*s\s*t|goods\s*and\s*services\s*tax)\b/gi, replacement: 'GST' },
  { regex: /\b(e\s*b\s*i\s*t\s*d\s*a|ebitda)\b/gi, replacement: 'EBITDA' },
  { regex: /\b(g\s*a\s*a\s*p|gaap)\b/gi, replacement: 'GAAP' },
  { regex: /\b(i\s*f\s*r\s*s|ifrs)\b/gi, replacement: 'IFRS' },
  { regex: /\b(cash\s*flow\s*statement)\b/gi, replacement: 'Cash Flow Statement' },
  
  // Electronics
  { regex: /\b(embedded\s*c|embeded\s*c)\b/gi, replacement: 'Embedded C' },
  { regex: /\b(micro\s*controller|microcontroller)\b/gi, replacement: 'Microcontroller' },
  { regex: /\b(p\s*c\s*b|printed\s*circuit\s*board)\b/gi, replacement: 'PCB' },
  { regex: /\b(i\s*two\s*c|i2c|i\s*squared\s*c)\b/gi, replacement: 'I2C' },
  { regex: /\b(s\s*p\s*i|s\s*p\s*eye)\b/gi, replacement: 'SPI' },
  { regex: /\b(u\s*art|u\s*a\s*r\s*t)\b/gi, replacement: 'UART' },
  { regex: /\b(r\s*t\s*o\s*s|real\s*time\s*operating\s*system)\b/gi, replacement: 'RTOS' },
  
  // Management & HR
  { regex: /\b(agile\s*scrum|scrum\s*master)\b/gi, replacement: 'Agile/Scrum' },
  { regex: /\b(k\s*p\s*i|key\s*performance\s*indicator)\b/gi, replacement: 'KPI' },
  { regex: /\b(o\s*k\s*r|objectives\s*and\s*key\s*results)\b/gi, replacement: 'OKR' },
  { regex: /\b(star\s*method|star\s*framework)\b/gi, replacement: 'STAR Method' },
  
  // Design
  { regex: /\b(fig\s*ma|fygma)\b/gi, replacement: 'Figma' },
  { regex: /\b(u\s*i\s*slash\s*u\s*x|ui\s*ux)\b/gi, replacement: 'UI/UX' },
  { regex: /\b(wire\s*framing|wireframe)\b/gi, replacement: 'Wireframing' },
];

/**
 * Normalizes student transcript by repairing common speech-to-text misrecognitions
 * based on domain technical vocabulary.
 */
export function normalizeTechnicalTranscript(transcript: string, domain?: string): string {
  if (!transcript || typeof transcript !== 'string') return '';
  let normalized = transcript.trim();

  for (const item of COMMON_PHONETIC_REPLACEMENTS) {
    normalized = normalized.replace(item.regex, item.replacement);
  }

  return normalized;
}

/**
 * Validates whether the transcription confidence and audio clarity are acceptable
 * for evaluation, or if the student must be prompted to repeat.
 */
export function validateSpeechConfidence(params: {
  transcript: string;
  confidence?: number;
  audioQuality?: string;
  isSilent?: boolean;
}): {
  canEvaluate: boolean;
  status: 'VALID' | 'EMPTY' | 'NO_SPEECH' | 'LOW_AUDIO_QUALITY' | 'LOW_TRANSCRIPTION_CONFIDENCE' | 'TOO_SHORT';
  message?: string;
} {
  const { transcript, confidence = 1.0, audioQuality = 'CLEAR', isSilent = false } = params;

  if (isSilent) {
    return {
      canEvaluate: false,
      status: 'NO_SPEECH',
      message: 'No voice detected. Please check your microphone and speak clearly.',
    };
  }

  const clean = transcript ? transcript.trim() : '';

  if (!clean) {
    return {
      canEvaluate: false,
      status: 'EMPTY',
      message: 'No speech was transcribed. Please unmute your microphone and try again.',
    };
  }

  // Check audio quality flag
  if (audioQuality === 'LOW_QUALITY' || audioQuality === 'GARBLED') {
    return {
      canEvaluate: false,
      status: 'LOW_AUDIO_QUALITY',
      message: 'Audio quality was too low or muffled. Please speak closer to your microphone.',
    };
  }

  // Low confidence detection (< 0.45 confidence threshold)
  if (confidence < 0.45) {
    return {
      canEvaluate: false,
      status: 'LOW_TRANSCRIPTION_CONFIDENCE',
      message: 'Audio transcription confidence was low. To ensure fair evaluation, please repeat your answer clearly.',
    };
  }

  // Too short verification (fewer than 3 meaningful words)
  const words = clean.split(/\s+/).filter(w => w.length > 0);
  if (words.length < 3) {
    return {
      canEvaluate: false,
      status: 'TOO_SHORT',
      message: 'Answer was too brief to evaluate. Please provide a more complete explanation.',
    };
  }

  return {
    canEvaluate: true,
    status: 'VALID',
  };
}
