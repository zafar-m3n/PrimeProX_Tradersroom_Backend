const { KycDocument, User } = require("../../models");
const { sendEmail } = require("../../utils/emailUtil");
const { resSuccess, resError } = require("../../utils/responseUtil");

const getAllKycDocuments = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const offset = (page - 1) * limit;

    const whereClause = {};
    if (status) {
      whereClause.status = status;
    }

    const { count, rows } = await KycDocument.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          attributes: ["id", "full_name", "email"],
        },
      ],
      order: [["submitted_at", "DESC"]],
      offset: parseInt(offset),
      limit: parseInt(limit),
    });

    resSuccess(res, {
      total: count,
      page: parseInt(page),
      totalPages: Math.ceil(count / limit),
      documents: rows,
    });
  } catch (error) {
    console.error("Error in getAllKycDocuments:", error);
    resError(res, error.message);
  }
};

const approveKycDocument = async (req, res) => {
  try {
    const { id } = req.params;

    const kycDoc = await KycDocument.findByPk(id, {
      include: [{ model: User, attributes: ["full_name", "email"] }],
    });

    if (!kycDoc) {
      return resError(res, "KYC document not found.", 404);
    }

    if (kycDoc.status !== "pending") {
      return resError(res, "Only pending documents can be approved.", 400);
    }

    kycDoc.status = "approved";
    kycDoc.verified_at = new Date();
    await kycDoc.save();

    const logoUrl = "https://crm.primeprox.com/assets/logo-CotXpXqE.png";
    const documentTypeMap = {
      id_card: "Identity Card",
      drivers_license: "Driver’s License",
      utility_bill: "Utility Bill",
    };
    const documentTypeLabel = documentTypeMap[kycDoc.document_type] || "KYC Document";

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; color: #333; background-color: #fff; padding: 20px; border-radius: 8px; text-align: center;">
        <div style="margin-bottom: 20px;">
          <img src="${logoUrl}" alt="PrimeProX Logo" style="max-width: 150px; height: auto;" />
        </div>
        <h2 style="color: #0a0a0a;">Hello ${kycDoc.User.full_name},</h2>
        <p style="font-size: 15px; line-height: 1.6;">
          We are pleased to inform you that your ${documentTypeLabel} has been <strong>approved</strong>.
        </p>
        <p style="font-size: 15px; line-height: 1.6;">
          Your account is now fully verified, and you can enjoy uninterrupted access to all features of PrimeProX.
        </p>
        <p style="margin-top: 30px; font-size: 14px; color: #555;">
          — The PrimeProX Team
        </p>
      </div>
    `;

    await sendEmail(kycDoc.User.email, "KYC Document Approved", emailHtml);

    resSuccess(res, { message: "KYC document approved and user notified." });
  } catch (error) {
    console.error("Error in approveKycDocument:", error);
    resError(res, error.message);
  }
};

const rejectKycDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const { admin_note } = req.body;

    const kycDoc = await KycDocument.findByPk(id, {
      include: [{ model: User, attributes: ["full_name", "email"] }],
    });

    if (!kycDoc) {
      return resError(res, "KYC document not found.", 404);
    }

    if (kycDoc.status !== "pending") {
      return resError(res, "Only pending documents can be rejected.", 400);
    }

    kycDoc.status = "rejected";
    kycDoc.admin_note = admin_note || "Rejected by admin";
    kycDoc.verified_at = new Date();
    await kycDoc.save();

    const logoUrl = "https://crm.primeprox.com/assets/logo-CotXpXqE.png";
    const documentTypeMap = {
      id_card: "Identity Card",
      drivers_license: "Driver’s License",
      utility_bill: "Utility Bill",
    };
    const documentTypeLabel = documentTypeMap[kycDoc.document_type] || "KYC Document";

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; color: #333; background-color: #fff; padding: 20px; border-radius: 8px; text-align: center;">
        <div style="margin-bottom: 20px;">
          <img src="${logoUrl}" alt="PrimeProX Logo" style="max-width: 150px; height: auto;" />
        </div>
        <h2 style="color: #0a0a0a;">Hello ${kycDoc.User.full_name},</h2>
        <p style="font-size: 15px; line-height: 1.6;">
          We regret to inform you that your ${documentTypeLabel} has been <strong>rejected</strong>.
        </p>
        <p style="font-size: 15px; line-height: 1.6;">
          <strong>Reason:</strong> ${kycDoc.admin_note}
        </p>
        <p style="font-size: 15px; line-height: 1.6;">
          Please review your document and resubmit it to complete your verification with PrimeProX.
        </p>
        <p style="margin-top: 30px; font-size: 14px; color: #555;">
          — The PrimeProX Team
        </p>
      </div>
    `;

    await sendEmail(kycDoc.User.email, "KYC Document Rejected", emailHtml);

    resSuccess(res, { message: "KYC document rejected and user notified." });
  } catch (error) {
    console.error("Error in rejectKycDocument:", error);
    resError(res, error.message);
  }
};

module.exports = {
  getAllKycDocuments,
  approveKycDocument,
  rejectKycDocument,
};
