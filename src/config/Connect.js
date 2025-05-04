const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async () => {
    try {
        console.log("MongoDB URI:", process.env.CONNECT_DB); // Log URI để debug

        await mongoose.connect(process.env.CONNECT_DB, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });

        console.log('MongoDB connected');
    } catch (error) {
        console.error('Failed to connect to MongoDB', error);
    }
};

module.exports = connectDB;
