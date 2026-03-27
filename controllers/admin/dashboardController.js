const { User, DepositRequest, WithdrawalRequest, KycDocument, SupportTicket } = require("../../models");
const { Op } = require("sequelize");
const { resSuccess, resError } = require("../../utils/responseUtil");

// Get Admin Dashboard Stats
const getDashboardStats = async (req, res) => {
  try {
    // Exclude superadmin
    const excludeSuperAdmin = {
      id: {
        [Op.ne]: 1,
      },
    };

    // Users
    const totalUsers = await User.count({
      where: excludeSuperAdmin,
    });

    const totalClients = await User.count({
      where: {
        role: "client",
        id: {
          [Op.ne]: 1,
        },
      },
    });

    const verifiedEmails = await User.count({
      where: {
        email_verified: true,
        id: {
          [Op.ne]: 1,
        },
      },
    });

    // Deposits
    const totalDeposits = await DepositRequest.count();
    const pendingDeposits = await DepositRequest.count({ where: { status: "pending" } });
    const approvedDeposits = await DepositRequest.count({ where: { status: "approved" } });
    const rejectedDeposits = await DepositRequest.count({ where: { status: "rejected" } });
    const totalDepositAmount = await DepositRequest.sum("amount", { where: { status: "approved" } });

    // Withdrawals
    const totalWithdrawals = await WithdrawalRequest.count();
    const pendingWithdrawals = await WithdrawalRequest.count({ where: { status: "pending" } });
    const approvedWithdrawals = await WithdrawalRequest.count({ where: { status: "approved" } });
    const rejectedWithdrawals = await WithdrawalRequest.count({ where: { status: "rejected" } });
    const totalWithdrawAmount = await WithdrawalRequest.sum("amount", { where: { status: "approved" } });

    // KYC Documents
    const totalKyc = await KycDocument.count();
    const pendingKyc = await KycDocument.count({ where: { status: "pending" } });
    const approvedKyc = await KycDocument.count({ where: { status: "approved" } });
    const rejectedKyc = await KycDocument.count({ where: { status: "rejected" } });

    // Support Tickets
    const totalTickets = await SupportTicket.count();
    const openTickets = await SupportTicket.count({ where: { status: "open" } });
    const closedTickets = await SupportTicket.count({
      where: {
        status: {
          [Op.in]: ["resolved", "closed"],
        },
      },
    });

    // Send response using helper
    resSuccess(res, {
      users: {
        total: totalUsers,
        clients: totalClients,
        verifiedEmails,
      },
      deposits: {
        total: totalDeposits,
        pending: pendingDeposits,
        approved: approvedDeposits,
        rejected: rejectedDeposits,
        totalAmount: totalDepositAmount || 0,
      },
      withdrawals: {
        total: totalWithdrawals,
        pending: pendingWithdrawals,
        approved: approvedWithdrawals,
        rejected: rejectedWithdrawals,
        totalAmount: totalWithdrawAmount || 0,
      },
      kyc: {
        total: totalKyc,
        pending: pendingKyc,
        approved: approvedKyc,
        rejected: rejectedKyc,
      },
      tickets: {
        total: totalTickets,
        open: openTickets,
        closed: closedTickets,
      },
    });
  } catch (error) {
    console.error("Error in getDashboardStats:", error);
    resError(res, error.message);
  }
};

module.exports = {
  getDashboardStats,
};
