import { Request, Response } from 'express';
import Bicycle from '../models/Bicycle';
import Category from '../models/Category';
import Brand from '../models/Brand';
import { AuthRequest } from '../types';
import BicycleModel from '../models/BicycleModel';
import User from '../models/User';
import UserPackage from '../models/UserPackage';
import Notification from '../models/Notification';
import * as shippingService from '../services/shippingService';
import { buildFullAddress } from '../utils/address';

const getValidatedGeoPoint = (coordinates: any): { type: 'Point'; coordinates: number[] } | null | undefined => {
    if (!coordinates) {
        return undefined;
    }

    if (
        coordinates.type !== 'Point'
        || !Array.isArray(coordinates.coordinates)
        || coordinates.coordinates.length !== 2
        || coordinates.coordinates.some((value: unknown) => typeof value !== 'number' || !Number.isFinite(value))
    ) {
        return null;
    }

    return {
        type: 'Point' as const,
        coordinates: coordinates.coordinates
    };
};

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
            provinceId,
            provinceName,
            search,
            page = 1,
            limit = 10,
            sort = '-createdAt'  // Mặc định sort mới nhất
        } = req.query;
        const filter: any = {};
        if (provinceId || provinceName) {
            const locationConditions: any[] = [];
            if (provinceId) {
                locationConditions.push({ 'location.provinceId': Number(provinceId) });
            }
            if (provinceName) {
                const nameRegex = new RegExp(provinceName as string, 'i');
                locationConditions.push({ 'location.provinceName': nameRegex });
                locationConditions.push({ 'location.city': nameRegex });
            }
            if (locationConditions.length > 0) {
                filter.$or = locationConditions;
            }
        }

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

        const activePackage = await UserPackage.findOne({
            userId: req.user._id,
            status: 'ACTIVE'
        });

        if (!activePackage) {
            res.status(403).json({
                success: false,
                message: 'Bạn chưa có gói đăng tin. Vui lòng mua gói để tiếp tục.'
            });
            return;
        }

        if (activePackage.postRemaining <= 0) {
            res.status(403).json({
                success: false,
                message: `Bạn đã dùng hết ${activePackage.package.postLimit} lượt đăng của gói "${activePackage.package.name}". Vui lòng mua gói mới.`
            });
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

        const resolvedLocation = await shippingService.resolveGhnLocationNames(
            location.provinceId,
            location.districtId,
            location.wardCode
        );
        if (!resolvedLocation) {
            res.status(400).json({
                success: false,
                message: 'Invalid GHN location data'
            });
            return;
        }

        const geoPoint = getValidatedGeoPoint(location.coordinates);
        if (location.coordinates && !geoPoint) {
            res.status(400).json({
                success: false,
                message: 'Invalid map coordinates. Please provide [longitude, latitude].'
            });
            return;
        }

        const locationData = {
            provinceId: location.provinceId,
            districtId: location.districtId,
            wardCode: location.wardCode,
            provinceName: resolvedLocation.provinceName,
            districtName: resolvedLocation.districtName,
            wardName: resolvedLocation.wardName,
            street: location.street,
            fullAddress: buildFullAddress({
                street: location.street,
                wardName: resolvedLocation.wardName,
                districtName: resolvedLocation.districtName,
                provinceName: resolvedLocation.provinceName
            }),
            coordinates: geoPoint ?? undefined
        };

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
            location: locationData,
            images: images
        });

        await UserPackage.findByIdAndUpdate(activePackage._id, {
            $inc: { postedUsed: 1, postRemaining: -1 }
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
        if (location) {
            const resolvedLocation = await shippingService.resolveGhnLocationNames(
                location.provinceId,
                location.districtId,
                location.wardCode
            );
            if (!resolvedLocation) {
                res.status(400).json({
                    success: false,
                    message: 'Invalid GHN location data'
                });
                return;
            }

            const geoPoint = getValidatedGeoPoint(location.coordinates);
            if (location.coordinates && !geoPoint) {
                res.status(400).json({
                    success: false,
                    message: 'Invalid map coordinates. Please provide [longitude, latitude].'
                });
                return;
            }

            updateData.location = {
                provinceId: location.provinceId,
                districtId: location.districtId,
                wardCode: location.wardCode,
                provinceName: resolvedLocation.provinceName,
                districtName: resolvedLocation.districtName,
                wardName: resolvedLocation.wardName,
                street: location.street,
                fullAddress: buildFullAddress({
                    street: location.street,
                    wardName: resolvedLocation.wardName,
                    districtName: resolvedLocation.districtName,
                    provinceName: resolvedLocation.provinceName
                }),
                coordinates: geoPoint ?? undefined
            };
        }
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

// POST /api/bicycles/:id/request-inspection
export const requestInspection = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const { id } = req.params;
        const user = req.user;

        if (!user) {
            res.status(401).json({
                success: false,
                message: 'User not authenticated'
            });
            return;
        }

        const bicycle = await Bicycle.findById(id);
        if (!bicycle) {
            res.status(404).json({
                success: false,
                message: 'Bicycle not found'
            });
            return;
        }

        // Verify ownership
        if (bicycle.seller._id.toString() !== user._id.toString()) {
            res.status(403).json({
                success: false,
                message: 'You can only request inspection for your own bicycles'
            });
            return;
        }

        // Check bicycle status
        if (bicycle.status !== 'PENDING') {
            res.status(400).json({
                success: false,
                message: 'Inspection can only be requested for bicycles with PENDING status'
            });
            return;
        }

        // Check inspection status (prevent duplicate requests)
        if (bicycle.inspectionStatus !== 'PENDING') {
            res.status(400).json({
                success: false,
                message: `Inspection already ${bicycle.inspectionStatus!.toLowerCase()}. Cannot request again.`
            });
            return;
        }

        // Update inspection status
        bicycle.inspectionStatus = 'REQUESTED';
        await bicycle.save();

        // Notify all admins
        const admins = await User.find({ roles: 'ADMIN', isActive: true }).select('_id');
        if (admins.length > 0) {
            const notifications = admins.map(admin => ({
                userId: admin._id,
                type: 'INSPECTION_REQUESTED' as const,
                title: 'New Inspection Request',
                content: `Seller ${user.fullName || user.email} has requested inspection for: ${bicycle.title}`,
                metadata: { bicycleId: bicycle._id }
            }));
            await Notification.insertMany(notifications);
        }

        res.status(200).json({
            success: true,
            message: 'Inspection requested successfully. An admin will assign an inspector shortly.',
            data: {
                bicycleId: bicycle._id,
                title: bicycle.title,
                inspectionStatus: bicycle.inspectionStatus
            }
        });
    } catch (error: any) {
        console.error('Request inspection error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to request inspection'
        });
    }
};

// GET /api/users/inspection-requests
export const getMyInspectionRequests = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const user = req.user;

        if (!user) {
            res.status(401).json({
                success: false,
                message: 'User not authenticated'
            });
            return;
        }

        const { status, page = '1', limit = '10' } = req.query;

        const filter: any = {
            'seller._id': user._id,
            inspectionStatus: { $ne: 'PENDING' }
        };

        // Optional: filter by specific inspection status
        if (status) {
            filter.inspectionStatus = status;
        }

        const pageNum = Math.max(1, Number(page));
        const limitNum = Math.min(50, Math.max(1, Number(limit)));
        const skip = (pageNum - 1) * limitNum;

        const [bicycles, total] = await Promise.all([
            Bicycle.find(filter)
                .select('title price condition status inspectionStatus images createdAt')
                .sort('-updatedAt')
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
        console.error('Get inspection requests error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch inspection requests'
        });
    }
};
