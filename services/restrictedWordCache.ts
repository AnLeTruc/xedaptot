import RestrictedWord from '../models/RestrictedWord';

let cachedWords: string[] = [];
let cachedRegex: RegExp | null = null;

const escapeRegex = (value: string): string => {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const buildRegex = (words: string[]): RegExp | null => {
    if (words.length === 0) {
        return null;
    }
    const pattern = words.map(escapeRegex).join('|');
    return new RegExp(pattern, 'giu');
};

export const refreshRestrictedWordCache = async (): Promise<void> => {
    const docs = await RestrictedWord.find({ isActive: true })
        .select('word -_id')
        .lean();

    cachedWords = docs
        .map(doc => doc.word.trim().toLowerCase())
        .filter(Boolean);

    cachedRegex = buildRegex(cachedWords);
};

export const initRestrictedWordCache = async (): Promise<void> => {
    await refreshRestrictedWordCache();
};

export const getRestrictedWordCache = (): { words: string[]; regex: RegExp | null } => {
    return { words: cachedWords, regex: cachedRegex };
};

export const findRestrictedWordMatch = (content: string): string | null => {
    if (!content) {
        return null;
    }

    const { words, regex } = getRestrictedWordCache();
    if (!regex || words.length === 0) {
        return null;
    }

    regex.lastIndex = 0;
    if (!regex.test(content)) {
        return null;
    }

    const lowered = content.toLowerCase();
    for (const word of words) {
        if (lowered.includes(word)) {
            return word;
        }
    }

    return null;
};

export const maskRestrictedContent = (
    content: string
): { maskedContent: string; violatedWords: string[] } => {
    if (!content) {
        return { maskedContent: content, violatedWords: [] };
    }

    const { regex } = getRestrictedWordCache();
    if (!regex) {
        return { maskedContent: content, violatedWords: [] };
    }

    const violatedSet = new Set<string>();
    regex.lastIndex = 0;
    const maskedContent = content.replace(regex, (match) => {
        violatedSet.add(match.toLowerCase());
        return '*'.repeat(match.length);
    });

    return { maskedContent, violatedWords: Array.from(violatedSet) };
};
