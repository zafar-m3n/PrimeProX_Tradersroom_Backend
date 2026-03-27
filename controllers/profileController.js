const bcrypt = require("bcrypt");
const { User, KycDocument, WithdrawalMethod } = require("../models");
const { sendEmail } = require("../utils/emailUtil");
const { resSuccess, resError } = require("../utils/responseUtil");

// === Get profile info ===
const getProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: ["id", "full_name", "email", "phone_number", "country_code", "role", "promo_code"],
    });

    if (!user) {
      return resError(res, "User not found.", 404);
    }

    resSuccess(res, { user });
  } catch (error) {
    console.error("Error in getProfile:", error);
    resError(res, error.message);
  }
};

// === Update profile info ===
const updateProfile = async (req, res) => {
  try {
    const { full_name, phone_number, country_code } = req.body;

    const user = await User.findByPk(req.user.id);
    if (!user) {
      return resError(res, "User not found.", 404);
    }

    user.full_name = full_name ?? user.full_name;
    user.phone_number = phone_number ?? user.phone_number;
    user.country_code = country_code ?? user.country_code;

    await user.save();

    resSuccess(res, { message: "Profile updated successfully." });
  } catch (error) {
    console.error("Error in updateProfile:", error);
    resError(res, error.message);
  }
};

// === Upload KYC document ===
const uploadKycDocument = async (req, res) => {
  try {
    const { document_type } = req.body;
    const document_path = req.file?.path;

    if (!document_type || !document_path) {
      return resError(res, "Document type and file are required.", 400);
    }

    const userId = req.user.id;

    let kycDoc = await KycDocument.findOne({
      where: { user_id: userId, document_type },
    });

    if (kycDoc) {
      kycDoc.document_path = document_path;
      kycDoc.status = "pending";
      await kycDoc.save();
    } else {
      kycDoc = await KycDocument.create({
        user_id: userId,
        document_type,
        document_path,
        status: "pending",
      });
    }

    const user = await User.findByPk(userId);

    const documentTypeMap = {
      id_card: "Identity Card",
      drivers_license: "Driver’s License",
      utility_bill: "Utility Bill",
    };
    const documentTypeLabel = documentTypeMap[document_type] || "KYC Document";

    const logoUrl = "https://crm.primeprox.com/assets/logo-CotXpXqE.png";

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; color: #333; background-color: #fff; padding: 20px; border-radius: 8px; text-align: center;">
        <div style="margin-bottom: 20px;">
          <img src="${logoUrl}" alt="PrimeProX Logo" style="max-width: 150px; height: auto;" />
        </div>
        <h2 style="color: #0a0a0a;">Hello ${user.full_name},</h2>
        <p style="font-size: 15px; line-height: 1.6;">
          We have received your <strong>${documentTypeLabel}</strong>. It is now pending review by our verification team.
        </p>
        <p style="font-size: 15px; line-height: 1.6;">
          You will be notified once the verification process is complete. Thank you for helping us keep your account secure.
        </p>
        <p style="margin-top: 30px; font-size: 14px; color: #555;">
          — The PrimeProX Team
        </p>
      </div>
    `;

    await sendEmail(user.email, "KYC Document Submitted", emailHtml);

    resSuccess(res, { message: "KYC document uploaded successfully and pending review." }, 201);
  } catch (error) {
    console.error("Error in uploadKycDocument:", error);
    resError(res, error.message);
  }
};

// === Get all KYC documents for user ===
const getKycDocuments = async (req, res) => {
  try {
    const documents = await KycDocument.findAll({
      where: { user_id: req.user.id },
      order: [["submitted_at", "DESC"]],
    });

    resSuccess(res, { documents });
  } catch (error) {
    console.error("Error in getKycDocuments:", error);
    resError(res, error.message);
  }
};

// === Add withdrawal method ===
const addWithdrawalMethod = async (req, res) => {
  try {
    const { type, bank_name, branch, account_number, account_name, swift_code, iban, network, wallet_address } =
      req.body;

    if (!type) {
      return resError(res, "Withdrawal method type is required.", 400);
    }

    await WithdrawalMethod.create({
      user_id: req.user.id,
      type,
      bank_name,
      branch,
      account_number,
      account_name,
      swift_code,
      iban,
      network,
      wallet_address,
      status: "active",
    });

    resSuccess(res, { message: "Withdrawal method added successfully." }, 201);
  } catch (error) {
    console.error("Error in addWithdrawalMethod:", error);
    resError(res, error.message);
  }
};

// === Get all withdrawal methods for user ===
const getWithdrawalMethods = async (req, res) => {
  try {
    const methods = await WithdrawalMethod.findAll({
      where: { user_id: req.user.id },
      order: [["created_at", "DESC"]],
    });

    resSuccess(res, { methods });
  } catch (error) {
    console.error("Error in getWithdrawalMethods:", error);
    resError(res, error.message);
  }
};

// === Change password ===
const changePassword = async (req, res) => {
  try {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return resError(res, "Current and new passwords are required.", 400);
    }

    const user = await User.findByPk(req.user.id);
    if (!user) {
      return resError(res, "User not found.", 404);
    }

    const isMatch = await bcrypt.compare(current_password, user.password_hash);
    if (!isMatch) {
      return resError(res, "Current password is incorrect.", 400);
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(new_password, salt);

    user.password_hash = password_hash;
    await user.save();

    resSuccess(res, { message: "Password changed successfully." });
  } catch (error) {
    console.error("Error in changePassword:", error);
    resError(res, error.message);
  }
};

module.exports = {
  getProfile,
  updateProfile,
  uploadKycDocument,
  getKycDocuments,
  addWithdrawalMethod,
  getWithdrawalMethods,
  changePassword,
};
