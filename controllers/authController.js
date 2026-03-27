const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { User } = require("../models");
const { sendEmail } = require("../utils/emailUtil");
const { resSuccess, resError } = require("../utils/responseUtil");
require("dotenv").config();

/* ---------- Register ---------- */
const register = async (req, res) => {
  const { full_name, email, password, phone_number, country_code, promo_code } = req.body;
  try {
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return resError(res, "Email already in use.", 400);
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);
    const verification_token = crypto.randomBytes(32).toString("hex");

    const newUser = await User.create({
      full_name,
      email,
      password_hash,
      phone_number,
      country_code,
      promo_code: promo_code || null,
      verification_token,
      role: "client",
    });

    const verifyUrl = `${process.env.NODE_TRADERSROOM_CLIENT_URL}/verify-email?token=${verification_token}`;
    const logoUrl = "https://crm.primeprox.com/assets/logo-CotXpXqE.png";

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; color: #333; background-color: #fff; padding: 20px; border-radius: 8px; text-align: center;">
        <div style="margin-bottom: 20px;">
          <img src="${logoUrl}" alt="PrimeProX Logo" style="max-width: 150px; height: auto;" />
        </div>
        <h2 style="color: #0a0a0a;">Hello ${full_name},</h2>
        <p style="font-size: 15px; line-height: 1.6;">
          Thank you for registering with PrimeProX. Please verify your email to activate your account.
        </p>
        <div style="margin: 30px 0;">
          <a href="${verifyUrl}" style="background-color: #309f6d; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
            Verify Email
          </a>
        </div>
        <p style="font-size: 15px; line-height: 1.6;">
          If you did not sign up for an PrimeProX account, please ignore this email.
        </p>
        <p style="margin-top: 30px; font-size: 14px; color: #555;">
          — The PrimeProX Team
        </p>
      </div>
    `;

    await sendEmail(email, "Verify Your Email", emailHtml);

    resSuccess(res, { message: "Registration successful! Please check your email to verify your account." }, 201);
  } catch (err) {
    console.error("Error in register:", err);
    resError(res, err.message);
  }
};

/* ---------- Email verification ---------- */
const verifyEmail = async (req, res) => {
  const { token } = req.query;
  try {
    const user = await User.findOne({ where: { verification_token: token } });
    if (!user) {
      return resError(res, "Invalid or expired verification token.", 400);
    }

    user.email_verified = true;
    user.verification_token = null;
    await user.save();

    resSuccess(res, { message: "Email verified successfully. You can now log in." });
  } catch (err) {
    console.error("Error in verifyEmail:", err);
    resError(res, err.message);
  }
};

/* ---------- Login ---------- */
const login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return resError(res, "Invalid email or password.", 400);
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return resError(res, "Invalid email or password.", 400);
    }

    if (!user.email_verified) {
      return resError(res, "Please verify your email before logging in.", 400);
    }

    const payload = {
      id: user.id,
      role: user.role,
    };

    const token = jwt.sign(payload, process.env.NODE_TRADERSROOM_JWT_SECRET, {
      expiresIn: "1d",
    });

    resSuccess(res, {
      message: "Login successful.",
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        phone_number: user.phone_number,
        country_code: user.country_code,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("Error in login:", err);
    resError(res, err.message);
  }
};

/* ---------- Forgot password ---------- */
const forgotPassword = async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return resError(res, "User with this email does not exist.", 400);
    }

    const reset_token = crypto.randomBytes(32).toString("hex");
    const reset_token_expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    user.reset_token = reset_token;
    user.reset_token_expiry = reset_token_expiry;
    await user.save();

    const resetUrl = `${process.env.NODE_TRADERSROOM_CLIENT_URL}/reset-password?token=${reset_token}`;
    const logoUrl = "https://crm.primeprox.com/assets/logo-CotXpXqE.png";

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; color: #333; background-color: #fff; padding: 20px; border-radius: 8px; text-align: center;">
        <div style="margin-bottom: 20px;">
          <img src="${logoUrl}" alt="PrimeProX Logo" style="max-width: 150px; height: auto;" />
        </div>
        <h2 style="color: #0a0a0a;">Hello ${user.full_name},</h2>
        <p style="font-size: 15px; line-height: 1.6;">
          We received a request to reset your password for your PrimeProX account.
        </p>
        <div style="margin: 30px 0;">
          <a href="${resetUrl}" style="background-color: #309f6d; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
            Reset Password
          </a>
        </div>
        <p style="font-size: 15px; line-height: 1.6;">
          If you did not request a password reset, please ignore this email or contact our support team.
        </p>
        <p style="margin-top: 30px; font-size: 14px; color: #555;">
          — The PrimeProX Team
        </p>
      </div>
    `;

    await sendEmail(email, "Password Reset Request", emailHtml);

    resSuccess(res, { message: "Password reset email sent." });
  } catch (err) {
    console.error("Error in forgotPassword:", err);
    resError(res, err.message);
  }
};

/* ---------- Reset password ---------- */
const resetPassword = async (req, res) => {
  const { token } = req.query;
  const { password } = req.body;
  try {
    const user = await User.findOne({ where: { reset_token: token } });
    if (!user || user.reset_token_expiry < new Date()) {
      return resError(res, "Invalid or expired reset token.", 400);
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    user.password_hash = password_hash;
    user.reset_token = null;
    user.reset_token_expiry = null;
    await user.save();

    resSuccess(res, { message: "Password reset successful. You can now log in." });
  } catch (err) {
    console.error("Error in resetPassword:", err);
    resError(res, err.message);
  }
};

/* ---------- Export all functions ---------- */
module.exports = {
  register,
  verifyEmail,
  login,
  forgotPassword,
  resetPassword,
};
