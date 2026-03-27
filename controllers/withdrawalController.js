const { WithdrawalMethod, WithdrawalRequest, WalletTransaction, KycDocument, User } = require("../models");
const { sendEmail } = require("../utils/emailUtil");
const { resSuccess, resError } = require("../utils/responseUtil");

// === Get active withdrawal methods for user ===
const getActiveWithdrawalMethodsByUserId = async (req, res) => {
  try {
    const userId = req.user.id;

    const methods = await WithdrawalMethod.findAll({
      where: { user_id: userId, status: "active" },
    });

    resSuccess(res, { methods });
  } catch (error) {
    console.error("Error in getActiveWithdrawalMethodsByUserId:", error);
    resError(res, error.message);
  }
};

// === Create withdrawal request ===
const createWithdrawalRequest = async (req, res) => {
  try {
    const userId = req.user.id;
    const { method_id, amount, note } = req.body;

    if (!method_id || !amount) {
      return resError(res, "Method and amount are required.", 400);
    }

    const method = await WithdrawalMethod.findOne({
      where: { id: method_id, user_id: userId, status: "active" },
      include: [{ model: User, attributes: ["full_name", "email"] }],
    });

    if (!method) {
      return resError(res, "Withdrawal method not found or inactive.", 404);
    }

    const withdrawalRequest = await WithdrawalRequest.create({
      user_id: userId,
      method_id,
      amount,
      note: note || null,
      status: "pending",
    });

    const logoUrl = "https://crm.primeprox.com/assets/logo-CotXpXqE.png";
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; color: #333; background-color: #fff; padding: 20px; border-radius: 8px; text-align: center;">
        <div style="margin-bottom: 20px;">
          <img src="${logoUrl}" alt="PrimeProX Logo" style="max-width: 150px; height: auto;" />
        </div>
        <h2 style="color: #0a0a0a;">Hello ${method.User.full_name},</h2>
        <p style="font-size: 15px; line-height: 1.6;">
          Your withdrawal request for <strong>$${amount}</strong> has been submitted successfully.
        </p>
        <p style="font-size: 15px; line-height: 1.6;">
          Our team will review and process your request as soon as possible. You will receive a notification once it is approved or if any additional information is required.
        </p>
        <p style="margin-top: 30px; font-size: 14px; color: #555;">
          — The PrimeProX Team
        </p>
      </div>
    `;

    await sendEmail(method.User.email, "Withdrawal Request Submitted", emailHtml);

    resSuccess(res, { message: "Withdrawal request submitted successfully." }, 201);
  } catch (error) {
    console.error("Error in createWithdrawalRequest:", error);
    resError(res, error.message);
  }
};

// === Check withdrawal eligibility ===
const getWithdrawalEligibility = async (req, res) => {
  try {
    const userId = req.user.id;

    const approvedKycDocs = await KycDocument.findAll({
      where: {
        user_id: userId,
        status: "approved",
      },
    });

    const hasIdDoc = approvedKycDocs.some(
      (doc) => doc.document_type === "id_card" || doc.document_type === "drivers_license",
    );

    const hasUtilityBill = approvedKycDocs.some((doc) => doc.document_type === "utility_bill");

    if (!hasIdDoc || !hasUtilityBill) {
      return resSuccess(res, {
        eligible: false,
        reason: "KYC documents not fully verified (ID and utility bill required).",
      });
    }

    const activeMethodsCount = await WithdrawalMethod.count({
      where: { user_id: userId, status: "active" },
    });

    if (activeMethodsCount === 0) {
      return resSuccess(res, {
        eligible: false,
        reason: "No active withdrawal methods added.",
      });
    }

    const [{ total_balance }] = await WalletTransaction.findAll({
      where: { user_id: userId },
      attributes: [[WalletTransaction.sequelize.fn("SUM", WalletTransaction.sequelize.col("amount")), "total_balance"]],
      raw: true,
    });

    const balance = parseFloat(total_balance) || 0;

    if (balance <= 0) {
      return resSuccess(res, {
        eligible: false,
        reason: "Insufficient wallet balance.",
      });
    }

    resSuccess(res, {
      eligible: true,
      balance,
    });
  } catch (error) {
    console.error("Error in getWithdrawalEligibility:", error);
    resError(res, error.message);
  }
};

module.exports = {
  getActiveWithdrawalMethodsByUserId,
  createWithdrawalRequest,
  getWithdrawalEligibility,
};
