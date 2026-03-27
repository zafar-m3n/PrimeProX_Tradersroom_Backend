const { WithdrawalRequest, WithdrawalMethod, User, WalletTransaction } = require("../../models");
const { sendEmail } = require("../../utils/emailUtil");
const { resSuccess, resError } = require("../../utils/responseUtil");

const getAllWithdrawalRequests = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const { count, rows } = await WithdrawalRequest.findAndCountAll({
      include: [
        {
          model: User,
          attributes: ["id", "full_name", "email"],
        },
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
      requests: rows,
    });
  } catch (error) {
    console.error("Error in getAllWithdrawalRequests:", error);
    resError(res, error.message);
  }
};

const approveWithdrawalRequest = async (req, res) => {
  try {
    const { id } = req.params;

    const withdrawalRequest = await WithdrawalRequest.findByPk(id, {
      include: [{ model: User, attributes: ["full_name", "email"] }],
    });

    if (!withdrawalRequest) {
      return resError(res, "Withdrawal request not found.", 404);
    }

    if (withdrawalRequest.status !== "pending") {
      return resError(res, "Only pending requests can be approved.", 400);
    }

    withdrawalRequest.status = "approved";
    await withdrawalRequest.save();

    await WalletTransaction.create({
      user_id: withdrawalRequest.user_id,
      type: "withdrawal",
      amount: -Math.abs(withdrawalRequest.amount),
      reference_id: withdrawalRequest.id,
      description: "Withdrawal approved by admin",
    });

    const logoUrl = "https://crm.primeprox.com/assets/logo-CotXpXqE.png";

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; color: #333; background-color: #fff; padding: 20px; border-radius: 8px; text-align: center;">
        <div style="margin-bottom: 20px;">
          <img src="${logoUrl}" alt="PrimeProX Logo" style="max-width: 150px; height: auto;" />
        </div>
        <h2 style="color: #0a0a0a;">Hello ${withdrawalRequest.User.full_name},</h2>
        <p style="font-size: 15px; line-height: 1.6;">
          We’re pleased to inform you that your withdrawal request of <strong>$${withdrawalRequest.amount}</strong> has been approved.
        </p>
        <p style="font-size: 15px; line-height: 1.6;">
          The funds will be processed and transferred to your selected method shortly.
        </p>
        <p style="margin-top: 30px; font-size: 14px; color: #555;">
          — The PrimeProX Team
        </p>
      </div>
    `;

    await sendEmail(withdrawalRequest.User.email, "Withdrawal Request Approved", emailHtml);

    resSuccess(res, { message: "Withdrawal request approved and wallet updated." });
  } catch (error) {
    console.error("Error in approveWithdrawalRequest:", error);
    resError(res, error.message);
  }
};

const rejectWithdrawalRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { admin_note } = req.body;

    const withdrawalRequest = await WithdrawalRequest.findByPk(id, {
      include: [{ model: User, attributes: ["full_name", "email"] }],
    });

    if (!withdrawalRequest) {
      return resError(res, "Withdrawal request not found.", 404);
    }

    if (withdrawalRequest.status !== "pending") {
      return resError(res, "Only pending requests can be rejected.", 400);
    }

    withdrawalRequest.status = "rejected";
    withdrawalRequest.admin_note = admin_note || "Rejected by admin";
    await withdrawalRequest.save();

    const logoUrl = "https://crm.primeprox.com/assets/logo-CotXpXqE.png";

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; color: #333; background-color: #fff; padding: 20px; border-radius: 8px; text-align: center;">
        <div style="margin-bottom: 20px;">
          <img src="${logoUrl}" alt="PrimeProX Logo" style="max-width: 150px; height: auto;" />
        </div>
        <h2 style="color: #0a0a0a;">Hello ${withdrawalRequest.User.full_name},</h2>
        <p style="font-size: 15px; line-height: 1.6;">
          We regret to inform you that your withdrawal request of <strong>$${withdrawalRequest.amount}</strong> has been rejected.
        </p>
        <p style="font-size: 15px; line-height: 1.6;">
          <strong>Reason:</strong> ${withdrawalRequest.admin_note}
        </p>
        <p style="font-size: 15px; line-height: 1.6;">
          If you have any questions or require further assistance, please feel free to contact our support team.
        </p>
        <p style="margin-top: 30px; font-size: 14px; color: #555;">
          — The PrimeProX Team
        </p>
      </div>
    `;

    await sendEmail(withdrawalRequest.User.email, "Withdrawal Request Rejected", emailHtml);

    resSuccess(res, { message: "Withdrawal request rejected and user notified." });
  } catch (error) {
    console.error("Error in rejectWithdrawalRequest:", error);
    resError(res, error.message);
  }
};

module.exports = {
  getAllWithdrawalRequests,
  approveWithdrawalRequest,
  rejectWithdrawalRequest,
};
