export type InlineImage = {
  data: string;
  mimeType: string;
};

const asRecord = (value: unknown): Record<string, unknown> | null => (
  value && typeof value === 'object' ? value as Record<string, unknown> : null
);

const asList = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

export const normalizeInlineImage = (part: unknown): InlineImage | null => {
  const record = asRecord(part);
  if (!record) return null;

  const inline = asRecord(record.inlineData) || asRecord(record.inline_data);
  if (typeof inline?.data === 'string' && inline.data) {
    return {
      data: inline.data,
      mimeType: typeof inline.mimeType === 'string'
        ? inline.mimeType
        : typeof inline.mime_type === 'string'
          ? inline.mime_type
          : 'image/png'
    };
  }

  if (record.type === 'image' && typeof record.data === 'string' && record.data) {
    return {
      data: record.data,
      mimeType: typeof record.mime_type === 'string'
        ? record.mime_type
        : typeof record.mimeType === 'string'
          ? record.mimeType
          : 'image/png'
    };
  }

  return null;
};

const blocksOf = (value: unknown): unknown[] => {
  const record = asRecord(value);
  if (!record) return [];
  return [
    ...asList(record.content),
    ...asList(record.contents),
    ...asList(record.parts),
    ...asList(record.outputs)
  ];
};

/**
 * Gemini's Interactions API dropped the flat `outputs` array in June 2026.
 * Images now live on `steps[].content[]` (type: image), with `output_image`
 * only present when the SDK version adds that convenience field.
 */
export const extractInteractionImage = (interaction: unknown): InlineImage | null => {
  const root = asRecord(interaction);
  if (!root) return null;

  const direct = normalizeInlineImage(root.output_image || root.outputImage || root.image);
  if (direct) return direct;

  const buckets = [
    ...asList(root.outputs),
    ...asList(root.steps)
  ];

  for (const bucket of buckets) {
    const fromBucket = normalizeInlineImage(bucket);
    if (fromBucket) return fromBucket;

    for (const block of blocksOf(bucket)) {
      const fromBlock = normalizeInlineImage(block);
      if (fromBlock) return fromBlock;
      for (const nested of blocksOf(block)) {
        const fromNested = normalizeInlineImage(nested);
        if (fromNested) return fromNested;
      }
    }
  }

  return null;
};
