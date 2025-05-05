const express = require('express');
const cors = require('cors');
const route = require('./route/index');
const connectDB = require('./config/Connect');
const cookieParser = require('cookie-parser');
const port = 5000;
const bodyParser = require('body-parser');
const { google } = require('googleapis');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();

// Middleware
app.use(cookieParser());
const allowedOrigins = ['http://localhost:3000', 'http://192.168.1.15:3000', 'https://thuvien2.vercel.app'];
app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.log('CORS blocked origin:', origin);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

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
        console.error('Error in cancelUnconfirmedBorrows cron:', error);
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
            console.error('Error in notifyOverdue:', error);
        }

        try {
            await ControllerEmail.notifyDueSoon(null, null);
            console.log('notifyDueSoon executed successfully.');
        } catch (error) {
            console.error('Error in notifyDueSoon:', error);
        }
    })();
}).catch((error) => {
    console.error('Failed to connect to MongoDB', error);
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
