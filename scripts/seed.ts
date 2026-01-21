import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Brand from '../models/Brand';
import Category from '../models/Category';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || '';

const brandsSeedData = [
    {
        name: 'Giant',
        country: 'Taiwan',
        imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4f/Giant_logo.svg/1200px-Giant_logo.svg.png',
        isActive: true
    },
    {
        name: 'Trek',
        country: 'USA',
        imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/84/Trek_Bicycle_Corporation_logo.svg/1200px-Trek_Bicycle_Corporation_logo.svg.png',
        isActive: true
    },
    {
        name: 'Specialized',
        country: 'USA',
        imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8c/Specialized_logo.svg/1200px-Specialized_logo.svg.png',
        isActive: true
    },
    {
        name: 'Cannondale',
        country: 'USA',
        imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Cannondale_logo.svg/1200px-Cannondale_logo.svg.png',
        isActive: true
    },
    {
        name: 'Scott',
        country: 'Switzerland',
        imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8b/Scott_Sports_logo.svg/1200px-Scott_Sports_logo.svg.png',
        isActive: true
    }
];

const categoriesSeedData = [
    {
        name: 'Mountain Bike',
        description: 'Xe đạp leo núi, phù hợp cho địa hình gồ ghề và đường mòn',
        imageUrl: 'https://example.com/images/mountain-bike.jpg',
        isActive: true
    },
    {
        name: 'Road Bike',
        description: 'Xe đạp đường trường, thiết kế nhẹ và khí động học cho tốc độ cao',
        imageUrl: 'https://example.com/images/road-bike.jpg',
        isActive: true
    },
    {
        name: 'City Bike',
        description: 'Xe đạp thành phố, tiện lợi cho việc di chuyển hàng ngày',
        imageUrl: 'https://example.com/images/city-bike.jpg',
        isActive: true
    },
    {
        name: 'BMX',
        description: 'Xe đạp BMX cho các màn biểu diễn và đua tốc độ ngắn',
        imageUrl: 'https://example.com/images/bmx.jpg',
        isActive: true
    },
    {
        name: 'Electric Bike',
        description: 'Xe đạp điện, hỗ trợ động cơ điện giúp di chuyển dễ dàng',
        imageUrl: 'https://example.com/images/electric-bike.jpg',
        isActive: true
    }
];

const seedDatabase = async () => {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        console.log('\nClearing old data...');
        await Brand.deleteMany({});
        await Category.deleteMany({});
        console.log('Old data cleared');

        console.log('\nSeeding Brands...');
        const brands = await Brand.insertMany(brandsSeedData);
        console.log(`Added ${brands.length} brands`);

        console.log('\nSeeding Categories...');
        const categories = await Category.insertMany(categoriesSeedData);
        console.log(`Added ${categories.length} categories`);

        console.log('\nSeed completed successfully!');
        console.log('=====================================');
        console.log('Brands:', brands.map(b => b.name).join(', '));
        console.log('Categories:', categories.map(c => c.name).join(', '));
        console.log('=====================================');

    } catch (error) {
        console.error('Seed failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\nDisconnected from MongoDB');
        process.exit(0);
    }
};

seedDatabase();
