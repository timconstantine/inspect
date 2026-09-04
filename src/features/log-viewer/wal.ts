const DB_MAGIC = `SQLite format 3\0`;
const WAL_MAGIC_LE = 0x377f0682;
const WAL_MAGIC_BE = 0x377f0683;
const WAL_VERSION = 3007000;
export const MAX_SQLITE_SNAPSHOT_SIZE = 100 * 1024 * 1024;

export const getSqliteSnapshotSize = (
  databasePages: number,
  pageSize: number,
) => {
  const snapshotSize = databasePages * pageSize;
  if (
    !Number.isSafeInteger(snapshotSize) ||
    snapshotSize <= 0 ||
    snapshotSize > MAX_SQLITE_SNAPSHOT_SIZE
  ) {
    throw new Error(`SQLite WAL snapshot exceeds the previewable limit`);
  }
  return snapshotSize;
};

const readU32 = (view: DataView, offset: number, littleEndian = false) => {
  return view.getUint32(offset, littleEndian);
};

const getDbPageSize = (data: Uint8Array) => {
  if (data.byteLength < 100)
    throw new Error(`SQLite main database file is too small`);
  const magic = new TextDecoder().decode(data.subarray(0, 16));
  if (magic != DB_MAGIC) throw new Error(`Not a valid SQLite database`);
  const value = new DataView(
    data.buffer,
    data.byteOffset,
    data.byteLength,
  ).getUint16(16);
  const pageSize = value == 1 ? 65536 : value;
  if (pageSize < 512 || pageSize > 65536 || (pageSize & (pageSize - 1)) != 0) {
    throw new Error(`Invalid SQLite page size`);
  }
  return pageSize;
};

const checksum = (
  data: Uint8Array,
  littleEndian: boolean,
  initial: readonly [number, number] = [0, 0],
) => {
  if (data.byteLength % 8 != 0)
    throw new Error(`Invalid WAL checksum data length`);
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let [s0, s1] = initial;
  for (let offset = 0; offset < data.byteLength; offset += 8) {
    s0 = (s0 + readU32(view, offset, littleEndian) + s1) >>> 0;
    s1 = (s1 + readU32(view, offset + 4, littleEndian) + s0) >>> 0;
  }
  return [s0, s1] as const;
};

export const materializeWalSnapshot = (
  database: Uint8Array,
  wal?: Uint8Array,
) => {
  const databasePageSize = getDbPageSize(database);
  if (!wal || wal.byteLength == 0) {
    const result = database.slice();
    result[18] = 1;
    result[19] = 1;
    return result;
  }
  if (wal.byteLength < 32) throw new Error(`SQLite WAL file is too small`);

  const walView = new DataView(wal.buffer, wal.byteOffset, wal.byteLength);
  const magic = readU32(walView, 0);
  if (magic != WAL_MAGIC_LE && magic != WAL_MAGIC_BE) {
    throw new Error(`Not a valid SQLite WAL file`);
  }
  if (readU32(walView, 4) != WAL_VERSION) {
    throw new Error(`Unsupported SQLite WAL format version`);
  }
  let pageSize = readU32(walView, 8);
  if (pageSize == 1) pageSize = 65536;
  if (pageSize < 512 || pageSize > 65536 || (pageSize & (pageSize - 1)) != 0) {
    throw new Error(`Invalid SQLite WAL page size`);
  }
  if (pageSize != databasePageSize) {
    throw new Error(`SQLite main database and WAL page sizes don't match`);
  }

  const littleEndian = magic == WAL_MAGIC_LE;
  const headerChecksum = checksum(wal.subarray(0, 24), littleEndian);
  if (
    headerChecksum[0] != readU32(walView, 24) ||
    headerChecksum[1] != readU32(walView, 28)
  ) {
    throw new Error(`SQLite WAL header checksum failed`);
  }

  const salt1 = readU32(walView, 16);
  const salt2 = readU32(walView, 20);
  const frameSize = 24 + pageSize;
  let validFrameCount = 0;
  let rollingChecksum = headerChecksum;
  let lastCommitEndOffset = -1;
  let committedDatabasePages = 0;

  for (
    let offset = 32;
    offset + frameSize <= wal.byteLength;
    offset += frameSize
  ) {
    const pageNumber = readU32(walView, offset);
    const databasePages = readU32(walView, offset + 4);
    if (
      pageNumber == 0 ||
      readU32(walView, offset + 8) != salt1 ||
      readU32(walView, offset + 12) != salt2
    ) {
      break;
    }
    let nextChecksum = checksum(
      wal.subarray(offset, offset + 8),
      littleEndian,
      rollingChecksum,
    );
    nextChecksum = checksum(
      wal.subarray(offset + 24, offset + frameSize),
      littleEndian,
      nextChecksum,
    );
    if (
      nextChecksum[0] != readU32(walView, offset + 16) ||
      nextChecksum[1] != readU32(walView, offset + 20)
    ) {
      break;
    }
    rollingChecksum = nextChecksum;
    validFrameCount++;
    if (databasePages > 0) {
      lastCommitEndOffset = offset + frameSize;
      committedDatabasePages = databasePages;
    }
  }

  if (lastCommitEndOffset < 0) {
    if (validFrameCount > 0 || wal.byteLength >= 32 + frameSize) {
      throw new Error(`No fully committed transaction found in the SQLite WAL`);
    }
    const result = database.slice();
    result[18] = 1;
    result[19] = 1;
    return result;
  }

  const snapshotSize = getSqliteSnapshotSize(committedDatabasePages, pageSize);
  const result = new Uint8Array(snapshotSize);
  result.set(
    database.subarray(0, Math.min(database.byteLength, result.byteLength)),
  );
  for (let offset = 32; offset < lastCommitEndOffset; offset += frameSize) {
    const pageNumber = readU32(walView, offset);
    if (pageNumber > committedDatabasePages) continue;
    result.set(
      wal.subarray(offset + 24, offset + frameSize),
      (pageNumber - 1) * pageSize,
    );
  }
  result[18] = 1;
  result[19] = 1;
  return result;
};
