const TAGS = {
  0x010f: "make",
  0x0110: "model",
  0x0132: "dateTime",
  0x829a: "exposureTime",
  0x829d: "fNumber",
  0x8827: "iso",
  0x920a: "focalLength",
  0xa434: "lensModel"
};

export async function readExifFromFile(file) {
  const buffer = await file.arrayBuffer();
  const view = new DataView(buffer);
  const tiffOffset = findTiffOffset(view);
  if (tiffOffset < 0) return {};

  const littleEndian = view.getUint16(tiffOffset, false) === 0x4949;
  const firstIfdOffset = view.getUint32(tiffOffset + 4, littleEndian);
  const tags = readIfd(view, tiffOffset, tiffOffset + firstIfdOffset, littleEndian);
  const exifOffset = tags.exifOffset ? tiffOffset + tags.exifOffset : null;
  const exifTags = exifOffset ? readIfd(view, tiffOffset, exifOffset, littleEndian) : {};
  return formatExif({ ...tags, ...exifTags });
}

function findTiffOffset(view) {
  if (view.byteLength < 8) return -1;
  if (view.getUint16(0) === 0xffd8) return findJpegExifOffset(view);
  if (isTiffByteOrderMark(view, 0)) return 0;
  return -1;
}

// Canon CR2 files open with a standard TIFF header (IFD0 holds Make/Model plus
// an Exif SubIFD pointer, same tag numbers as JPEG Exif) before the CR2-specific
// "CR" marker and raw image data, so the existing TIFF/IFD reader below can read
// CR2 metadata directly once the bare TIFF header is detected here.
function isTiffByteOrderMark(view, offset) {
  const byteOrder = view.getUint16(offset);
  if (byteOrder !== 0x4949 && byteOrder !== 0x4d4d) return false;
  return view.getUint16(offset + 2, byteOrder === 0x4949) === 0x002a;
}

function findJpegExifOffset(view) {
  let offset = 2;
  while (offset < view.byteLength) {
    if (view.getUint8(offset) !== 0xff) return -1;
    const marker = view.getUint8(offset + 1);
    const length = view.getUint16(offset + 2);
    if (marker === 0xe1) {
      const header = readAscii(view, offset + 4, 6);
      if (header === "Exif\0\0") return offset + 10;
    }
    offset += 2 + length;
  }
  return -1;
}

function readIfd(view, tiffOffset, ifdOffset, littleEndian) {
  const result = {};
  const count = view.getUint16(ifdOffset, littleEndian);
  for (let i = 0; i < count; i += 1) {
    const entry = ifdOffset + 2 + i * 12;
    const tag = view.getUint16(entry, littleEndian);
    const type = view.getUint16(entry + 2, littleEndian);
    const values = view.getUint32(entry + 4, littleEndian);
    const valueOffset = entry + 8;
    const value = readTagValue(view, tiffOffset, valueOffset, type, values, littleEndian);
    if (tag === 0x8769) result.exifOffset = value;
    if (TAGS[tag]) result[TAGS[tag]] = value;
  }
  return result;
}

function readTagValue(view, tiffOffset, valueOffset, type, count, littleEndian) {
  const actualOffset = count * typeSize(type) <= 4 ? valueOffset : tiffOffset + view.getUint32(valueOffset, littleEndian);
  if (type === 2) return readAscii(view, actualOffset, count).replace(/\0+$/, "");
  if (type === 3) return view.getUint16(actualOffset, littleEndian);
  if (type === 4) return view.getUint32(actualOffset, littleEndian);
  if (type === 5) {
    const numerator = view.getUint32(actualOffset, littleEndian);
    const denominator = view.getUint32(actualOffset + 4, littleEndian);
    return denominator ? numerator / denominator : numerator;
  }
  return null;
}

function typeSize(type) {
  return { 2: 1, 3: 2, 4: 4, 5: 8 }[type] || 1;
}

function readAscii(view, offset, length) {
  return String.fromCharCode(...new Uint8Array(view.buffer, offset, length));
}

function formatExif(raw) {
  return {
    camera: [raw.model?.startsWith(raw.make) ? null : raw.make, raw.model].filter(Boolean).join(" ").replace(/\s+/g, " ").trim(),
    lens: raw.lensModel || "",
    focalLength: raw.focalLength ? `${Math.round(raw.focalLength)}mm` : "",
    aperture: raw.fNumber ? `f/${round(raw.fNumber)}` : "",
    shutter: raw.exposureTime ? formatShutter(raw.exposureTime) : "",
    iso: raw.iso ? String(raw.iso) : "",
    dateTime: raw.dateTime || ""
  };
}

function formatShutter(value) {
  if (value >= 1) return `${round(value)}s`;
  return `1/${Math.round(1 / value)}`;
}

function round(value) {
  return Math.round(value * 10) / 10;
}
