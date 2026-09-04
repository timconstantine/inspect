const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_FILE_SIGNATURE = 0x02014b50;
const EOCD_MIN_SIZE = 22;
const MAX_ZIP_COMMENT_SIZE = 0xffff;

export type ZipStructureLimits = {
  maxEntries: number;
  maxEntryNameSize: number;
  maxUncompressedSize: number;
};

export const assertSafeZipStructure = (
  data: Uint8Array,
  limits: ZipStructureLimits,
) => {
  if (data.byteLength < EOCD_MIN_SIZE) throw new Error(`Not a valid ZIP file`);
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const searchStart = Math.max(
    0,
    data.byteLength - EOCD_MIN_SIZE - MAX_ZIP_COMMENT_SIZE,
  );
  let eocdOffset = -1;
  for (
    let offset = data.byteLength - EOCD_MIN_SIZE;
    offset >= searchStart;
    offset--
  ) {
    if (
      view.getUint32(offset, true) == EOCD_SIGNATURE &&
      offset + EOCD_MIN_SIZE + view.getUint16(offset + 20, true) ==
        data.byteLength
    ) {
      eocdOffset = offset;
      break;
    }
  }
  if (eocdOffset < 0) throw new Error(`Not a valid ZIP file`);

  const diskNumber = view.getUint16(eocdOffset + 4, true);
  const centralDisk = view.getUint16(eocdOffset + 6, true);
  const diskEntryCount = view.getUint16(eocdOffset + 8, true);
  const entryCount = view.getUint16(eocdOffset + 10, true);
  const centralSize = view.getUint32(eocdOffset + 12, true);
  const centralOffset = view.getUint32(eocdOffset + 16, true);
  if (
    diskNumber != 0 ||
    centralDisk != 0 ||
    diskEntryCount != entryCount ||
    entryCount == 0xffff ||
    centralSize == 0xffffffff ||
    centralOffset == 0xffffffff
  ) {
    throw new Error(`Multi-volume or ZIP64 log archives are not supported`);
  }
  if (entryCount > limits.maxEntries) {
    throw new Error(`ZIP entry count cannot exceed ${limits.maxEntries}`);
  }
  if (
    centralOffset > eocdOffset ||
    centralSize > eocdOffset - centralOffset ||
    centralOffset + centralSize != eocdOffset
  ) {
    throw new Error(`ZIP central directory is corrupted`);
  }

  let offset = centralOffset;
  let actualEntryCount = 0;
  let totalUncompressedSize = 0;
  while (offset < eocdOffset) {
    if (
      offset + 46 > eocdOffset ||
      view.getUint32(offset, true) != CENTRAL_FILE_SIGNATURE
    ) {
      throw new Error(`ZIP central directory is corrupted`);
    }
    const compressedSize = view.getUint32(offset + 20, true);
    const uncompressedSize = view.getUint32(offset + 24, true);
    if (compressedSize == 0xffffffff || uncompressedSize == 0xffffffff) {
      throw new Error(`ZIP64 log archives are not supported`);
    }
    const nameLength = view.getUint16(offset + 28, true);
    if (nameLength > limits.maxEntryNameSize) {
      throw new Error(`ZIP entry path is too long`);
    }
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const nextOffset = offset + 46 + nameLength + extraLength + commentLength;
    if (nextOffset > eocdOffset)
      throw new Error(`ZIP central directory is corrupted`);
    actualEntryCount++;
    if (actualEntryCount > limits.maxEntries) {
      throw new Error(`ZIP entry count cannot exceed ${limits.maxEntries}`);
    }
    totalUncompressedSize += uncompressedSize;
    if (
      !Number.isSafeInteger(totalUncompressedSize) ||
      totalUncompressedSize > limits.maxUncompressedSize
    ) {
      throw new Error(`Total uncompressed ZIP size exceeds the limit`);
    }
    offset = nextOffset;
  }
  if (actualEntryCount != entryCount || offset != eocdOffset) {
    throw new Error(`ZIP central directory entry count mismatch`);
  }
  return { entryCount, totalUncompressedSize };
};
