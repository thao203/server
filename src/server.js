const express = require('express');
const cors = require('cors');
const route = require('./route/index');
const connectDB = require('./config/Connect');
const cookieParser = require('cookie-parser');
const app = express();
const port = process.env.PORT || 5000; // Dùng biến môi trường PORT cho Vercel
const bodyParser = require('body-parser');

app.use(cookieParser());

// Cấu hình CORS
const allowedOrigins = [
    'http://localhost:3000',
    'http://192.168.1.15:3000',
    'https://thuvien2.vercel.app', // Thêm domain frontend trên Vercel
    // Nếu không biết chính xác domain, có thể dùng '*' tạm thời để debug
];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.log('CORS blocked origin:', origin); // Debug
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true, // Cho phép gửi cookie
}));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Định nghĩa route
route(app);

// Kết nối database
connectDB();

const { google } = require('googleapis');
const nodemailer = require('nodemailer');
require('dotenv').config();

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;
const REFRESH_TOKEN = process.env.REFRESH_TOKEN;

const oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
oAuth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

// Khởi động server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

// Xuất ứng dụng cho Vercel
module.exports = app;
