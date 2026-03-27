const {
  DepositMethod,
  DepositMethodBankDetail,
  DepositMethodCryptoDetail,
  DepositMethodOtherDetail,
  DepositRequest,
  User,
} = require("../models");
const { sendEmail } = require("../utils/emailUtil");
const { resSuccess, resError } = require("../utils/responseUtil");

// Get all active deposit methods with details
const getActiveDepositMethods = async (req, res) => {
  try {
    const methods = await DepositMethod.findAll({
      where: { status: "active" },
      include: [
        { model: DepositMethodBankDetail },
        { model: DepositMethodCryptoDetail },
        { model: DepositMethodOtherDetail },
      ],
    });

    resSuccess(res, { methods });
  } catch (error) {
    console.error("Error in getActiveDepositMethods:", error);
    resError(res, error.message);
  }
};

// Create a new deposit request
const createDepositRequest = async (req, res) => {
  try {
    const userId = req.user.id;
    const { method_id, amount, transaction_reference } = req.body;

    if (!method_id || !amount) {
      return resError(res, "Method and amount are required.", 400);
    }

    const method = await DepositMethod.findByPk(method_id);
    if (!method || method.status !== "active") {
      return resError(res, "Deposit method not found or inactive.", 404);
    }

    let proofPath = null;
    if (req.file) {
      proofPath = req.file.path;
    }

    await DepositRequest.create({
      user_id: userId,
      method_id,
      amount,
      transaction_reference: transaction_reference || null,
      proof_path: proofPath,
      status: "pending",
    });

    const user = await User.findByPk(userId);

    const logoUrl = "https://crm.primeprox.com/assets/logo-CotXpXqE.png";

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; color: #333; background-color: #fff; padding: 20px; border-radius: 8px; text-align: center;">
        <div style="margin-bottom: 20px;">
          <img src="${logoUrl}" alt="PrimeProX Logo" style="max-width: 150px; height: auto;" />
        </div>
        <h2 style="color: #0a0a0a;">Hello ${user.full_name},</h2>
        <p style="font-size: 15px; line-height: 1.6;">
          We have received your deposit request of <strong>$${amount}</strong>.
        </p>
        <p style="font-size: 15px; line-height: 1.6;">
          Our review team will verify your deposit and update your wallet balance as soon as possible. You will be notified once it's processed.
        </p>
        <p style="font-size: 15px; line-height: 1.6;">
          Thank you for choosing PrimeProX. If you have any questions, feel free to contact our support team.
        </p>
        <p style="margin-top: 30px; font-size: 14px; color: #555;">
          — The PrimeProX Team
        </p>
      </div>
    `;

    await sendEmail(user.email, "Deposit Request Submitted", emailHtml);

    resSuccess(res, { message: "Deposit request submitted successfully." }, 201);
  } catch (error) {
    console.error("Error in createDepositRequest:", error);
    resError(res, error.message);
  }
};

module.exports = {
  getActiveDepositMethods,
  createDepositRequest,
};
