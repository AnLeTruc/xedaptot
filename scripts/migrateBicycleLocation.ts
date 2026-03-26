import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Bicycle from '../models/Bicycle';
import User from '../models/User';

// Tải biến môi trường (Lấy đường dẫn MONGODB_URI)
dotenv.config();

async function runMigration() {
    try {
        console.log('Đang kết nối Database...');
        await mongoose.connect(process.env.MONGODB_URI as string);
        console.log('✅ Đã kết nối MongoDB thành công');

        // Tìm MỌI chiếc xe đang bị KHUYẾT phone hoặc fullName trong location
        const oldBicycles = await Bicycle.find({
            $or: [
                { 'location.phone': { $exists: false } },
                { 'location.fullName': { $exists: false } }
            ]
        });

        console.log(`Tiến hành vá dữ liệu cho ${oldBicycles.length} xe đạp cũ...`);

        let updatedCount = 0;
        for (const bike of oldBicycles) {
            // Tìm thông tin gốc của người bán (Seller) trong bảng User
            const seller = await User.findById(bike.seller._id);

            // Ưu tiên SĐT của User, nếu ổng cũng không có thì gài cứng thành "0000000000" để lách luật Required
            const phone = seller?.phone || '0000000000';
            // Ưu tiên tên của User > Tên seller lưu tại Bicycle > "Không rõ tên"
            const fullName = seller?.fullName || bike.seller.fullName || 'Người bán (Chưa cập nhật)';

            // Dùng updateOne để vã trực tiếp vào Database (Bypass Validation của "save()")
            await Bicycle.updateOne(
                { _id: bike._id },
                {
                    $set: {
                        'location.phone': phone,
                        'location.fullName': fullName
                    }
                }
            );

            updatedCount++;
        }

        console.log(`🎉 Fix thành công ${updatedCount} chiếc xe! Data đã sạch sẽ.`);
        process.exit(0);

    } catch (error) {
        console.error('❌ Có lỗi xảy ra trong quá trình Migrate:', error);
        process.exit(1);
    }
}


runMigration();
