import { Request, Response } from 'express';
import Bicycle from '../models/Bicycle';
import Category from '../models/Category';
import Brand from '../models/Brand';
import { AuthRequest } from '../types';
import BicycleModel from '../models/BicycleModel';
import User from '../models/User';

// GET /api/bicycles/my
export const getMyBicycles = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const { status, page = '1', limit = '10', sort = '-createdAt' } = req.query;

        const filter: any = { 'seller._id': req.user!._id };
        if (status) {
            filter.status = status;
        }

        const pageNum = Math.max(1, Number(page));
        const limitNum = Math.min(100, Math.max(1, Number(limit)));
        const skip = (pageNum - 1) * limitNum;

        const [bicycles, total] = await Promise.all([
            Bicycle.find(filter)
                .sort(sort as string)
                .skip(skip)
                .limit(limitNum),
            Bicycle.countDocuments(filter)
        ]);

        res.status(200).json({
            success: true,
            data: bicycles,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: total > 0 ? Math.ceil(total / limitNum) : 0
            }
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch your bicycles'
        });
    }
};




// GET /api/bicycles
export const getAllBicycles = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const {
            status,
            condition,
            category,
            brand,
            sellerId,
            minPrice,
            maxPrice,
            city,
            search,
            page = 1,
            limit = 10,
            sort = '-createdAt'  // Mặc định sort mới nhất
        } = req.query;
        const filter: any = {};

        const userRoles = req.user?.roles || [];
        const isPrivileged = userRoles.includes('ADMIN') || userRoles.includes('INSPECTOR');

        if (isPrivileged) {
            if (status) {
                filter.status = status;
            }
        } else {
            if (status && status !== 'APPROVED') {
                res.status(403).json({
                    success: false,
                    message: 'Access denied. You can only view APPROVED bicycles.'
                });
                return;
            }
            filter.status = 'APPROVED';
        }

        // Seller filter
        if (sellerId) {
            filter['seller._id'] = sellerId;
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
            modelId,
            specifications,
            location,
            images       // upload sau 
        } = req.body;



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

        let modelData = undefined;
        if (modelId) {
            const modelDoc = await BicycleModel.findById(modelId);
            if (!modelDoc) {
                res.status(400).json({ success: false, message: 'Bicycle model not found' });
                return;
            }
            if (brandId && modelDoc.brand._id.toString() !== brandId) {
                res.status(400).json({ success: false, message: 'Model does not belong to the selected brand' });
                return;
            }
            modelData = { _id: modelDoc._id, name: modelDoc.name };
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
            model: modelData,
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

        if (!req.user!.roles.includes('SELLER')) {
            await User.findByIdAndUpdate(req.user!._id, {
                $addToSet: { roles: 'SELLER' }
            });
            req.user!.roles.push('SELLER' as any);
        }

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

        const adminOnlyStatus = ['APPROVED', 'REJECTED'];
        const ownerOnlyStatus = ['SOLD', 'HIDDEN', 'PENDING'];

        if (adminOnlyStatus.includes(status)) {
            if (!isAdmin) {
                res.status(403).json({
                    success: false,
                    message: 'Only admin can approve or reject bicycles'
                });
                return;
            }
        } else if (ownerOnlyStatus.includes(status)) {
            if (!isOwner) {
                res.status(403).json({
                    success: false,
                    message: 'Only owner can update this status'
                });
                return;
            }
        } else {
            res.status(400).json({
                success: false,
                message: 'Invalid status'
            });
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


