const nodemailer = require("nodemailer");
require("dotenv").config();

const transporter = nodemailer.createTransport({
  host: process.env.NODE_TRADERSROOM_EMAIL_HOST,
  port: process.env.NODE_TRADERSROOM_EMAIL_PORT,
  secure: true,
  auth: {
    user: process.env.NODE_TRADERSROOM_EMAIL_USER,
    pass: process.env.NODE_TRADERSROOM_EMAIL_PASS,
  },
});

const sendEmail = async (to, subject, html) => {
  try {
    await transporter.sendMail({
      from: `"PrimeProX" <${process.env.NODE_TRADERSROOM_EMAIL_USER}>`,
      to,
      subject,
      html,
    });
  } catch (error) {
    console.error("Error sending email:", error);
    throw new Error("Email sending failed.");
  }
};

module.exports = { sendEmail };
