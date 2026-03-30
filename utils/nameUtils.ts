/**
 * Utility functions for Vietnamese name normalization and comparison.
 * Used to match bank account owner names with KYC-verified names from CCCD.
 */

/**
 * Remove Vietnamese diacritical marks (dấu) from a string.
 * Example: "NGUYỄN VĂN A" → "NGUYEN VAN A"
 */
export function removeDiacritics(str: string): string {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
}

/**
 * Normalize a Vietnamese name for comparison:
 * - Remove diacritics
 * - Uppercase
 * - Trim and collapse multiple spaces
 */
export function normalizeName(name: string): string {
    if (!name) return '';
    return removeDiacritics(name)
        .toUpperCase()
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Compare two names after normalization.
 * Returns true if both names are equivalent after removing diacritics, 
 * normalizing case, and trimming spaces.
 * 
 * Example: "Nguyễn Văn A" vs "NGUYEN VAN A" → true
 */
export function compareNames(name1: string, name2: string): boolean {
    if (!name1 || !name2) return false;
    return normalizeName(name1) === normalizeName(name2);
}
