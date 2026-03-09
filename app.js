require('dotenv').config();
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const cors = require('cors');
const connectDB = require('./config/db');
const { setupSwagger } = require('./config/swagger');
const { generalLimiter, authLimiter } = require('./middleware/rateLimiter');
const { startCleanupJob } = require('./services/cleanupService');
const { releaseFundsJob } = require('./jobs/releaseFunds');
const cron = require('node-cron');
const { cleanupExpiredOrdersJob } = require('./jobs/cleanupOrders');

// Start Cronjobs
startCleanupJob();
//Cronjob releasing funds
cron.schedule('* * * * *', releaseFundsJob);
cron.schedule('* * * * *', cleanupExpiredOrdersJob); // Run every minute for testing, can be adjusted to hourly 0 * * * * later
console.log('[Cronjob] Jobs scheduled (Release Funds & Cleanup Expired)');

//Routes
const authRouter = require('./routes/auth').default;
const userRouter = require('./routes/user').default;
const brandRouter = require('./routes/brand').default;
const categoryRouter = require('./routes/category').default;
const bicycleRouter = require('./routes/bicycle').default;
const uploadRouter = require('./routes/uploadRoutes').default;
const packageRouter = require('./routes/package').default;
const adminInspectorRouter = require('./routes/admin/inspector').default;
const adminUserRouter = require('./routes/admin/user').default;
const inspectorRouter = require('./routes/inspector').default;
const orderRouter = require('./routes/order').default;
const bicycleModelRouter = require('./routes/bicycleModel').default;
const walletRouter = require('./routes/wallet').default;
const shippingRouter = require('./routes/shipping').default;
var app = express();

// Trust proxy for Render
app.set('trust proxy', 1);

connectDB();

const corsOptions = {
    origin: process.env.CORS_ORIGINS
        ? process.env.CORS_ORIGINS.split(',').map(s => s.trim())
        : ['http://localhost:3000', 'http://localhost:5000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    maxAge: 86400,
    optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(generalLimiter);

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
setupSwagger(app);

app.use('/api/auth', authLimiter, authRouter);
app.use('/api/users', userRouter);
app.use('/api/brands', brandRouter);
app.use('/api/categories', categoryRouter);
app.use('/api/bicycles', bicycleRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/packages', packageRouter);
app.use('/api/admin', adminInspectorRouter);
app.use('/api/admin', adminUserRouter);
app.use('/api/inspectors', inspectorRouter);
app.use('/api/orders', orderRouter);
app.use('/api/bicycle-models', bicycleModelRouter);
app.use('/api/wallets', walletRouter);
app.use('/api/shipping', shippingRouter);
module.exports = app;
