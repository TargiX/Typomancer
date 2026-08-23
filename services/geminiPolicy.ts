export const GEMINI_IMAGE_SIZE = '1K' as const;

const allowedRequestHosts = new Set([
  'typomancer.xyz',
  'www.typomancer.xyz',
  'narrative-flow-upgraded.vercel.app',
  'localhost',
  '127.0.0.1'
]);

export const isAllowedRequestSourceHeaders = (
  origin?: string,
  referer?: string
): boolean => {
  const sourceHeaders = [origin, referer].filter(
    (value): value is string => Boolean(value)
  );

  return sourceHeaders.every((value) => {
    try {
      return allowedRequestHosts.has(new URL(value).hostname.toLowerCase());
    } catch {
      return false;
    }
  });
};
