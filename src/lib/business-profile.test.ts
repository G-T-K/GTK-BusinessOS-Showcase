import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";
import { MAX_BUSINESS_LOGO_BYTES, optimizeBusinessLogo } from "./business-logo";
import { normalizeWebsiteUrl } from "./website-url";

test("website URLs accept explicit HTTP(S) addresses and trim surrounding whitespace", () => {
  assert.deepEqual(normalizeWebsiteUrl("https://abchardware.com"), {
    value: "https://abchardware.com",
  });
  assert.deepEqual(normalizeWebsiteUrl("http://abchardware.com"), {
    value: "http://abchardware.com",
  });
  assert.deepEqual(normalizeWebsiteUrl("  https://abchardware.com/  "), {
    value: "https://abchardware.com/",
  });
  assert.deepEqual(normalizeWebsiteUrl("   "), { value: null });
});

test("website URLs reject malformed addresses and unsupported schemes", () => {
  for (const website of [
    "https://:abchardware.com/",
    "abchardware.com",
    "https:///abchardware.com",
    "https://abc hardware.com",
    "ftp://abchardware.com",
    "https://user:password@abchardware.com",
  ]) {
    assert.ok(normalizeWebsiteUrl(website).error, `${website} should be rejected`);
  }
});

test("logo optimization keeps a small JPEG below the upload limit", async () => {
  const source = await sharp({
    create: {
      width: 128,
      height: 128,
      channels: 3,
      background: { r: 30, g: 100, b: 200 },
    },
  }).jpeg().toBuffer();

  assert.ok(source.byteLength < MAX_BUSINESS_LOGO_BYTES);
  const optimized = await optimizeBusinessLogo(source);
  assert.ok(optimized.bytes.byteLength <= MAX_BUSINESS_LOGO_BYTES);
  assert.equal(optimized.mimeType, "image/jpeg");
});

test("logo optimization reduces a JPEG larger than 512 KB", async () => {
  const width = 768;
  const height = 768;
  const noise = Buffer.alloc(width * height * 3);
  let seed = 41;
  for (let index = 0; index < noise.length; index += 1) {
    seed = (seed * 48271) % 2147483647;
    noise[index] = seed % 256;
  }

  const source = await sharp(noise, { raw: { width, height, channels: 3 } })
    .jpeg({ quality: 100 })
    .toBuffer();
  assert.ok(source.byteLength > MAX_BUSINESS_LOGO_BYTES);

  const optimized = await optimizeBusinessLogo(source);
  assert.ok(optimized.bytes.byteLength <= MAX_BUSINESS_LOGO_BYTES);
  assert.equal(optimized.mimeType, "image/jpeg");
});

test("logo optimization resizes large images to safe output dimensions", async () => {
  const source = await sharp({
    create: {
      width: 4096,
      height: 1024,
      channels: 3,
      background: { r: 30, g: 100, b: 200 },
    },
  }).jpeg().toBuffer();

  const optimized = await optimizeBusinessLogo(source);
  const metadata = await sharp(optimized.bytes).metadata();
  assert.ok(metadata.width && metadata.width <= 2048);
  assert.ok(metadata.height && metadata.height <= 2048);
  assert.ok(Math.abs((metadata.width ?? 0) / (metadata.height ?? 1) - 4) < 0.01);
});

test("logo optimization preserves PNG transparency", async () => {
  const source = await sharp({
    create: {
      width: 128,
      height: 128,
      channels: 4,
      background: { r: 200, g: 80, b: 40, alpha: 0.5 },
    },
  }).png().toBuffer();

  const optimized = await optimizeBusinessLogo(source);
  const { data, info } = await sharp(optimized.bytes).raw().toBuffer({ resolveWithObject: true });
  assert.equal(optimized.mimeType, "image/png");
  assert.equal(info.channels, 4);
  assert.equal(data[3], 128);
  assert.ok(optimized.bytes.byteLength <= MAX_BUSINESS_LOGO_BYTES);
});

test("logo optimization rejects dimensions above the processing limit", async () => {
  const oversizedHeader = Buffer.from(await sharp({
    create: {
      width: 1,
      height: 1,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 1 },
    },
  }).png().toBuffer());
  oversizedHeader.writeUInt32BE(7000, 16);
  oversizedHeader.writeUInt32BE(7000, 20);

  await assert.rejects(
    () => optimizeBusinessLogo(oversizedHeader),
    /fewer than 40 million pixels/,
  );
});

test("logo optimization rejects unsupported image formats and malformed content", async () => {
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>');
  await assert.rejects(() => optimizeBusinessLogo(svg), /valid PNG, JPG, or JPEG/);
  await assert.rejects(() => optimizeBusinessLogo(Buffer.from("not an image")));
});
