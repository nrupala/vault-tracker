export const COMPANION_MIND = { name: "Sovereign Helper", version: "2.0", capabilities: ["Task Routing", "Note Creation", "Ledger Support", "Habit Tracking", "Metadata Audit"] };

export async function parseSovereignIntent(input) {
    const text = input.toLowerCase();
    if (text.match(/^(add\s*)?task\s+(.+)/i) || text.match(/todo|remind/i)) {
        return { intent: "CREATE_TASK", payload: text.replace(/^(add\s*)?task\s+/i, '').replace(/^(todo|remind)\s*/i, '').trim() };
    }
    if (text.match(/^(take\s*)?note\s+(.+)/i)) {
        return { intent: "CREATE_NOTE", payload: text.replace(/^(take\s*)?note\s+/i, '').trim() };
    }
    if (text.match(/^(track\s*)?habit\s+(.+)/i)) {
        return { intent: "CREATE_HABIT", payload: text.replace(/^(track\s*)?habit\s+/i, '').trim() };
    }
    if (text.match(/^(expense|spent|log|spend)\s+(\d+\.?\d*)\s*(for|on)?\s*(.+)/i)) {
        const m = text.match(/^(expense|spent|log|spend)\s+(\d+\.?\d*)\s*(for|on)?\s*(.+)/i);
        return { intent: "LOG_EXPENSE", payload: { amount: parseFloat(m[2]), desc: m[4] || m[1] } };
    }
    if (text.match(/security|audit|safe/i)) {
        return { intent: "SECURITY_AUDIT", payload: "Scanning vault..." };
    }
    return { intent: "UNKNOWN", payload: "Try: \"Task [title]\", \"Note [text]\", \"Habit [name]\", \"Expense 20 for lunch\"" };
}

export async function performSecurityAudit() {
    const { getAllVessels } = await import('./db.js');
    const vessels = await getAllVessels();
    return {
        vesselCount: vessels.length,
        status: vessels.length > 0 ? "Protected" : "Vulnerable (Empty Vault)",
        recommendation: vessels.length < 5 ? "Create more Hollow Vessels to increase entropy." : "Vault entropy is optimal."
    };
}

export async function saveCompanionMemory(key, memoryText) {
    const { createHollowVessel } = await import('./crypto.js');
    const { saveVessel } = await import('./db.js');
    const vessel = await createHollowVessel(key, "companion_memory", { content: memoryText, ts: Date.now() });
    const id = `mem_${crypto.randomUUID()}`;
    await saveVessel(id, vessel.ciphertext, vessel.iv);
    return id;
}
