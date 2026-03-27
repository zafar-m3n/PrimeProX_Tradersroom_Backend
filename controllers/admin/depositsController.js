const {
  DepositMethod,
  DepositMethodBankDetail,
  DepositMethodCryptoDetail,
  DepositMethodOtherDetail,
  DepositRequest,
  WalletTransaction,
  User,
} = require("../../models");
const { sendEmail } = require("../../utils/emailUtil");
const { resSuccess, resError } = require("../../utils/responseUtil");

const createDepositMethod = async (req, res) => {
  try {
    const { type, name, status } = req.body;

    if (!type || !name) {
      return resError(res, "Type and name are required.", 400);
    }

    const depositMethod = await DepositMethod.create({
      type,
      name,
      status: status || "active",
    });

    const methodId = depositMethod.id;

    if (type === "bank") {
      const { beneficiary_name, bank_name, branch, account_number, ifsc_code } = req.body;
      await DepositMethodBankDetail.create({
        method_id: methodId,
        beneficiary_name,
        bank_name,
        branch,
        account_number,
        ifsc_code,
      });
    } else if (type === "crypto") {
      const { network, address } = req.body;
      const qr_code_path = req.files?.qr_code?.[0]?.path || null;
      const logo_path = req.files?.logo?.[0]?.path || null;

      await DepositMethodCryptoDetail.create({
        method_id: methodId,
        network,
        address,
        qr_code_path,
        logo_path,
      });
    } else if (type === "other") {
      const { notes } = req.body;
      const qr_code_path = req.files?.qr_code?.[0]?.path || null;
      const logo_path = req.files?.logo?.[0]?.path || null;

      await DepositMethodOtherDetail.create({
        method_id: methodId,
        qr_code_path,
        logo_path,
        notes,
      });
    }

    resSuccess(res, { message: "Deposit method created successfully." }, 201);
  } catch (error) {
    console.error("Error in createDepositMethod:", error);
    resError(res, error.message);
  }
};

const getAllDepositMethods = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const { count, rows } = await DepositMethod.findAndCountAll({
      offset: parseInt(offset),
      limit: parseInt(limit),
      order: [["created_at", "DESC"]],
    });

    resSuccess(res, {
      total: count,
      page: parseInt(page),
      totalPages: Math.ceil(count / limit),
      methods: rows,
    });
  } catch (error) {
    console.error("Error in getAllDepositMethods:", error);
    resError(res, error.message);
  }
};

const getDepositMethodById = async (req, res) => {
  try {
    const { id } = req.params;

    const method = await DepositMethod.findByPk(id);
    if (!method) {
      return resError(res, "Deposit method not found.", 404);
    }

    let details = null;
    if (method.type === "bank") {
      details = await DepositMethodBankDetail.findOne({ where: { method_id: id } });
    } else if (method.type === "crypto") {
      details = await DepositMethodCryptoDetail.findOne({ where: { method_id: id } });
    } else if (method.type === "other") {
      details = await DepositMethodOtherDetail.findOne({ where: { method_id: id } });
    }

    resSuccess(res, { method, details });
  } catch (error) {
    console.error("Error in getDepositMethodById:", error);
    resError(res, error.message);
  }
};

const updateDepositMethod = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, status } = req.body;

    const method = await DepositMethod.findByPk(id);
    if (!method) {
      return resError(res, "Deposit method not found.", 404);
    }

    method.name = name ?? method.name;
    method.status = status ?? method.status;
    await method.save();

    if (method.type === "bank") {
      await DepositMethodBankDetail.update(
        {
          beneficiary_name: req.body.beneficiary_name,
          bank_name: req.body.bank_name,
          branch: req.body.branch,
          account_number: req.body.account_number,
          ifsc_code: req.body.ifsc_code,
        },
        { where: { method_id: id } },
      );
    } else if (method.type === "crypto") {
      await DepositMethodCryptoDetail.update(
        {
          network: req.body.network,
          address: req.body.address,
          qr_code_path: req.files?.qr_code?.[0]?.path,
          logo_path: req.files?.logo?.[0]?.path,
        },
        { where: { method_id: id } },
      );
    } else if (method.type === "other") {
      await DepositMethodOtherDetail.update(
        {
          qr_code_path: req.files?.qr_code?.[0]?.path,
          logo_path: req.files?.logo?.[0]?.path,
          notes: req.body.notes,
        },
        { where: { method_id: id } },
      );
    }

    resSuccess(res, { message: "Deposit method updated successfully." });
  } catch (error) {
    console.error("Error in updateDepositMethod:", error);
    resError(res, error.message);
  }
};

const toggleDepositMethodStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const method = await DepositMethod.findByPk(id);
    if (!method) {
      return resError(res, "Deposit method not found.", 404);
    }

    method.status = status;
    await method.save();

    resSuccess(res, { message: `Deposit method status updated to ${status}.` });
  } catch (error) {
    console.error("Error in toggleDepositMethodStatus:", error);
    resError(res, error.message);
  }
};

const approveDepositRequest = async (req, res) => {
  try {
    const { id } = req.params;

    const depositRequest = await DepositRequest.findByPk(id, {
      include: [{ model: User, attributes: ["full_name", "email"] }],
    });

    if (!depositRequest) {
      return resError(res, "Deposit request not found.", 404);
    }

    if (depositRequest.status !== "pending") {
      return resError(res, "Only pending requests can be approved.", 400);
    }

    depositRequest.status = "approved";
    await depositRequest.save();

    await WalletTransaction.create({
      user_id: depositRequest.user_id,
      type: "deposit",
      amount: depositRequest.amount,
      reference_id: depositRequest.id,
      description: "Deposit approved by admin",
    });

    const logoUrl = "https://crm.primeprox.com/assets/logo-CotXpXqE.png";

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; color: #333; background-color: #fff; padding: 20px; border-radius: 8px; text-align: center;">
        <div style="margin-bottom: 20px;">
          <img src="${logoUrl}" alt="PrimeProX Logo" style="max-width: 150px; height: auto;" />
        </div>
        <h2 style="color: #0a0a0a;">Hello ${depositRequest.User.full_name},</h2>
        <p style="font-size: 15px; line-height: 1.6;">
          We are pleased to inform you that your deposit request of <strong>$${depositRequest.amount}</strong> has been <strong>approved</strong>.
          Your wallet balance has been updated accordingly.
        </p>
        <p style="font-size: 15px; line-height: 1.6;">
          Thank you for choosing PrimeProX. We look forward to supporting your trading journey.
        </p>
        <p style="margin-top: 30px; font-size: 14px; color: #555;">
          — The PrimeProX Team
        </p>
      </div>
    `;

    await sendEmail(depositRequest.User.email, "Deposit Request Approved", emailHtml);

    resSuccess(res, { message: "Deposit request approved and wallet updated." });
  } catch (error) {
    console.error("Error in approveDepositRequest:", error);
    resError(res, error.message);
  }
};

const rejectDepositRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { admin_note } = req.body;

    const depositRequest = await DepositRequest.findByPk(id, {
      include: [{ model: User, attributes: ["full_name", "email"] }],
    });

    if (!depositRequest) {
      return resError(res, "Deposit request not found.", 404);
    }

    if (depositRequest.status !== "pending") {
      return resError(res, "Only pending requests can be rejected.", 400);
    }

    depositRequest.status = "rejected";
    depositRequest.admin_note = admin_note || "Rejected by admin";
    await depositRequest.save();

    const logoUrl = "https://crm.primeprox.com/assets/logo-CotXpXqE.png";

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; color: #333; background-color: #fff; padding: 20px; border-radius: 8px; text-align: center;">
        <div style="margin-bottom: 20px;">
          <img src="${logoUrl}" alt="PrimeProX Logo" style="max-width: 150px; height: auto;" />
        </div>
        <h2 style="color: #0a0a0a;">Hello ${depositRequest.User.full_name},</h2>
        <p style="font-size: 15px; line-height: 1.6;">
          We regret to inform you that your deposit request of <strong>$${depositRequest.amount}</strong> has been <strong>rejected</strong>.
        </p>
        <p style="font-size: 15px; line-height: 1.6;">
          <strong>Reason:</strong> ${depositRequest.admin_note}
        </p>
        <p style="font-size: 15px; line-height: 1.6;">
          If you have any questions or need further clarification, please contact our support team.
        </p>
        <p style="margin-top: 30px; font-size: 14px; color: #555;">
          — The PrimeProX Team
        </p>
      </div>
    `;

    await sendEmail(depositRequest.User.email, "Deposit Request Rejected", emailHtml);

    resSuccess(res, { message: "Deposit request rejected and user notified." });
  } catch (error) {
    console.error("Error in rejectDepositRequest:", error);
    resError(res, error.message);
  }
};

const getAllDepositRequests = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const { count, rows } = await DepositRequest.findAndCountAll({
      include: [
        {
          model: User,
          attributes: ["id", "full_name", "email"],
        },
        {
          model: DepositMethod,
          attributes: ["id", "name", "type"],
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
    console.error("Error in getAllDepositRequests:", error);
    resError(res, error.message);
  }
};

module.exports = {
  createDepositMethod,
  getAllDepositMethods,
  getDepositMethodById,
  updateDepositMethod,
  toggleDepositMethodStatus,
  approveDepositRequest,
  rejectDepositRequest,
  getAllDepositRequests,
};
