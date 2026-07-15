const express = require("express");
const morgan = require("morgan");
const colors = require("colors");
const dotenv = require("dotenv");
const cors = require("cors");
const { connectDB } = require("./config/database");

// ✅ Load env variables
dotenv.config();

// ✅ Connect to Database
connectDB();

// ✅ Create Express App
const app = express();

// ✅ Middleware
app.use(express.json());
app.use(morgan("dev"));

app.use(
  cors({
    origin: [`${process.env.NODE_TRADERSROOM_FRONTEND_URL}`, "http://localhost:5173"],
    credentials: true,
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  })
);

// ✅ Serve static uploads folder
app.use("/uploads", express.static("uploads"));

// ✅ Routes
const authRoutes = require("./routes/authRoutes");
const adminDepositRoutes = require("./routes/admin/depositRoutes");
const adminDepositRequestRoutes = require("./routes/admin/depositRequestRoutes");
const adminWithdrawalRequestRoutes = require("./routes/admin/withdrawalRequestRoutes");
const adminKycRoutes = require("./routes/admin/kycRoutes");
const adminUserRoutes = require("./routes/admin/userRoutes");
const adminWalletAdjustmentRoutes = require("./routes/admin/walletAdjustmentRoutes");
const adminSupportRoutes = require("./routes/admin/supportRoutes");
const adminDashboardRoutes = require("./routes/admin/dashboardRoutes");
const clientDepositRoutes = require("./routes/depositRoutes");
const clientWithdrawalRoutes = require("./routes/withdrawalRoutes");
const clientWalletRoutes = require("./routes/walletRoutes");
const clientProfileRoutes = require("./routes/profileRoutes");
const clientSupportRoutes = require("./routes/supportRoutes");

// ✅ Use Routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/admin/deposit-methods", adminDepositRoutes);
app.use("/api/v1/admin/deposit-requests", adminDepositRequestRoutes);
app.use("/api/v1/admin/withdrawal-requests", adminWithdrawalRequestRoutes);
app.use("/api/v1/admin/kyc-documents", adminKycRoutes);
app.use("/api/v1/admin/users", adminUserRoutes);
app.use("/api/v1/admin/users", adminWalletAdjustmentRoutes);
app.use("/api/v1/admin/support-tickets", adminSupportRoutes);
app.use("/api/v1/admin/dashboard", adminDashboardRoutes); 
app.use("/api/v1/client", clientDepositRoutes);
app.use("/api/v1/client", clientWithdrawalRoutes);
app.use("/api/v1/client/wallet", clientWalletRoutes);
app.use("/api/v1/client/profile", clientProfileRoutes);
app.use("/api/v1/client/support-tickets", clientSupportRoutes);

// ✅ Root Route
app.get("/", (req, res) => {
  res.status(200).json({ message: "API is running..." });
});

// ✅ Define Port
const PORT = process.env.NODE_TRADERSROOM_PORT || 8080;

// ✅ Start Server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} in ${process.env.NODE_TRADERSROOM_MODE} mode`.bgCyan.white);
});
