/**
 * Sovereign Core v2.0 - Companion Intent Engine (Buildless ESM)
 * Zero dependencies. Uses local semantic pattern matching.
 */

export const COMPANION_MIND = {
    name: "Sovereign Helper",
    version: "0.1-Alfa",
    capabilities: ["Task Routing", "Ledger Support", "Metadata Audit"]
};

/**
 * Parses user intent locally without sending strings to a cloud LLM.
 * In v3.0, this would use a local WebLLM.
 */
export async function parseSovereignIntent(input) {
    const text = input.toLowerCase();
    
    // Intent: Create Task
    if (text.includes("task") || text.includes("todo") || text.includes("remind")) {
        return { intent: "CREATE_TASK", payload: input.replace(/task|todo|remind/i, "").trim() };
    }
    
    // Intent: Log Expense
    if (text.includes("spend") || text.includes("cost") || text.includes("$")) {
        const amount = input.match(/\d+(\.\d+)?/);
        return { intent: "LOG_EXPENSE", payload: { amount: amount ? amount[0] : 0, note: input } };
    }

    // Intent: Security Audit
    if (text.includes("security") || text.includes("safe") || text.includes("vessel")) {
        return { intent: "SECURITY_AUDIT", payload: "Scanning Hollow Vessels..." };
    }

    return { intent: "UNKNOWN", payload: "I am learning. Try 'Task [title]' or 'Security Audit'." };
}

/**
 * Performs a local audit of the vault's health
 */
export async function performSecurityAudit(vaultDb) {
    const { getAllVessels } = await import('./db.js');
    const vessels = await getAllVessels();
    
    return {
        vesselCount: vessels.length,
        status: vessels.length > 0 ? "Protected" : "Vulnerable (Empty Vault)",
        recommendation: vessels.length < 5 ? "Create more Hollow Vessels to increase entropy." : "Vault entropy is optimal."
    };
}

/**
 * Stores companion memories as encrypted Hollow Vessels
 */
export async function saveCompanionMemory(vaultDb, key, memoryText) {
    console.log(`Assistant Learning: ${memoryText}`);
    
    // Create an atomic hollow vessel for the memory
    const { createHollowVessel } = await import('./crypto.js');
    const { saveVessel } = await import('./db.js');
    
    const vessel = await createHollowVessel(key, "companion_memory", {
        content: memoryText,
        ts: Date.now()
    });

    const memoryId = `mem_${crypto.randomUUID()}`;
    await saveVessel(memoryId, vessel.ciphertext, vessel.iv);
    
    return memoryId;
}
