export type SnapshotUrlQueryType = 'selector' | 'text';

export interface SnapshotUrlQuery {
  type: SnapshotUrlQueryType;
  value: string;
}

export interface SnapshotUrlState {
  focusNodeId?: number;
  queries?: SnapshotUrlQuery[];
}

export const MAX_SNAPSHOT_URL_QUERY_SIZE = 20;
export const MAX_SNAPSHOT_URL_STATE_LENGTH = 8192;

const STATE_VERSION = 1;
const COMPRESSED_FLAG = 1;
const HEADER_SHIFT = 1;
const MAX_DECODED_STATE_SIZE = 32 * 1024;
const COMPRESSION_THRESHOLD = 96;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder('utf-8', { fatal: true });

const encodeBase64Url = (value: Uint8Array): string => {
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < value.length; index += chunkSize) {
    binary += String.fromCharCode(...value.subarray(index, index + chunkSize));
  }
  return btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
};

const decodeBase64Url = (value: string): Uint8Array => {
  if (!value || !/^[A-Za-z0-9_-]+$/.test(value) || value.length % 4 == 1) {
    throw new Error('Invalid Base64URL state');
  }
  const padding = (4 - (value.length % 4)) % 4;
  const binary = atob(
    value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat(padding),
  );
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
};

const readBytes = async (
  stream: ReadableStream<Uint8Array>,
  maxSize: number,
): Promise<Uint8Array> => {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let totalSize = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalSize += value.byteLength;
      if (totalSize > maxSize) {
        await reader.cancel();
        throw new Error('Decompressed URL state is too large');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const result = new Uint8Array(totalSize);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
};

const transformBytes = async (
  value: Uint8Array,
  transform: CompressionStream | DecompressionStream,
  maxSize: number,
): Promise<Uint8Array> => {
  const readPromise = readBytes(transform.readable, maxSize);
  const writer = transform.writable.getWriter();
  const input = new Uint8Array(value.byteLength);
  input.set(value);
  const writePromise = (async () => {
    try {
      await writer.write(input);
      await writer.close();
    } finally {
      writer.releaseLock();
    }
  })();
  const [result] = await Promise.all([readPromise, writePromise]);
  return result;
};

const compress = (value: Uint8Array) => {
  return transformBytes(
    value,
    new CompressionStream('deflate-raw'),
    MAX_DECODED_STATE_SIZE * 2,
  );
};

const decompress = (value: Uint8Array) => {
  return transformBytes(
    value,
    new DecompressionStream('deflate-raw'),
    MAX_DECODED_STATE_SIZE,
  );
};

const isValidFocusNodeId = (value: unknown): value is number => {
  return typeof value == 'number' && Number.isSafeInteger(value);
};

export const isDefaultSnapshotUrlState = (state: SnapshotUrlState): boolean =>
  state.focusNodeId === undefined && (state.queries?.length ?? 0) == 0;

const parseState = (value: unknown): SnapshotUrlState => {
  if (!Array.isArray(value) || value.length != 2) {
    throw new Error('Invalid URL state structure');
  }
  const [focusNodeId, queryValues] = value;
  if (focusNodeId !== null && !isValidFocusNodeId(focusNodeId)) {
    throw new Error('Invalid node ID');
  }
  if (
    !Array.isArray(queryValues) ||
    queryValues.length > MAX_SNAPSHOT_URL_QUERY_SIZE
  ) {
    throw new Error('Invalid query history');
  }

  const queries = queryValues.map((queryValue): SnapshotUrlQuery => {
    if (
      !Array.isArray(queryValue) ||
      queryValue.length != 2 ||
      (queryValue[0] !== 0 && queryValue[0] !== 1) ||
      typeof queryValue[1] != 'string' ||
      !queryValue[1]
    ) {
      throw new Error('Invalid query history entry');
    }
    return {
      type: queryValue[0] == 1 ? 'selector' : 'text',
      value: queryValue[1],
    };
  });

  return {
    ...(focusNodeId === null ? {} : { focusNodeId }),
    ...(queries.length > 0 ? { queries } : {}),
  };
};

const serializeState = (state: SnapshotUrlState): Uint8Array => {
  if (
    state.focusNodeId !== undefined &&
    !isValidFocusNodeId(state.focusNodeId)
  ) {
    throw new Error('Invalid node ID');
  }
  const queries = state.queries ?? [];
  if (queries.length > MAX_SNAPSHOT_URL_QUERY_SIZE) {
    throw new Error(
      `Query history cannot exceed ${MAX_SNAPSHOT_URL_QUERY_SIZE} entries`,
    );
  }
  const queryValues = queries.map((query) => {
    if ((query.type != 'selector' && query.type != 'text') || !query.value) {
      throw new Error('Invalid query history entry');
    }
    return [query.type == 'selector' ? 1 : 0, query.value] as const;
  });
  const bytes = textEncoder.encode(
    JSON.stringify([state.focusNodeId ?? null, queryValues]),
  );
  if (bytes.byteLength > MAX_DECODED_STATE_SIZE) {
    throw new Error('URL state content is too large');
  }
  return bytes;
};

export const encodeSnapshotUrlState = async (
  state: SnapshotUrlState,
): Promise<string> => {
  const rawBytes = serializeState(state);
  let body = rawBytes;
  let compressed = false;
  if (rawBytes.byteLength >= COMPRESSION_THRESHOLD) {
    const compressedBytes = await compress(rawBytes);
    if (compressedBytes.byteLength < rawBytes.byteLength) {
      body = compressedBytes;
      compressed = true;
    }
  }

  const bytes = new Uint8Array(body.byteLength + 1);
  bytes[0] = (STATE_VERSION << HEADER_SHIFT) | Number(compressed);
  bytes.set(body, 1);
  const encoded = encodeBase64Url(bytes);
  if (encoded.length > MAX_SNAPSHOT_URL_STATE_LENGTH) {
    throw new Error('URL state parameter is too long');
  }
  return encoded;
};

export const encodeSnapshotUrlStateParam = async (
  state: SnapshotUrlState,
): Promise<string | undefined> => {
  if (isDefaultSnapshotUrlState(state)) return;
  return encodeSnapshotUrlState(state);
};

export const decodeSnapshotUrlState = async (
  encoded: string,
): Promise<SnapshotUrlState> => {
  if (encoded.length > MAX_SNAPSHOT_URL_STATE_LENGTH) {
    throw new Error('URL state parameter is too long');
  }
  const bytes = decodeBase64Url(encoded);
  const header = bytes[0];
  if (header >> HEADER_SHIFT != STATE_VERSION) {
    throw new Error('Unsupported URL state version');
  }
  if ((header & ~COMPRESSED_FLAG) != STATE_VERSION << HEADER_SHIFT) {
    throw new Error('Invalid URL state flag');
  }

  const body = bytes.subarray(1);
  const rawBytes = header & COMPRESSED_FLAG ? await decompress(body) : body;
  if (rawBytes.byteLength > MAX_DECODED_STATE_SIZE) {
    throw new Error('URL state content is too large');
  }
  return parseState(JSON.parse(textDecoder.decode(rawBytes)));
};

export const decodeLegacySelectorQuery = (encoded: string): string => {
  return textDecoder.decode(decodeBase64Url(encoded));
};
