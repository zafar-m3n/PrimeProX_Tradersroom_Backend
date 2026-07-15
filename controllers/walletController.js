const { WalletTransaction, DepositRequest, DepositMethod, WithdrawalRequest, WithdrawalMethod } = require("../models");
const { resSuccess, resError } = require("../utils/responseUtil");

// === Get wallet balance ===
const getWalletBalance = async (req, res) => {
  try {
    const userId = req.user.id;

    const [{ total_balance }] = await WalletTransaction.findAll({
      where: { user_id: userId },
      attributes: [[WalletTransaction.sequelize.fn("SUM", WalletTransaction.sequelize.col("amount")), "total_balance"]],
      raw: true,
    });

    const totalBalance = total_balance || 0;

    resSuccess(res, { balance: parseFloat(totalBalance) });
  } catch (error) {
    console.error("Error in getWalletBalance:", error);
    resError(res, error.message);
  }
};

// === Get deposit history ===
const getDepositHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const { count, rows } = await DepositRequest.findAndCountAll({
      where: { user_id: userId },
      include: [
        {
          model: DepositMethod,
          attributes: ["name", "type"],
        },
      ],
      order: [["created_at", "DESC"]],
      offset: parseInt(offset),
      limit: parseInt(limit),
    });

    resSuccess(res, {
      total: count,
      page: parseInt(page),
      totalPages: Math.ceil(count / limit),
      deposits: rows,
    });
  } catch (error) {
    console.error("Error in getDepositHistory:", error);
    resError(res, error.message);
  }
};

// === Get withdrawal history ===
const getWithdrawalHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const { count, rows } = await WithdrawalRequest.findAndCountAll({
      where: { user_id: userId },
      include: [
        {
          model: WithdrawalMethod,
        },
      ],
      order: [["created_at", "DESC"]],
      offset: parseInt(offset),
      limit: parseInt(limit),
    });

    resSuccess(res, {
      total: count,
      page: parseInt(page),
      totalPages: Math.ceil(count / limit),
      withdrawals: rows,
    });
  } catch (error) {
    console.error("Error in getWithdrawalHistory:", error);
    resError(res, error.message);
  }
};

// === Get adjustment history ===
const getAdjustmentHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const { count, rows } = await WalletTransaction.findAndCountAll({
      where: { user_id: userId, type: "adjustment" },
      order: [["created_at", "DESC"]],
      offset: parseInt(offset),
      limit: parseInt(limit),
    });

    resSuccess(res, {
      total: count,
      page: parseInt(page),
      totalPages: Math.ceil(count / limit),
      adjustments: rows,
    });
  } catch (error) {
    console.error("Error in getAdjustmentHistory:", error);
    resError(res, error.message);
  }
};

module.exports = {
  getWalletBalance,
  getDepositHistory,
  getWithdrawalHistory,
  getAdjustmentHistory,
};
