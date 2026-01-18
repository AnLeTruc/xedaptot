require('dotenv').config();
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const connectDB = require('./config/db');
const { setupSwagger } = require('./config/swagger');
var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');

var app = express();

connectDB();



app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
setupSwagger(app);

app.use('/', indexRouter);
app.use('/users', usersRouter);

module.exports = app;
