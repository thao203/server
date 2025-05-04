const express = require('express');
const router = express.Router();

const ControllerClearanceBooks = require('../Controller/ControllerClearanceBooks');

// Các sub-route cho Clearance Books
router.get('/export', ControllerClearanceBooks.exportClearanceBooks);
router.get('/all', ControllerClearanceBooks.getAllClearanceBooks);
router.post('/add', ControllerClearanceBooks.addClearanceBook);
router.delete('/delete', ControllerClearanceBooks.deleteClearanceBook);
router.put('/edit', ControllerClearanceBooks.editClearanceBook);
router.post('/change-status', ControllerClearanceBooks.changeClearanceBookStatus);

module.exports = router;