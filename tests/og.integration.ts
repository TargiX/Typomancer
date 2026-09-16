import { test } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/og.tsx';

test('Node OG endpoint renders packaged fonts to a 1200×630 PNG in both languages', async () => {
  for (const language of ['en', 'ru']) {
    const headers: Record<string, string> = {};
    let body: Buffer;
    const response = { statusCode: 0, setHeader: (key: string, value: string) => { headers[key] = value; }, end: (value: Buffer) => { body = value; } };
    await handler({ url: `/api/og?d=SECTOR-20260916&s=1234&l=${language}` } as any, response as any);
    assert.equal(response.statusCode, 200);
    assert.match(headers['content-type'], /image\/png/);
    assert.equal(body!.readUInt32BE(16), 1200);
    assert.equal(body!.readUInt32BE(20), 630);
  }
});
