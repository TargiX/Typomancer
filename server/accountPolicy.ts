export function deletionHasPassword(body: unknown): boolean {
  const password = (body as { password?: unknown } | null)?.password;
  return typeof password === 'string' && password.length >= 12 && password.length <= 128;
}

export function deletionMatchesAccount(userId: string, request?: Request): boolean {
  return request?.headers.get('x-typomancer-delete-account') === userId;
}
