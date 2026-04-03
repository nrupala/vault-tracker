/**
 * Sovereign Core v2.0 - Metadata Scrubber (Buildless ESM)
 * Zero dependencies. Handles JPEG EXIF and VCard (.vcf) formats.
 * All JPEG reads are bounds-checked.
 */

function log(level, msg, err) {
    if (level === 'error') console.error('[Scrubber]', msg, err || '');
    else console.log('[Scrubber]', msg);
}

export async function inspectMetadata(fileBlob) {
    if (fileBlob.type === 'image/jpeg') {
        return await inspectJPEGMetadata(fileBlob);
    }
    if (fileBlob.type === 'text/vcard' || fileBlob.name?.endsWith('.vcf')) {
        return await inspectVCardMetadata(fileBlob);
    }
    return {
        type: fileBlob.type,
        size: fileBlob.size,
        timestamp: new Date(fileBlob.lastModified).toISOString()
    };
}

async function inspectJPEGMetadata(fileBlob) {
    try {
        const buffer = await fileBlob.arrayBuffer();
        const view = new DataView(buffer);

        if (buffer.byteLength < 2 || view.getUint16(0) !== 0xFFD8) {
            return { error: "Not a valid JPEG" };
        }

        let offset = 2;
        const metadata = { exifFound: false, segments: [] };

        while (offset < view.byteLength - 1) {
            if (offset + 1 >= view.byteLength) break;
            const marker = view.getUint16(offset);
            if (marker === 0xFFE1) {
                metadata.exifFound = true;
                metadata.segments.push("APP1 (EXIF/XMP)");
            }
            // Bounds check before reading length
            if (offset + 3 > view.byteLength) break;
            const length = view.getUint16(offset + 2);
            if (length < 2) break; // Invalid segment length
            offset += length + 2;
            if (offset >= view.byteLength) break;
            // Bounds check before reading next marker
            if (offset + 1 >= view.byteLength) break;
            if (view.getUint16(offset) === 0xFFDA) break; // SOS
        }
        return metadata;
    } catch (err) {
        log('error', 'inspectJPEGMetadata failed', err);
        return { error: 'Failed to inspect JPEG: ' + err.message };
    }
}

export async function scrubMetadata(fileBlob) {
    if (fileBlob.type === 'image/jpeg') {
        return await stripJPEGMetadata(fileBlob);
    }
    if (fileBlob.type === 'text/vcard' || fileBlob.name?.endsWith('.vcf')) {
        return await scrubVCard(fileBlob);
    }
    return fileBlob;
}

async function stripJPEGMetadata(fileBlob) {
    try {
        const buffer = await fileBlob.arrayBuffer();
        const view = new DataView(buffer);

        // Validate minimum JPEG structure
        if (buffer.byteLength < 2 || view.getUint16(0) !== 0xFFD8) {
            log('warn', 'Invalid JPEG, returning original blob');
            return fileBlob;
        }

        const result = [];
        result.push(new Uint8Array(buffer.slice(0, 2))); // SOI

        let offset = 2;
        while (offset < view.byteLength - 1) {
            // Bounds check for marker
            if (offset + 1 >= view.byteLength) break;
            const marker = view.getUint16(offset);

            // Bounds check for length field
            if (offset + 3 > view.byteLength) {
                // Truncated segment - append remaining data and exit
                result.push(new Uint8Array(buffer.slice(offset)));
                break;
            }
            const length = view.getUint16(offset + 2);
            if (length < 2 || offset + length + 2 > view.byteLength) {
                // Invalid or truncated segment - append remaining and exit
                result.push(new Uint8Array(buffer.slice(offset)));
                break;
            }

            // Skip APPn markers (0xFFE0 - 0xFFEF) which contain metadata
            if (marker < 0xFFE0 || marker > 0xFFEF) {
                result.push(new Uint8Array(buffer.slice(offset, offset + length + 2)));
            } else {
                log('info', `Stripping segment 0x${marker.toString(16).toUpperCase()}`);
            }

            offset += length + 2;
            if (offset >= view.byteLength) break;
            // Bounds check before reading next marker
            if (offset + 1 >= view.byteLength) {
                result.push(new Uint8Array(buffer.slice(offset)));
                break;
            }
            if (view.getUint16(offset) === 0xFFDA) break; // SOS marker
        }

        // Append remaining image data
        if (offset < view.byteLength) {
            result.push(new Uint8Array(buffer.slice(offset)));
        }

        return new Blob(result, { type: 'image/jpeg' });
    } catch (err) {
        log('error', 'stripJPEGMetadata failed, returning original', err);
        return fileBlob;
    }
}

// ── VCard (.vcf) Parser & Scrubber ──────────────────────────────────────

function parseVCard(vcardText) {
    const lines = vcardText.split(/\r?\n/);
    const fields = [];
    let currentLine = '';
    for (const line of lines) {
        if (line.startsWith(' ') || line.startsWith('\t')) {
            currentLine += line.slice(1);
            continue;
        }
        if (currentLine) fields.push(parseVCardProperty(currentLine));
        currentLine = line;
    }
    if (currentLine) fields.push(parseVCardProperty(currentLine));
    return fields.filter(f => f !== null);
}

function parseVCardProperty(line) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) return null;
    const rawName = line.slice(0, colonIndex);
    const value = line.slice(colonIndex + 1);
    const parts = rawName.split(';');
    return { name: parts[0].toUpperCase(), params: parts.slice(1), value, raw: line };
}

async function inspectVCardMetadata(fileBlob) {
    try {
        const text = await fileBlob.text();
        const fields = parseVCard(text);
        const SAFE = ['BEGIN', 'END', 'VERSION', 'FN', 'N', 'TEL'];
        const SENSITIVE = ['NOTE', 'GEO', 'ADR', 'X-SOCIALPROFILE', 'X-ABRELATEDNAMES', 'PHOTO', 'BDAY', 'ANNIVERSARY', 'PRODID', 'REV', 'X-IMAGEHASH'];
        const safe = [], sensitive = [], other = [];
        for (const f of fields) {
            if (SAFE.includes(f.name)) safe.push({ name: f.name, value: f.value.slice(0, 40) });
            else if (SENSITIVE.includes(f.name)) sensitive.push({ name: f.name, value: f.value.slice(0, 40) });
            else other.push({ name: f.name, value: f.value.slice(0, 40) });
        }
        return {
            totalFields: fields.length, safe, sensitive, other,
            recommendation: sensitive.length > 0
                ? `${sensitive.length} sensitive field(s) detected. Recommend scrubbing.`
                : 'VCard is clean.'
        };
    } catch (err) {
        log('error', 'inspectVCardMetadata failed', err);
        return { error: 'Failed to inspect VCard: ' + err.message };
    }
}

async function scrubVCard(fileBlob, fieldsToKeep = ['BEGIN', 'END', 'VERSION', 'FN', 'N', 'TEL', 'EMAIL', 'ORG', 'TITLE']) {
    try {
        const text = await fileBlob.text();
        const fields = parseVCard(text);
        const kept = [];
        let stripped = 0;
        for (const f of fields) {
            if (fieldsToKeep.includes(f.name)) kept.push(f.raw);
            else { log('info', `Stripping [${f.name}]`); stripped++; }
        }
        log('info', `VCard Scrub: Kept ${kept.length}, Stripped ${stripped}`);
        return new Blob([kept.join('\r\n') + '\r\n'], { type: 'text/vcard' });
    } catch (err) {
        log('error', 'scrubVCard failed, returning original', err);
        return fileBlob;
    }
}
