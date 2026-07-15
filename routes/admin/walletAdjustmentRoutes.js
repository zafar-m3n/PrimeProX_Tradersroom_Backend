const express = require("express");
const router = express.Router();

const { getUserWalletBalance, adjustUserBalance } = require("../../controllers/admin/walletAdjustmentController");

const authenticate = require("../../middlewares/authMiddleware");
const authorizeRoles = require("../../middlewares/roleMiddleware");

// Protect all routes: must be admin
router.use(authenticate);
router.use(authorizeRoles("admin"));

// Get a client's wallet balance
router.get("/:id/wallet/balance", getUserWalletBalance);

// Manually adjust a client's wallet balance
router.post("/:id/wallet/adjustment", adjustUserBalance);

module.exports = router;
