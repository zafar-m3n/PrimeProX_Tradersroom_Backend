const express = require("express");
const router = express.Router();

const {
  getAllUsers,
  createUser,
  getUserById,
  updateUser,
  deleteUser,
  approveUserAccount,
} = require("../../controllers/admin/userController");

const authenticate = require("../../middlewares/authMiddleware");
const authorizeRoles = require("../../middlewares/roleMiddleware");

// Protect all routes: must be admin
router.use(authenticate);
router.use(authorizeRoles("admin"));

// Get all users
router.get("/", getAllUsers);

// Create a new user
router.post("/", createUser);

// Get single user by ID
router.get("/:id", getUserById);

// Update user
router.patch("/:id", updateUser);

// Delete user
router.delete("/:id", deleteUser);

// Approve user account
router.patch("/:id/approve", approveUserAccount);

module.exports = router;
