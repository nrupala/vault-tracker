import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectMetadata, scrubMetadata } from './scrubber.js';

// Polyfill missing globals for Node 20 testing
if (typeof globalThis.Blob === 'undefined') {
  const { Blob } = await import('node:buffer');
  globalThis.Blob = Blob;
}

test('VCard Scrubber - Safe vs Sensitive Fields', async () => {
    const rawVCard = `BEGIN:VCARD
VERSION:3.0
FN:John Doe
N:Doe;John;;;
TEL;TYPE=CELL:+123456789
NOTE:This is a secret note about John.
GEO:37.386013;-122.082932
END:VCARD`;

    const blob = new Blob([rawVCard], { type: 'text/vcard' });
    
    // Test Inspection
    const meta = await inspectMetadata(blob);
    assert.equal(meta.totalFields, 8);
    assert.equal(meta.safe.length, 6); // BEGIN, VERSION, FN, N, TEL, END
    assert.equal(meta.sensitive.length, 2); // NOTE, GEO
    assert.ok(meta.recommendation.includes('sensitive field(s) detected'));

    // Test Scrubbing
    const scrubbedBlob = await scrubMetadata(blob);
    const scrubbedText = await scrubbedBlob.text();
    
    assert.ok(scrubbedText.includes('FN:John Doe'), 'Safe field should be kept');
    assert.ok(scrubbedText.includes('TEL;TYPE=CELL:+123456789'), 'Safe field should be kept');
    assert.ok(!scrubbedText.includes('NOTE:'), 'Sensitive NOTE should be stripped');
    assert.ok(!scrubbedText.includes('GEO:'), 'Sensitive GEO should be stripped');
});

test('JPEG Scrubber - Basic Type and Method routing', async () => {
    // Generate a mock JPEG buffer with an APP1 segment
    // SOI: FF D8
    // APP1: FF E1 00 04 00 00
    // SOS: FF DA
    const jpegBytes = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE1, 0x00, 0x04, 0x00, 0x00, 0xFF, 0xDA]);
    const blob = new Blob([jpegBytes], { type: 'image/jpeg' });
    
    const meta = await inspectMetadata(blob);
    assert.equal(meta.exifFound, true, 'Should detect APP1 (EXIF) segment');
    assert.equal(meta.segments.length, 1);

    const scrubbedBlob = await scrubMetadata(blob);
    const scrubbedBuffer = await scrubbedBlob.arrayBuffer();
    const scrubbedBytes = new Uint8Array(scrubbedBuffer);
    
    // Should have stripped APP1 (length 6 removed out of 10)
    assert.equal(scrubbedBytes.length, 4, 'Should shrink size by removing APP1');
    assert.equal(scrubbedBytes[2], 0xFF, 'Remaining bytes should start with SOS');
    assert.equal(scrubbedBytes[3], 0xDA, 'Remaining bytes should start with SOS');
});
