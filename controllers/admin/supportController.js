const { SupportTicket, SupportTicketMessage, User } = require("../../models");
const { sendEmail } = require("../../utils/emailUtil");
const { resSuccess, resError } = require("../../utils/responseUtil");

// Get all tickets
const getAllTickets = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const offset = (page - 1) * limit;

    const whereClause = {};
    if (status) {
      whereClause.status = status;
    }

    const { count, rows } = await SupportTicket.findAndCountAll({
      where: whereClause,
      include: [{ model: User, attributes: ["id", "full_name", "email"] }],
      order: [["created_at", "DESC"]],
      offset: parseInt(offset),
      limit: parseInt(limit),
    });

    resSuccess(res, {
      total: count,
      page: parseInt(page),
      totalPages: Math.ceil(count / limit),
      tickets: rows,
    });
  } catch (error) {
    console.error("Error in getAllTickets:", error);
    resError(res, error.message);
  }
};

// Get single ticket with messages
const getTicketById = async (req, res) => {
  try {
    const { id } = req.params;

    const ticket = await SupportTicket.findByPk(id, {
      include: [
        { model: User, attributes: ["id", "full_name", "email"] },
        { model: SupportTicketMessage, order: [["created_at", "ASC"]] },
      ],
    });

    if (!ticket) {
      return resError(res, "Ticket not found.", 404);
    }

    resSuccess(res, { ticket });
  } catch (error) {
    console.error("Error in getTicketById:", error);
    resError(res, error.message);
  }
};

// Send admin reply to ticket
const sendMessageToTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;

    if (!message) {
      return resError(res, "Message is required.", 400);
    }

    const ticket = await SupportTicket.findByPk(id, {
      include: [{ model: User, attributes: ["full_name", "email"] }],
    });

    if (!ticket) {
      return resError(res, "Ticket not found.", 404);
    }

    let attachmentPath = null;
    if (req.file) {
      attachmentPath = req.file.path;
    }

    await SupportTicketMessage.create({
      ticket_id: ticket.id,
      sender: "admin",
      message,
      attachment_path: attachmentPath,
    });

    const logoUrl = "https://crm.primeprox.com/assets/logo-CotXpXqE.png";

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; color: #333; background-color: #fff; padding: 20px; border-radius: 8px; text-align: center;">
        <div style="margin-bottom: 20px;">
          <img src="${logoUrl}" alt="PrimeProX Logo" style="max-width: 150px; height: auto;" />
        </div>
        <h2 style="color: #0a0a0a;">Hello ${ticket.User.full_name},</h2>
        <p style="font-size: 15px; line-height: 1.6;">
          You have received a new reply to your support ticket: <strong>${ticket.subject}</strong>.
        </p>
        <p style="font-size: 15px; line-height: 1.6;">
          Please log in to your PrimeProX account to view the full response and continue the conversation.
        </p>
        <p style="margin-top: 30px; font-size: 14px; color: #555;">
          — The PrimeProX Support Team
        </p>
      </div>
    `;

    await sendEmail(ticket.User.email, "New Reply to Your Support Ticket", emailHtml);

    resSuccess(res, { message: "Reply sent successfully and user notified." }, 201);
  } catch (error) {
    console.error("Error in sendMessageToTicket:", error);
    resError(res, error.message);
  }
};

// Close a ticket
const closeTicket = async (req, res) => {
  try {
    const { id } = req.params;

    const ticket = await SupportTicket.findByPk(id, {
      include: [{ model: User, attributes: ["full_name", "email"] }],
    });

    if (!ticket) {
      return resError(res, "Ticket not found.", 404);
    }

    if (ticket.status === "closed") {
      return resError(res, "Ticket is already closed.", 400);
    }

    ticket.status = "closed";
    await ticket.save();

    const logoUrl = "https://crm.primeprox.com/assets/logo-CotXpXqE.png";

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; color: #333; background-color: #fff; padding: 20px; border-radius: 8px; text-align: center;">
        <div style="margin-bottom: 20px;">
          <img src="${logoUrl}" alt="PrimeProX Logo" style="max-width: 150px; height: auto;" />
        </div>
        <h2 style="color: #0a0a0a;">Hello ${ticket.User.full_name},</h2>
        <p style="font-size: 15px; line-height: 1.6;">
          We wanted to let you know that your support ticket titled <strong>${ticket.subject}</strong> has been closed.
        </p>
        <p style="font-size: 15px; line-height: 1.6;">
          If you have any further questions or need assistance, feel free to open a new ticket anytime.
        </p>
        <p style="margin-top: 30px; font-size: 14px; color: #555;">
          — The PrimeProX Support Team
        </p>
      </div>
    `;

    await sendEmail(ticket.User.email, "Your Support Ticket Has Been Closed", emailHtml);

    resSuccess(res, { message: "Ticket closed successfully and user notified." });
  } catch (error) {
    console.error("Error in closeTicket:", error);
    resError(res, error.message);
  }
};

module.exports = {
  getAllTickets,
  getTicketById,
  sendMessageToTicket,
  closeTicket,
};
