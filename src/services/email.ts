type MailPayload = {
  to: string;
  subject: string;
  html: string;
};

export const sendMail = async (payload: MailPayload) => {
  if (process.env.SMTP_HOST) {
    // SMTP provider integration belongs here. The deterministic console fallback
    // keeps local development usable before email credentials are configured.
  }

  console.info(`[mail] ${payload.subject} -> ${payload.to}`);
};

export const sendOtpEmail = async (to: string, otp: string) => {
  await sendMail({
    to,
    subject: 'Your SkillDNA AI verification code',
    html: `<p>Your SkillDNA AI OTP is <strong>${otp}</strong>. It expires in 10 minutes.</p>`,
  });
};

export const sendRecruiterShareEmail = async (to: string, link: string, studentName: string) => {
  await sendMail({
    to,
    subject: `${studentName} shared a SkillDNA AI verified report`,
    html: `<p>${studentName} shared a secure SkillDNA AI report. View it here: <a href="${link}">${link}</a></p>`,
  });
};
