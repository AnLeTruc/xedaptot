require('dotenv').config();
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const cors = require('cors');
const connectDB = require('./config/db');
const { setupSwagger } = require('./config/swagger');
const { generalLimiter, authLimiter } = require('./middleware/rateLimiter');

//Routes
const authRouter = require('./routes/auth').default;
const brandRouter = require('./routes/brand').default;
const categoryRouter = require('./routes/category').default;
const uploadRouter = require('./routes/upload').default;

var app = express();

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
app.use('/api/brands', brandRouter);
app.use('/api/categories', categoryRouter);
app.use('/api/upload', uploadRouter);

module.exports = app;
