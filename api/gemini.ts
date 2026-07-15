import { GoogleGenAI } from '@google/genai';

const API_KEY = process.env.GEMINI_API_KEY || process.env.API_KEY || '';
const TEXT_MODEL = 'gemini-flash-lite-latest';
const LEGACY_TEXT_MODEL = 'gemini-2.5-flash';
const IMAGE_MODEL = 'gemini-3.1-flash-lite-image';
const FULL_IMAGE_MODEL = 'gemini-3.1-flash-image';
const LEGACY_IMAGE_MODEL = 'gemini-2.5-flash-image';
const textModels = new Set([TEXT_MODEL, LEGACY_TEXT_MODEL]);
const imageModels = new Set([IMAGE_MODEL, FULL_IMAGE_MODEL, LEGACY_IMAGE_MODEL]);
const allowedModels = new Set([...textModels, ...imageModels]);
const allowedRequestHosts = new Set([
  'narrative-flow-upgraded.vercel.app',
  'localhost',
  '127.0.0.1'
]);

const MINUTE_WINDOW_MS = 60 * 1000;
const DAY_WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_REQUESTS_PER_MINUTE = 30;
const MAX_REQUESTS_PER_DAY = 300;
const MAX_GLOBAL_REQUESTS_PER_DAY = 5000;

type RequestHistory = number[];

// Rate-limit state is per serverless instance and resets on cold start. That is an
// acceptable v1 tradeoff; shared KV/Redis is the future upgrade path.
const requestHistoryByIp = new Map<string, RequestHistory>();
let globalRequestHistory: RequestHistory = [];

export const config = {
  maxDuration: 60
};

const json = (res: any, status: number, data: unknown) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
};

const getHeader = (req: any, name: string): string | undefined => {
  const value = req.headers?.[name.toLowerCase()] ?? req.headers?.[name];
  if (Array.isArray(value)) return value[0];
  return typeof value === 'string' ? value : undefined;
};

const isAllowedRequestSource = (req: any): boolean => {
  const sourceHeaders = [getHeader(req, 'origin'), getHeader(req, 'referer')].filter(
    (value): value is string => Boolean(value)
  );

  if (sourceHeaders.length === 0) return process.env.NODE_ENV !== 'production';

  return sourceHeaders.every((value) => {
    try {
      return allowedRequestHosts.has(new URL(value).hostname.toLowerCase());
    } catch {
      return false;
    }
  });
};

const getClientIp = (req: any): string => {
  const forwardedFor = getHeader(req, 'x-forwarded-for');
  return forwardedFor?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
};

const pruneBefore = (history: RequestHistory, cutoff: number): RequestHistory => {
  const firstCurrentIndex = history.findIndex((timestamp) => timestamp > cutoff);
  if (firstCurrentIndex === -1) return [];
  if (firstCurrentIndex === 0) return history;
  return history.slice(firstCurrentIndex);
};

const isRateLimited = (req: any): boolean => {
  const now = Date.now();
  const minuteCutoff = now - MINUTE_WINDOW_MS;
  const dayCutoff = now - DAY_WINDOW_MS;
  const clientIp = getClientIp(req);
  const requestHistory = pruneBefore(requestHistoryByIp.get(clientIp) || [], dayCutoff);
  globalRequestHistory = pruneBefore(globalRequestHistory, dayCutoff);

  const requestsThisMinute = requestHistory.reduce(
    (count, timestamp) => count + (timestamp > minuteCutoff ? 1 : 0),
    0
  );

  if (
    requestsThisMinute >= MAX_REQUESTS_PER_MINUTE
    || requestHistory.length >= MAX_REQUESTS_PER_DAY
    || globalRequestHistory.length >= MAX_GLOBAL_REQUESTS_PER_DAY
  ) {
    if (requestHistory.length > 0) requestHistoryByIp.set(clientIp, requestHistory);
    else requestHistoryByIp.delete(clientIp);
    return true;
  }

  requestHistory.push(now);
  globalRequestHistory.push(now);
  requestHistoryByIp.set(clientIp, requestHistory);
  return false;
};

