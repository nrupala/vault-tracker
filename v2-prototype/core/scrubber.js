/**
 * Sovereign Core v2.0 - Metadata Scrubber (Buildless ESM)
 * Zero dependencies. Handles JPEG EXIF and VCard (.vcf) formats.
 */

export async function inspectMetadata(fileBlob) {
    if (fileBlob.type === 'image/jpeg') {
        return await inspectJPEGMetadata(fileBlob);
    }
    if (fileBlob.type === 'text/vcard' || fileBlob.name?.endsWith('.vcf')) {
        return await inspectVCardMetadata(fileBlob);
    }
    
    // Default for other types
    return {
        type: fileBlob.type,
        size: fileBlob.size,
        timestamp: new Date(fileBlob.lastModified).toISOString()
    };
}

async function inspectJPEGMetadata(fileBlob) {
    const buffer = await fileBlob.arrayBuffer();
    const view = new DataView(buffer);
    
    if (view.getUint16(0) !== 0xFFD8) {
        return { error: "Not a valid JPEG" };
    }

    let offset = 2;
    const metadata = {
        exifFound: false,
        segments: []
    };

    while (offset < view.byteLength) {
        if (view.getUint16(offset) === 0xFFE1) {
            metadata.exifFound = true;
            metadata.segments.push("APP1 (EXIF/XMP)");
        }
        
        // Move to next segment
        const length = view.getUint16(offset + 2);
        offset += length + 2;
        if (offset >= view.byteLength || view.getUint16(offset) === 0xFFDA) break;
    }

    return metadata;
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
    const buffer = await fileBlob.arrayBuffer();
    const view = new DataView(buffer);
    const result = [];
    
    // SOI
    result.push(new Uint8Array(buffer.slice(0, 2)));
    
    let offset = 2;
    while (offset < view.byteLength) {
        const marker = view.getUint16(offset);
        const length = view.getUint16(offset + 2);
        
        // Skip APPn markers (0xFFE0 - 0xFFEF) which usually contain metadata
        if (marker < 0xFFE0 || marker > 0xFFEF) {
            result.push(new Uint8Array(buffer.slice(offset, offset + length + 2)));
        } else {
            console.log(`Sovereign Scrubber: Stripping Segment 0x${marker.toString(16).toUpperCase()}`);
        }
        
        offset += length + 2;
        if (offset >= view.byteLength || view.getUint16(offset) === 0xFFDA) break;
    }
    
    // Add remaining data (SOS and image data)
    if (offset < view.byteLength) {
        result.push(new Uint8Array(buffer.slice(offset)));
    }
    
    return new Blob(result, { type: 'image/jpeg' });
}

// ── VCard (.vcf) Parser & Scrubber ──────────────────────────────────────

/**
 * Parses raw VCard text into structured field objects.
 * Handles VCard 3.0 and 4.0 property lines.
 */
function parseVCard(vcardText) {
    const lines = vcardText.split(/\r?\n/);
    const fields = [];
    let currentLine = '';

    for (const line of lines) {
        // VCard folding: continuation lines start with a space or tab
        if (line.startsWith(' ') || line.startsWith('\t')) {
            currentLine += line.slice(1);
            continue;
        }
        if (currentLine) {
            fields.push(parseVCardProperty(currentLine));
        }
        currentLine = line;
    }
    if (currentLine) {
        fields.push(parseVCardProperty(currentLine));
    }

    return fields.filter(f => f !== null);
}

function parseVCardProperty(line) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) return null;

    const rawName = line.slice(0, colonIndex);
    const value = line.slice(colonIndex + 1);

    // Separate property name from parameters (e.g., TEL;TYPE=CELL)
    const parts = rawName.split(';');
    const name = parts[0].toUpperCase();
    const params = parts.slice(1);

    return { name, params, value, raw: line };
}

/**
 * Inspects a VCard file and categorizes fields by sensitivity.
 */
async function inspectVCardMetadata(fileBlob) {
    const text = await fileBlob.text();
    const fields = parseVCard(text);

    const SAFE_FIELDS = ['BEGIN', 'END', 'VERSION', 'FN', 'N', 'TEL'];
    const SENSITIVE_FIELDS = ['NOTE', 'GEO', 'ADR', 'X-SOCIALPROFILE', 'X-ABRELATEDNAMES',
        'PHOTO', 'BDAY', 'ANNIVERSARY', 'PRODID', 'REV', 'X-IMAGEHASH'];

    const safe = [];
    const sensitive = [];
    const other = [];

    for (const field of fields) {
        if (SAFE_FIELDS.includes(field.name)) {
            safe.push({ name: field.name, value: field.value.slice(0, 40) });
        } else if (SENSITIVE_FIELDS.includes(field.name)) {
            sensitive.push({ name: field.name, value: field.value.slice(0, 40) });
        } else {
            other.push({ name: field.name, value: field.value.slice(0, 40) });
        }
    }

    return {
        totalFields: fields.length,
        safe,
        sensitive,
        other,
        recommendation: sensitive.length > 0
            ? `${sensitive.length} sensitive field(s) detected. Recommend scrubbing before sealing.`
            : 'VCard is clean.'
    };
}

/**
 * Scrubs a VCard file by removing sensitive fields.
 * Keeps: FN, N, TEL, EMAIL, ORG, TITLE, VERSION, BEGIN, END.
 * Strips: NOTE, GEO, ADR, PHOTO, BDAY, X-* (custom extensions), PRODID, REV.
 */
async function scrubVCard(fileBlob, fieldsToKeep = ['BEGIN', 'END', 'VERSION', 'FN', 'N', 'TEL', 'EMAIL', 'ORG', 'TITLE']) {
    const text = await fileBlob.text();
    const fields = parseVCard(text);

    const kept = [];
    let stripped = 0;

    for (const field of fields) {
        if (fieldsToKeep.includes(field.name)) {
            kept.push(field.raw);
        } else {
            console.log(`Sovereign VCard Scrubber: Stripping [${field.name}]`);
            stripped++;
        }
    }

    console.log(`VCard Scrub Complete: Kept ${kept.length}, Stripped ${stripped}`);

    const scrubbedText = kept.join('\r\n') + '\r\n';
    return new Blob([scrubbedText], { type: 'text/vcard' });
}
