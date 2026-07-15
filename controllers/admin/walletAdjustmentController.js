const { User, WalletTransaction } = require("../../models");
const { sequelize } = require("../../config/database");
const { resSuccess, resError } = require("../../utils/responseUtil");

// === Get a client's wallet balance (admin view) ===
const getUserWalletBalance = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByPk(id);
    if (!user) {
      return resError(res, "User not found.", 404);
    }

    const [{ total_balance }] = await WalletTransaction.findAll({
      where: { user_id: id },
      attributes: [[WalletTransaction.sequelize.fn("SUM", WalletTransaction.sequelize.col("amount")), "total_balance"]],
      raw: true,
    });

    resSuccess(res, { balance: parseFloat(total_balance) || 0 });
  } catch (error) {
    console.error("Error in getUserWalletBalance:", error);
    resError(res, error.message);
  }
};

// === Manually adjust a client's wallet balance ===
const adjustUserBalance = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, description } = req.body;

    const user = await User.findByPk(id);
    if (!user) {
      return resError(res, "User not found.", 404);
    }

    if (user.role !== "client") {
      return resError(res, "Cannot adjust balance for non-client users.", 400);
    }

    const numericAmount = Number(amount);
    if (amount === undefined || amount === null || isNaN(numericAmount) || numericAmount === 0) {
      return resError(res, "Amount must be a valid non-zero number.", 400);
    }

    if (!description || typeof description !== "string" || !description.trim()) {
      return resError(res, "Description is required.", 400);
    }

    const t = await sequelize.transaction();
    try {
      await WalletTransaction.create(
        {
          user_id: user.id,
          type: "adjustment",
          amount: numericAmount,
          description: description.trim(),
        },
        { transaction: t }
      );

      await t.commit();
    } catch (error) {
      await t.rollback();
      throw error;
    }

    const [{ total_balance }] = await WalletTransaction.findAll({
      where: { user_id: id },
      attributes: [[WalletTransaction.sequelize.fn("SUM", WalletTransaction.sequelize.col("amount")), "total_balance"]],
      raw: true,
    });

    resSuccess(res, {
      message: "Wallet balance adjusted successfully.",
      balance: parseFloat(total_balance) || 0,
    });
  } catch (error) {
    console.error("Error in adjustUserBalance:", error);
    resError(res, error.message);
  }
};

module.exports = {
  getUserWalletBalance,
  adjustUserBalance,
};
