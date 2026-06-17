import { env } from '../config/env';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchWithRetries = async (url: string, options: RequestInit, retries: number): Promise<Response> => {
  let attempt = 0;
  while (attempt <= retries) {
    const response = await fetch(url, options);
    if (response.ok) {
      return response;
    }

    attempt += 1;
    if (attempt > retries) {
      return response;
    }

    await delay(500 * attempt);
  }

  throw new Error('Groq request failed after retries');
};

export const groqRequest = async (payload: Record<string, unknown>): Promise<any> => {
  if (!env.groqApiKey) {
    throw new Error('GROQ_API_KEY is not configured.');
  }

  const prompt = typeof payload.prompt === 'string' ? payload.prompt : JSON.stringify(payload);
  const url = `${env.groqApiUrl}/chat/completions`;
  const response = await fetchWithRetries(
    url,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.groqApiKey}`,
      },
      body: JSON.stringify({
        model: env.groqModel,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      }),
    },
    env.groqMaxRetries,
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Groq API error ${response.status}: ${body}`);
  }

  const body = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  return body.choices?.[0]?.message?.content ?? '';
};
