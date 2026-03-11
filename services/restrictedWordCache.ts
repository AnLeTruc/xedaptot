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
    return new RegExp(pattern, 'iu');
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