const parseBody = async (req: any) => {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body);

  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const withTransientRetry = async <T,>(request: () => Promise<T>): Promise<T> => {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await request();
    } catch (error) {
      lastError = error;
      const status = (error as { status?: number })?.status;
      if (status !== 503 || attempt === 2) break;
      await sleep(350 * (attempt + 1));
    }
  }
  throw lastError;
};

const normalizeInlineImage = (part: any) => {
  if (!part || typeof part !== 'object') return null;
  const inline = part.inlineData || part.inline_data;
  if (inline?.data) {
    return {
      data: inline.data,
      mimeType: inline.mimeType || inline.mime_type || 'image/png'
    };
  }
  if (part.type === 'image' && part.data) {
    return {
      data: part.data,
      mimeType: part.mime_type || part.mimeType || 'image/png'
    };
  }
  return null;
};

const extractInteractionImage = (interaction: any) => {
  const direct = normalizeInlineImage(interaction?.output_image || interaction?.outputImage || interaction?.image);
  if (direct) return direct;

  const outputs = Array.isArray(interaction?.outputs) ? interaction.outputs : [];
  for (const output of outputs) {
    const outputImage = normalizeInlineImage(output);
    if (outputImage) return outputImage;

    const parts = Array.isArray(output?.parts) ? output.parts : [];
    for (const part of parts) {
      const partImage = normalizeInlineImage(part);
      if (partImage) return partImage;
    }
  }

  return null;
};

export default async function handler(req: any, res: any) {
  let requestedModel: string | undefined;

  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  if (!isAllowedRequestSource(req)) {
    return json(res, 403, { error: 'Forbidden' });
  }

  if (isRateLimited(req)) {
    return json(res, 429, { error: 'Rate limited' });
  }

  if (!API_KEY) {
    return json(res, 503, { error: 'Gemini is not configured' });
  }

  try {
    const body = await parseBody(req);
    const model = typeof body.model === 'string' ? body.model : '';
    const contents = typeof body.contents === 'string' ? body.contents : '';
    requestedModel = model;

    if (!allowedModels.has(model) || !contents) {
      return json(res, 400, { error: 'Invalid Gemini request' });
    }

    const ai = new GoogleGenAI({ apiKey: API_KEY });

    if (imageModels.has(model)) {
      const imageModel = model === LEGACY_IMAGE_MODEL ? IMAGE_MODEL : model;
      const interaction = await ai.interactions.create({
        model: imageModel,
        input: contents,
        response_format: {
          type: 'image',
          aspect_ratio: '16:9',
          image_size: '512'
        },
        response_modalities: ['image']
      } as any);
      const inlineImage = extractInteractionImage(interaction);

      if (!inlineImage) {
        console.error('Gemini image response missing image', {
          model: requestedModel,
          status: (interaction as any)?.status,
          outputs: Array.isArray((interaction as any)?.outputs) ? (interaction as any).outputs.length : 0
        });
        return json(res, 502, { error: 'Gemini image response missing image' });
      }

      return json(res, 200, {
        text: '',
        candidates: [
          {
            content: {
              parts: [
                {
                  inlineData: inlineImage
                }
              ]
            }
          }
        ]
      });
    }

    const textModel = model === LEGACY_TEXT_MODEL ? TEXT_MODEL : model;
    const response = await withTransientRetry(() =>
      ai.models.generateContent({
        model: textModel,
        contents,
        config: body.config && typeof body.config === 'object' ? body.config : undefined
      })
    );

    return json(res, 200, {
      text: response.text || '',
      candidates: response.candidates || []
    });
  } catch (error) {
    const err = error as { message?: string; status?: number; code?: string };
    console.error('Gemini request failed', {
      model: requestedModel,
      status: err.status,
      code: err.code,
      message: err.message
    });

    const status = typeof err.status === 'number' && err.status >= 400 && err.status < 600 ? err.status : 500;
    return json(res, status, {
      error: status === 429
        ? 'Gemini quota exceeded'
        : status === 503
          ? 'Gemini temporarily unavailable'
          : 'Gemini request failed'
    });
  }
}
