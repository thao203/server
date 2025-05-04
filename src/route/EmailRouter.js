const express = require('express');
const router = express.Router();
const ControllerEmail = require('../Controller/ControllerEmail');

router.post('/api/sendOTP', ControllerEmail.sendOTP); 
router.post('/api/notifyDueSoon', ControllerEmail.notifyDueSoon);
router.post('/api/notifyOverdue', ControllerEmail.notifyOverdue);
module.exports = router;