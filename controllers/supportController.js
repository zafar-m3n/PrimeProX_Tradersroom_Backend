const { SupportTicket, SupportTicketMessage, User } = require("../models");
const { Op } = require("sequelize");
const path = require("path");
const { sendEmail } = require("../utils/emailUtil");
const { resSuccess, resError } = require("../utils/responseUtil");

// === Create new support ticket ===
const createTicket = async (req, res) => {
  try {
    const userId = req.user.id;
    const { subject, category, message } = req.body;

    if (!subject || !category || !message) {
      return resError(res, "Subject, category, and message are required.", 400);
    }

    const ticket = await SupportTicket.create({
      user_id: userId,
      subject,
      category,
      status: "open",
    });

    let attachmentPath = null;
    if (req.file) {
      attachmentPath = req.file.path;
    }

    await SupportTicketMessage.create({
      ticket_id: ticket.id,
      sender: "client",
      message,
      attachment_path: attachmentPath,
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
          We have received your support ticket with the subject <strong>"${subject}"</strong>.
        </p>
        <p style="font-size: 15px; line-height: 1.6;">
          Our support team will review your message and get back to you as soon as possible.
        </p>
        <p style="font-size: 15px; line-height: 1.6;">
          Thank you for reaching out to us. We appreciate your patience and will resolve your concern promptly.
        </p>
        <p style="margin-top: 30px; font-size: 14px; color: #555;">
          — The PrimeProX Support Team
        </p>
      </div>
    `;

    await sendEmail(user.email, "Support Ticket Submitted", emailHtml);

    resSuccess(res, { message: "Support ticket created successfully.", ticket_id: ticket.id }, 201);
  } catch (error) {
    console.error("Error in createTicket:", error);
    resError(res, error.message);
  }
};

// === Get all tickets of the current user ===
const getMyTickets = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const { count, rows } = await SupportTicket.findAndCountAll({
      where: { user_id: userId },
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
    console.error("Error in getMyTickets:", error);
    resError(res, error.message);
  }
};

// === Get single ticket details including messages ===
const getTicketById = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const ticket = await SupportTicket.findOne({
      where: { id, user_id: userId },
      include: [
        {
          model: SupportTicketMessage,
          order: [["created_at", "ASC"]],
        },
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

// === Send message to ticket ===
const sendMessageToTicket = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { message } = req.body;

    if (!message) {
      return resError(res, "Message is required.", 400);
    }

    const ticket = await SupportTicket.findOne({
      where: { id, user_id: userId },
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
      sender: "client",
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
          Your reply to the support ticket titled <strong>"${ticket.subject}"</strong> has been received successfully.
        </p>
        <p style="font-size: 15px; line-height: 1.6;">
          Our support team has been notified and will review your latest message promptly.
        </p>
        <p style="font-size: 15px; line-height: 1.6;">
          Thank you for keeping us updated. We appreciate your patience.
        </p>
        <p style="margin-top: 30px; font-size: 14px; color: #555;">
          — The PrimeProX Support Team
        </p>
      </div>
    `;

    await sendEmail(ticket.User.email, "Support Ticket Reply Received", emailHtml);

    resSuccess(res, { message: "Reply sent successfully." }, 201);
  } catch (error) {
    console.error("Error in sendMessageToTicket:", error);
    resError(res, error.message);
  }
};

module.exports = {
  createTicket,
  getMyTickets,
  getTicketById,
  sendMessageToTicket,
};
