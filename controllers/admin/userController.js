const { User, KycDocument, DepositRequest, WalletTransaction, WithdrawalMethod } = require("../../models");
const bcrypt = require("bcrypt");
const { Op } = require("sequelize");
const { resSuccess, resError } = require("../../utils/responseUtil");

// Create a new user
const createUser = async (req, res) => {
  try {
    const { full_name, email, phone_number, country_code, password, role, promo_code } = req.body;

    if (!full_name || !email || !password) {
      return resError(res, "Full name, email, and password are required.", 400);
    }

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return resError(res, "A user with this email already exists.", 400);
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const newUser = await User.create({
      full_name,
      email,
      phone_number,
      country_code,
      password_hash,
      role: role || "client",
      email_verified: true,
      promo_code: promo_code || null,
    });

    resSuccess(res, { message: "User created successfully.", user: newUser }, 201);
  } catch (error) {
    console.error("Error in createUser:", error);
    resError(res, error.message);
  }
};

// Get all users with optional pagination
const getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const { count, rows } = await User.findAndCountAll({
      where: {
        id: {
          [Op.ne]: 1,
        },
      },
      offset: parseInt(offset),
      limit: parseInt(limit),
      order: [["created_at", "DESC"]],
      attributes: { exclude: ["password_hash", "verification_token", "reset_token", "reset_token_expiry"] },
    });

    resSuccess(res, {
      total: count,
      page: parseInt(page),
      totalPages: Math.ceil(count / limit),
      users: rows,
    });
  } catch (error) {
    console.error("Error in getAllUsers:", error);
    resError(res, error.message);
  }
};

// Get a single user by ID
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByPk(id, {
      attributes: { exclude: ["password_hash", "verification_token", "reset_token", "reset_token_expiry"] },
      include: [
        { model: KycDocument },
        { model: DepositRequest },
        { model: WalletTransaction },
        { model: WithdrawalMethod },
      ],
    });

    if (!user) {
      return resError(res, "User not found.", 404);
    }

    resSuccess(res, { user });
  } catch (error) {
    console.error("Error in getUserById:", error);
    resError(res, error.message);
  }
};

// Update a user's data
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { full_name, email, phone_number, country_code, role, email_verified, password, promo_code } = req.body;

    const user = await User.findByPk(id);
    if (!user) {
      return resError(res, "User not found.", 404);
    }

    // Check if email is changing and ensure it's unique
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ where: { email } });
      if (existingUser) {
        return resError(res, "A user with this email already exists.", 400);
      }
      user.email = email;
    }

    if (full_name !== undefined) user.full_name = full_name;
    if (phone_number !== undefined) user.phone_number = phone_number;
    if (country_code !== undefined) user.country_code = country_code;
    if (role !== undefined) user.role = role;
    if (email_verified !== undefined) user.email_verified = email_verified;
    if (promo_code !== undefined) user.promo_code = promo_code;

    if (password) {
      const salt = await bcrypt.genSalt(10);
      user.password_hash = await bcrypt.hash(password, salt);
    }

    await user.save();

    resSuccess(res, { message: "User updated successfully.", user });
  } catch (error) {
    console.error("Error in updateUser:", error);
    resError(res, error.message);
  }
};

// Delete a user
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByPk(id);
    if (!user) {
      return resError(res, "User not found.", 404);
    }

    await user.destroy();

    resSuccess(res, { message: "User deleted successfully." });
  } catch (error) {
    console.error("Error in deleteUser:", error);
    resError(res, error.message);
  }
};

module.exports = {
  createUser,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
};
