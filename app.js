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

// Start Cronjob
startCleanupJob();

//Routes
const authRouter = require('./routes/auth').default;
const userRouter = require('./routes/user').default;
const brandRouter = require('./routes/brand').default;
const categoryRouter = require('./routes/category').default;
const bicycleRouter = require('./routes/bicycle').default;
const uploadRouter = require('./routes/uploadRoutes').default;
const packageRouter = require('./routes/package').default;

var app = express();

// Trust proxy for Render
app.set('trust proxy', 1);

connectDB();

const corsOptions = {
    origin: [
        'http://localhost:3000',
        'http://localhost:5000',
        'https://xedaptot.onrender.com',
        'http://localhost:5173'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
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

module.exports = app;
