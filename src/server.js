const express = require('express');
const cors = require('cors');
const route = require('./route/index');
const connectDB = require('./config/Connect');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const { google } = require('googleapis');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
const port = 5000;

// Danh sách các origin được phép
const allowedOrigins = [
    'http://localhost:3000', // Development
    'https://thuvien2.vercel.app', // Frontend trên Vercel
    'https://latn.onrender.com',
];

// Cấu hình CORS
app.use(cors({
    origin: function (origin, callback) {
        if (!origin ||
            allowedOrigins.includes(origin) ||
            /^https:\/\/thuvien2(-[a-z0-9-]+)?\.vercel\.app$/.test(origin)) {
            callback(null, true);
        } else {
            console.error(`[${new Date().toISOString()}] CORS blocked origin: ${origin}`);
            callback(new Error(`CORS policy: Origin ${origin} is not allowed`));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
}));

// Middleware
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Middleware ghi log yêu cầu
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} from origin: ${req.headers.origin}`);
    if (req.method === 'POST' && req.url === '/api/login') {
        console.log(`Login request body:`, req.body);
    }
    next();
});

// Route mặc định cho root (/)
app.get('/', (req, res) => {
    res.status(200).json({ message: 'Welcome to the API' });
});

// Route để chạy cancelUnconfirmedBorrows
const ControllerHandleBook = require('./Controller/ControlerHandleBook');
app.get('/api/cancelUnconfirmedBorrows', async (req, res) => {
    try {
        await ControllerHandleBook.cancelUnconfirmedBorrows(req, res);
    } catch (error) {
        console.error(`[${new Date().toISOString()}] Error in cancelUnconfirmedBorrows:`, error);
        res.status(500).json({ success: false, message: 'Lỗi khi thực thi cron job!' });
    }
});

// Áp dụng các route từ index.js
route(app);

// Xử lý các route không tồn tại (404)
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Connect to MongoDB
connectDB().then(() => {
    console.log('MongoDB connected, starting email notifications...');

    const ControllerEmail = require('./Controller/ControllerEmail');

    (async () => {
        try {
            await ControllerEmail.notifyOverdue(null, null);
            console.log('notifyOverdue executed successfully.');
        } catch (error) {
            console.error(`[${new Date().toISOString()}] Error in notifyOverdue:`, error);
        }

        try {
            await ControllerEmail.notifyDueSoon(null, null);
            console.log('notifyDueSoon executed successfully.');
        } catch (error) {
            console.error(`[${new Date().toISOString()}] Error in notifyDueSoon:`, error);
        }
    })();
}).catch((error) => {
    console.error(`[${new Date().toISOString()}] Failed to connect to MongoDB:`, error);
});

// Google OAuth2 for email
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;
const REFRESH_TOKEN = process.env.REFRESH_TOKEN;

const oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
oAuth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

module.exports = app;