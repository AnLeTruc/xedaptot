import { Request, Response } from 'express';
import RestrictedWord from '../../models/RestrictedWord';
import { refreshRestrictedWordCache } from '../../services/restrictedWordCache';
import { isValidateObjectId } from '../../validations/customValidation';

const normalizeWord = (word: string): string => word.trim().toLowerCase();

//Create restricted words
export const createRestrictedWord = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const { word, isActive } = req.body;

        if (!word || typeof word !== 'string' || word.trim() === '') {
            res.status(400).json({
                success: false,
                message: 'word is required'
            });
            return;
        }

        const normalized = normalizeWord(word);
        const existing = await RestrictedWord.findOne({ word: normalized });
        if (existing) {
            res.status(409).json({
                success: false,
                message: 'Restricted word already exists'
            });
            return;
        }

        const restrictedWord = await RestrictedWord.create({
            word: normalized,
            isActive: isActive !== undefined ? Boolean(isActive) : true
        });

        await refreshRestrictedWordCache();

        res.status(201).json({
            success: true,
            message: 'Restricted word created successfully',
            data: restrictedWord
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get restricted words
export const getRestrictedWords = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const { isActive } = req.query;
        const query: any = {};

        if (isActive !== undefined) {
            query.isActive = isActive === 'true';
        }

        const restrictedWords = await RestrictedWord.find(query)
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            data: restrictedWords
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Update restricted words
export const updateRestrictedWord = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const { id } = req.params;
        const { word, isActive } = req.body;

        if (!isValidateObjectId(id)) {
            res.status(400).json({
                success: false,
                message: 'Invalid ID format'
            });
            return;
        }

        const updateData: any = {};
        if (word !== undefined) {
            if (typeof word !== 'string' || word.trim() === '') {
                res.status(400).json({
                    success: false,
                    message: 'word must be a non-empty string'
                });
                return;
            }
            updateData.word = normalizeWord(word);
        }
        if (isActive !== undefined) {
            updateData.isActive = Boolean(isActive);
        }

        const restrictedWord = await RestrictedWord.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        );

        if (!restrictedWord) {
            res.status(404).json({
                success: false,
                message: 'Restricted word not found'
            });
            return;
        }

        await refreshRestrictedWordCache();

        res.status(200).json({
            success: true,
            message: 'Restricted word updated successfully',
            data: restrictedWord
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Delete restricted words
export const deleteRestrictedWord = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const { id } = req.params;

        if (!isValidateObjectId(id)) {
            res.status(400).json({
                success: false,
                message: 'Invalid ID format'
            });
            return;
        }

        const restrictedWord = await RestrictedWord.findByIdAndDelete(id);
        if (!restrictedWord) {
            res.status(404).json({
                success: false,
                message: 'Restricted word not found'
            });
            return;
        }

        await refreshRestrictedWordCache();

        res.status(200).json({
            success: true,
            message: 'Restricted word deleted successfully'
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};
