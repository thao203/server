const { google } = require('googleapis');
const nodemailer = require('nodemailer');
const ModelUser = require('../Model/ModelUser');
const ModelReader = require('../Model/ModelReader');
const ModelHandleBook = require('../Model/ModelHandleBook');
const ModelBook = require('../Model/ModelBook');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const moment = require('moment');
require('dotenv').config();

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;
const REFRESH_TOKEN = process.env.REFRESH_TOKEN;
const EMAIL_USER = process.env.EMAIL_USER;

const oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
oAuth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

class ControllerEmail {
    async sendOTP(req, res) {
        try {
            const { masinhvien, email } = req.body;

            if (!masinhvien || !email) {
                return res.status(400).json({ message: 'Vui lòng nhập đầy đủ mã sinh viên và email!' });
            }

            const reader = await ModelReader.findOne({ masinhvien, email });
            if (!reader) {
                return res.status(404).json({ message: 'Mã sinh viên hoặc email không đúng!' });
            }

            const user = await ModelUser.findOne({ masinhvien });
            if (!user) {
                return res.status(404).json({ message: 'Tài khoản không tồn tại!' });
            }

            const otpCode = crypto.randomInt(100000, 999999).toString();
            const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
            const hashedOTP = await bcrypt.hash(otpCode, 10);

            user.otp = hashedOTP;
            user.otpExpires = expiresAt;
            await user.save();

            const accessToken = await oAuth2Client.getAccessToken();
            if (!accessToken.token) {
                return res.status(500).json({ message: 'Không thể lấy accessToken để gửi email!' });
            }

            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    type: 'OAuth2',
                    user: EMAIL_USER,
                    clientId: CLIENT_ID,
                    clientSecret: CLIENT_SECRET,
                    refreshToken: REFRESH_TOKEN,
                    accessToken: accessToken.token,
                },
            });

            const mailOptions = {
                from: `"Hệ Thống Xác Minh" <${EMAIL_USER}>`,
                to: email,
                subject: 'Mã OTP Đặt Lại Mật Khẩu',
                text: `Mã OTP của bạn là: ${otpCode}. Mã này sẽ hết hạn sau 10 phút.`,
            };

            await transporter.sendMail(mailOptions);

            return res.status(200).json({ message: 'OTP đã được gửi qua email!' });
        } catch (error) {
            console.error('Lỗi gửi OTP:', error);
            return res.status(500).json({ message: 'Lỗi server khi gửi OTP!' });
        }
    }

    async notifyDueSoon(req, res) {
        try {
            const today = moment().startOf('day');
            const startThreshold = moment().add(1, 'days').startOf('day'); // Ngày mai
            const endThreshold = moment().add(3, 'days').endOf('day'); // 3 ngày tới

            // Tìm tất cả các phiếu mượn chưa trả ít nhất một quyển và sắp đến hạn
            const borrowRecords = await ModelHandleBook.find({
                ngayhentra: {
                    $gte: startThreshold.toDate(),
                    $lte: endThreshold.toDate(),
                },
                'books.tinhtrang': false, // Có ít nhất một quyển chưa trả
            });

            if (!borrowRecords.length) {
                return res.status(200).json({ message: 'Không có phiếu mượn nào sắp đến hạn trả trong 1-3 ngày!' });
            }

            const accessToken = await oAuth2Client.getAccessToken();
            if (!accessToken.token) {
                return res.status(500).json({ message: 'Không thể lấy accessToken để gửi email!' });
            }

            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    type: 'OAuth2',
                    user: EMAIL_USER,
                    clientId: CLIENT_ID,
                    clientSecret: CLIENT_SECRET,
                    refreshToken: REFRESH_TOKEN,
                    accessToken: accessToken.token,
                },
            });

            const emailPromises = [];

            for (const record of borrowRecords) {
                const reader = await ModelReader.findOne({ masinhvien: record.masinhvien });
                if (!reader || !reader.email) {
                    console.warn(`Không tìm thấy email cho sinh viên ${record.masinhvien}`);
                    continue;
                }

                // Lọc các quyển sách chưa trả trong mảng books
                const dueBooks = record.books.filter(book => !book.tinhtrang);

                if (!dueBooks.length) continue;

                // Lấy thông tin tên sách từ ModelBook
                const bookDetails = await Promise.all(dueBooks.map(async (book) => {
                    const bookInfo = await ModelBook.findOne({ masach: book.masach });
                    return {
                        masach: book.masach,
                        tensach: bookInfo ? bookInfo.tensach : 'Không tìm thấy tên sách',
                    };
                }));

                const dueDate = moment(record.ngayhentra);
                const daysLeft = dueDate.diff(today, 'days');

                // Tạo danh sách chi tiết các quyển sách sắp đến hạn
                const bookList = bookDetails.map(book => `- Mã sách: ${book.masach}, Tên sách: ${book.tensach}`).join('\n');

                const mailOptions = {
                    from: `"Hệ Thống Thư Viện" <${EMAIL_USER}>`,
                    to: reader.email,
                    subject: 'Thông Báo: Sách Sắp Đến Hạn Trả',
                    text: `Chào bạn,\n\nPhiếu mượn của bạn (Mã phiếu: ${record.maphieumuon}) chứa các sách sau sẽ đến hạn trả vào ngày ${dueDate.format('DD/MM/YYYY')}. Còn ${daysLeft} ngày nữa là đến hạn:\n${bookList}\n\nVui lòng trả sách đúng hạn để tránh bị phạt.\n\nTrân trọng,\nHệ Thống Thư Viện`,
                };

                emailPromises.push(transporter.sendMail(mailOptions));
            }

            await Promise.all(emailPromises);

            return res.status(200).json({ message: 'Đã gửi email thông báo đến các sinh viên có sách sắp đến hạn!' });
        } catch (error) {
            console.error('Lỗi khi gửi email thông báo:', error);
            return res.status(500).json({ message: 'Lỗi server khi gửi email thông báo!' });
        }
    }

    async notifyOverdue(req, res) {
        try {
            const today = moment().startOf('day');

            // Tìm tất cả các phiếu mượn quá hạn và chưa trả ít nhất một quyển
            const overdueRecords = await ModelHandleBook.find({
                ngayhentra: { $lt: today.toDate() },
                'books.tinhtrang': false, // Có ít nhất một quyển chưa trả
            });

            if (!overdueRecords.length) {
                return res.status(200).json({ message: 'Không có phiếu mượn nào quá hạn trả!' });
            }

            const accessToken = await oAuth2Client.getAccessToken();
            if (!accessToken.token) {
                return res.status(500).json({ message: 'Không thể lấy accessToken để gửi email!' });
            }

            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    type: 'OAuth2',
                    user: EMAIL_USER,
                    clientId: CLIENT_ID,
                    clientSecret: CLIENT_SECRET,
                    refreshToken: REFRESH_TOKEN,
                    accessToken: accessToken.token,
                },
            });

            const emailPromises = [];

            for (const record of overdueRecords) {
                const reader = await ModelReader.findOne({ masinhvien: record.masinhvien });
                if (!reader || !reader.email) {
                    console.warn(`Không tìm thấy email cho sinh viên ${record.masinhvien}`);
                    continue;
                }

                // Lọc các quyển sách chưa trả trong mảng books
                const overdueBooks = record.books.filter(book => !book.tinhtrang);

                if (!overdueBooks.length) continue;

                // Lấy thông tin tên sách từ ModelBook
                const bookDetails = await Promise.all(overdueBooks.map(async (book) => {
                    const bookInfo = await ModelBook.findOne({ masach: book.masach });
                    return {
                        masach: book.masach,
                        tensach: bookInfo ? bookInfo.tensach : 'Không tìm thấy tên sách',
                    };
                }));

                const dueDate = moment(record.ngayhentra);
                const daysOverdue = today.diff(dueDate, 'days');

                // Tạo danh sách chi tiết các quyển sách quá hạn
                const bookList = bookDetails.map(book => `- Mã sách: ${book.masach}, Tên sách: ${book.tensach}`).join('\n');

                const mailOptions = {
                    from: `"Hệ Thống Thư Viện" <${EMAIL_USER}>`,
                    to: reader.email,
                    subject: 'Cảnh Báo: Sách Quá Hạn Trả',
                    text: `Chào bạn,\n\nPhiếu mượn của bạn (Mã phiếu: ${record.maphieumuon}) chứa các sách sau đã quá hạn trả từ ngày ${dueDate.format('DD/MM/YYYY')} (${daysOverdue} ngày quá hạn):\n${bookList}\n\nVui lòng trả sách ngay lập tức để tránh bị phạt thêm. Liên hệ thư viện để biết thêm chi tiết.\n\nTrân trọng,\nHệ Thống Thư Viện`,
                };

                emailPromises.push(transporter.sendMail(mailOptions));
            }

            await Promise.all(emailPromises);

            return res.status(200).json({ message: 'Đã gửi email cảnh báo đến các sinh viên có sách quá hạn!' });
        } catch (error) {
            console.error('Lỗi khi gửi email cảnh báo quá hạn:', error);
            return res.status(500).json({ message: 'Lỗi server khi gửi email cảnh báo quá hạn!' });
        }
    }
}

module.exports = new ControllerEmail();