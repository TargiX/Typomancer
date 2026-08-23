export type RequestHeaders = Record<string, string | string[] | undefined>;
export type BotChecker = (headers: RequestHeaders) => Promise<{ isBot: boolean }>;

export type BrowserVerification =
  | { allowed: true }
  | { allowed: false; status: 403 | 503; error: string };

export const verifyBrowserRequest = async (
  headers: RequestHeaders,
  vercelEnvironment: string | undefined,
  checkBot: BotChecker
): Promise<BrowserVerification> => {
  try {
    const verification = await checkBot(headers);
    if (verification.isBot) {
      return { allowed: false, status: 403, error: 'Automated request blocked' };
    }
    return { allowed: true };
  } catch (error) {
    if (vercelEnvironment === 'production' || vercelEnvironment === 'preview') {
      return { allowed: false, status: 503, error: 'Request verification unavailable' };
    }
    return { allowed: true };
  }
};
