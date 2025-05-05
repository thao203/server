const express = require('express');
const router = express.Router();
const ControllerEmail = require('../Controller/ControllerEmail');

router.post('/api/sendOTP', ControllerEmail.sendOTP); 
router.post('/api/notifyOverdue', ControllerEmail.notifyOverdue);
router.post('/api/notifyDueSoon', ControllerEmail.notifyDueSoon);
module.exports = router;
