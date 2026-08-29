const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const authMiddleware = require('../middleware/authMiddleware');

// Payment Gateway routes (all authenticated)
router.post('/create-order', authMiddleware, paymentController.createOrder);
router.post('/verify', authMiddleware, paymentController.verifyPayment);
router.post('/retry', authMiddleware, paymentController.retryPayment);
router.get('/order-status/:orderId', authMiddleware, paymentController.getOrderStatus);

// Payment webhook (no auth - Cashfree calls this)
// This route is mounted separately in server.js with raw body middleware
router.post('/webhook', paymentController.handleWebhook);

module.exports = router;
