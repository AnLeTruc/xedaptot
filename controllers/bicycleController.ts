import { Request, Response } from 'express';
import Bicycle from '../models/Bicycle';
import Category from '../models/Category';
import Brand from '../models/Brand';
import { AuthRequest } from '../types';




// GET /api/bicycles
export const getAllBicycles = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const {
            status,
            condition,
            category,
            brand,
            minPrice,
            maxPrice,
            city,
            search,
            page = 1,
            limit = 10,
            sort = '-createdAt'  // Mặc định sort mới nhất
        } = req.query;
        const filter: any = {};
        if (status) {
            filter.status = status;
        } else {
            filter.status = 'APPROVED';
        }
        if (condition) {
            filter.condition = condition;
        }
        if (category) {
            filter['category._id'] = category;
        }
        if (brand) {
            filter['brand._id'] = brand;
        }
        if (city) {
            filter['location.city'] = { $regex: city, $options: 'i' };
        }


        // Price range
        if (minPrice || maxPrice) {
            filter.price = {};
            if (minPrice) filter.price.$gte = Number(minPrice);
            if (maxPrice) filter.price.$lte = Number(maxPrice);
        }


        // Text search
        if (search) {
            filter.$text = { $search: search as string };
        }


        // Pagination
        const pageNum = Number(page);
        const limitNum = Number(limit);
        const skip = (pageNum - 1) * limitNum;


        // Query
        const [bicycles, total] = await Promise.all([
            Bicycle.find(filter)
                .sort(sort as string)
                .skip(skip)
                .limit(limitNum),
            Bicycle.countDocuments(filter)
        ]);
        res.status(200).json({
            success: true,
            count: bicycles.length,
            total,
            page: pageNum,
            totalPages: Math.ceil(total / limitNum),
            data: bicycles
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};



// GET /api/bicycles/:id
export const getBicycleById = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const { id } = req.params;

        const bicycle = await Bicycle.findById(id);

        if (!bicycle) {
            res.status(404).json({
                success: false,
                message: 'Bicycle not found'
            });
            return;
        }

        // Tăng view count
        const updatedBicycle = await Bicycle.findByIdAndUpdate(
            id,
            { $inc: { viewCount: 1 } },
            { new: true }
        );
        res.status(200).json({
            success: true,
            data: updatedBicycle
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
}




// POST /api/bicycles
export const createBicycle = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const {
            title,
            description,
            price,
            originalPrice,
            condition,
            usageMonths,
            categoryId,
            brandId,
            specifications,
            location,
            images       // upload sau 
        } = req.body;

        // validate 
        if (!title || !price || !condition || !categoryId) {
            res.status(400).json({
                success: false,
                message: 'Missing required fields'
            })
            return;
        }


        if (!req.user) {
            res.status(401).json({
                success: false,
                message: 'Please login to post a bicycle'
            })
            return;
        }

        // Lấy thông tin category
        const categoryDoc = await Category.findById(categoryId);
        if (!categoryDoc) {
            res.status(400).json({
                success: false,
                message: 'Category not found'
            })
            return;
        }



        // Lấy thông tin brand (nếu có)
        let brandData = undefined;
        if (brandId) {
            const brandDoc = await Brand.findById(brandId);
            if (!brandDoc) {
                res.status(400).json({
                    success: false,
                    message: 'Brand not found'
                })
                return;
            }
            brandData = {
                _id: brandDoc._id,
                name: brandDoc.name,
            }
        }


        // TẠO BICYCLE
        const bicycle = await Bicycle.create({
            title,
            description,
            price,
            originalPrice,
            condition,
            usageMonths,
            status: 'PENDING',
            category: {
                _id: categoryId,
                name: categoryDoc.name
            },
            brand: brandData,
            seller: {
                _id: req.user._id,
                fullName: req.user.fullName,
                avatarUrl: req.user.avatarUrl,
                reputationScore: req.user.reputationScore || 0
            },
            specifications,
            location,
            images: images
        });

        res.status(201).json({
            success: true,
            message: 'Bicycle posted successfully. Waiting for approval.',
            data: bicycle
        })
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
}




// PUT /api/bicycles/:id
export const updateBicycle = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const { id } = req.params;
        const {
            title,
            description,
            price,
            originalPrice,
            condition,
            usageMonths,
            categoryId,
            brandId,
            specifications,
            location,
            images
        } = req.body;

        // Tìm bicycle
        const bicycle = await Bicycle.findById(id);
        if (!bicycle) {
            res.status(404).json({
                success: false,
                message: 'Bicycle not found'
            });
            return;
        }

        // Kiểm tra quyền: chỉ chủ bài mới được sửa
        if (!req.user || bicycle.seller._id.toString() !== req.user._id.toString()) {
            res.status(403).json({
                success: false,
                message: 'You are not authorized to update this bicycle'
            });
            return;
        }

        // Build  
        const updateData: any = {};

        if (title) updateData.title = title;
        if (description !== undefined) updateData.description = description;
        if (price) updateData.price = price;
        if (originalPrice !== undefined) updateData.originalPrice = originalPrice;
        if (condition) updateData.condition = condition;
        if (usageMonths !== undefined) updateData.usageMonths = usageMonths;
        if (specifications) updateData.specifications = specifications;
        if (location) updateData.location = location;
        if (images) updateData.images = images;

        // Nếu đổi category
        if (categoryId) {
            const categoryDoc = await Category.findById(categoryId);
            if (!categoryDoc) {
                res.status(400).json({
                    success: false,
                    message: 'Category not found'
                });
                return;
            }
            updateData.category = {
                _id: categoryDoc._id,
                name: categoryDoc.name
            };
        }

        // Nếu đổi brand
        if (brandId) {
            const brandDoc = await Brand.findById(brandId);
            if (!brandDoc) {
                res.status(400).json({
                    success: false,
                    message: 'Brand not found'
                });
                return;
            }
            updateData.brand = {
                _id: brandDoc._id,
                name: brandDoc.name
            };
        }

        // Sau khi sửa, chuyển về PENDING để chờ duyệt lại
        updateData.status = 'PENDING';

        const updatedBicycle = await Bicycle.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        );

        res.status(200).json({
            success: true,
            message: 'Bicycle updated successfully. Waiting for re-approval.',
            data: updatedBicycle
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};



// DELETE /api/bicycles/:id
export const deleteBicycle = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const { id } = req.params;

        const bicycle = await Bicycle.findById(id);
        if (!bicycle) {
            res.status(404).json({
                success: false,
                message: 'Bicycle not found'
            })
            return;
        }

        // Kiểm tra quyền
        if (!req.user || bicycle.seller._id.toString() !== req.user?._id.toString()) {
            res.status(403).json({
                success: false,
                message: 'You are not authorized to delete this bicycle'
            })
            return;
        }

        // Xóa bicycle
        await Bicycle.findByIdAndDelete(id);

        res.status(200).json({
            success: true,
            message: 'Bicycle deleted successfully'
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
}





export const getBicycleStatus = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const { id } = req.params;

        const { status } = req.body;

        const validStatuses = ['PENDING', 'APPROVED', 'SOLD', 'HIDDEN', 'REJECTED'];
        if (!status || !validStatuses.includes(status)) {
            res.status(400).json({
                success: false,
                message: 'Invalid status. Must be: PENDING, APPROVED, SOLD, HIDDEN, or REJECTED'
            });
            return;
        }

        const bicycle = await Bicycle.findById(id);
        if (!bicycle) {
            res.status(404).json({
                success: false,
                message: 'Bicycle not found'
            })
            return;
        }

        // Phân quyền
        const isOwner = req.user?._id.toString() == bicycle.seller._id.toString();
        const isAdmin = req.user?.roles?.includes('ADMIN');

        if (!isOwner && !isAdmin) {
            res.status(403).json({
                success: false,
                message: 'You are not authorized to update this bicycle'
            })
            return;
        }

        bicycle.status = status;
        await bicycle.save();

        res.status(200).json({
            success: true,
            message: 'Bicycle status updated successfully',
            data: bicycle
        })
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};
