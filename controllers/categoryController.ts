import { Request, Response } from 'express';
import Category from '../models/Category';

// GET /api/categories - Lấy tất cả categories
export const getAllCategories = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const { isActive, search } = req.query;

        const filter: any = {};
        if (isActive !== undefined) {
            filter.isActive = isActive === 'true';
        }

        if (search) {
            filter.name = { $regex: search, $options: 'i' };
        }

        const categories = await Category.find(filter)
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: categories.length,
            data: categories
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// GET /api/categories/:id - Lấy 1 category
export const getCategoryById = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const { id } = req.params;

        const category = await Category.findById(id);

        if (!category) {
            res.status(404).json({
                success: false,
                message: 'Category not found'
            });
            return;
        }

        res.status(200).json({
            success: true,
            data: category
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// POST /api/categories - Tạo category mới
export const createCategory = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const { name, description, isActive, imageUrl } = req.body;

        // Validate required field
        if (!name) {
            res.status(400).json({
                success: false,
                message: 'Name is required'
            });
            return;
        }

        // Check duplicate
        const existingCategory = await Category.findOne({ name });
        if (existingCategory) {
            res.status(400).json({
                success: false,
                message: 'Category name already exists'
            });
            return;
        }

        const category = await Category.create({
            name,
            description,
            imageUrl,
            isActive: isActive ?? true
        });

        res.status(201).json({
            success: true,
            message: 'Category created successfully',
            data: category
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// PUT /api/categories/:id - Cập nhật category
export const updateCategory = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const { id } = req.params;
        const { name, description, isActive, imageUrl } = req.body;

        // Check if category exists
        const category = await Category.findById(id);
        if (!category) {
            res.status(404).json({
                success: false,
                message: 'Category not found'
            });
            return;
        }

        // Check duplicate name (nếu đổi tên)
        if (name && name !== category.name) {
            const existingCategory = await Category.findOne({ name });
            if (existingCategory) {
                res.status(400).json({
                    success: false,
                    message: 'Category name already exists'
                });
                return;
            }
        }

        // Update
        const updatedCategory = await Category.findByIdAndUpdate(
            id,
            { name, description, isActive, imageUrl },
            { new: true, runValidators: true }
        );

        res.status(200).json({
            success: true,
            message: 'Category updated successfully',
            data: updatedCategory
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// DELETE /api/categories/:id - Xóa category
export const deleteCategory = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const { id } = req.params;

        const category = await Category.findById(id);
        if (!category) {
            res.status(404).json({
                success: false,
                message: 'Category not found'
            });
            return;
        }

        await Category.findByIdAndDelete(id);

        res.status(200).json({
            success: true,
            message: 'Category deleted successfully'
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


