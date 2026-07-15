# PrimeProX Tradersroom Backend — Codebase Context Summary

## 1. Folder Structure

```
/config           - DB connection (Sequelize), multer (file upload) config
/controllers       - business logic, one file per resource
  /admin           - admin-only controllers (deposits, withdrawals, kyc, users, support, dashboard)
/middlewares       - authMiddleware.js (JWT), roleMiddleware.js (RBAC)
/models            - Sequelize model definitions + index.js (associations)
/routes            - client-facing route files
  /admin           - admin-only route files, mirrors /controllers/admin
/uploads           - multer upload destinations (deposit-methods, deposit-requests, kyc-documents, support-tickets)
/utils             - responseUtil.js (response helpers), emailUtil.js (nodemailer wrapper)
index.js           - app entrypoint: express setup, CORS, route mounting
```

Routing is namespaced at the app level in `index.js`:
- `/api/v1/auth` — auth
- `/api/v1/admin/*` — admin routes (deposit-methods, deposit-requests, withdrawal-requests, kyc-documents, users, support-tickets, dashboard)
- `/api/v1/client/*` — client routes (deposits/withdrawals mounted at bare `/client`, wallet/profile/support-tickets under their own sub-paths)

Stack: Express 5, Sequelize 6 (MySQL via `mysql2`), JWT (`jsonwebtoken`), `bcrypt`, `multer`, `nodemailer`. **No Joi / express-validator** — validation is manual.

---

## 2. Sequelize Models

### `User` (models/User.js)

```js
const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const User = sequelize.define(
  "User",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    full_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    phone_number: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    country_code: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    password_hash: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    promo_code: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    role: {
      type: DataTypes.ENUM("client", "admin"),
      defaultValue: "client",
    },
    email_verified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    verification_token: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    reset_token: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    reset_token_expiry: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "users",
    timestamps: true,
    underscored: true,
  }
);

module.exports = User;
```

No hooks (no `beforeCreate`/`beforeSave` password hashing hook — hashing is done manually in the controller with `bcrypt`, see `authController.js`).

### `WalletTransaction` (models/WalletTransaction.js)

```js
const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const WalletTransaction = sequelize.define(
  "WalletTransaction",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    type: {
      type: DataTypes.ENUM("deposit", "withdrawal", "adjustment"),
      allowNull: false,
    },
    amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    reference_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: "wallet_transactions",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: false,
    underscored: true,
  }
);

module.exports = WalletTransaction;
```

No hooks. Note the `type` ENUM already includes `"adjustment"` as a third transaction type (in addition to `deposit`/`withdrawal`), but nothing in the codebase currently creates `adjustment` rows — it appears reserved for exactly the kind of manual balance-adjustment feature you may be planning.

### Associations (from models/index.js)

```js
User.hasMany(WalletTransaction, { foreignKey: "user_id", onDelete: "CASCADE" });
WalletTransaction.belongsTo(User, { foreignKey: "user_id" });

User.hasMany(DepositRequest, { foreignKey: "user_id", onDelete: "CASCADE" });
DepositRequest.belongsTo(User, { foreignKey: "user_id" });

User.hasMany(WithdrawalRequest, { foreignKey: "user_id", onDelete: "CASCADE" });
WithdrawalRequest.belongsTo(User, { foreignKey: "user_id" });
```

(Plus similar associations for deposit methods, KYC documents, withdrawal methods, and support tickets — omitted here as not directly relevant.)

`DepositRequest` and `WithdrawalRequest` models both have: `user_id`, `method_id`, `amount` (DECIMAL 15,2), `status` ENUM(`pending`,`approved`,`rejected`), `admin_note` (TEXT), plus request-specific fields (`transaction_reference`/`proof_path` for deposits, `note` for withdrawals).

---

## 3. Balance Handling — there is no `balance` column anywhere

The wallet balance is **always computed on the fly** by summing `wallet_transactions.amount` for a user. It is never persisted on the `User` row or cached anywhere. This logic is duplicated in two places:

**`getWalletBalance`** — controllers/walletController.js
```js
const getWalletBalance = async (req, res) => {
  try {
    const userId = req.user.id;

    const [{ total_balance }] = await WalletTransaction.findAll({
      where: { user_id: userId },
      attributes: [[WalletTransaction.sequelize.fn("SUM", WalletTransaction.sequelize.col("amount")), "total_balance"]],
      raw: true,
    });

    const totalBalance = total_balance || 0;

    resSuccess(res, { balance: parseFloat(totalBalance) });
  } catch (error) {
    console.error("Error in getWalletBalance:", error);
    resError(res, error.message);
  }
};
```

**`getWithdrawalEligibility`** — controllers/withdrawalController.js (identical SUM query, duplicated inline)
```js
const [{ total_balance }] = await WalletTransaction.findAll({
  where: { user_id: userId },
  attributes: [[WalletTransaction.sequelize.fn("SUM", WalletTransaction.sequelize.col("amount")), "total_balance"]],
  raw: true,
});

const balance = parseFloat(total_balance) || 0;

if (balance <= 0) {
  return resSuccess(res, { eligible: false, reason: "Insufficient wallet balance." });
}
```

**How rows get created (the only two writers of `wallet_transactions` today):**
- On deposit approval — controllers/admin/depositsController.js: `WalletTransaction.create({ type: "deposit", amount: depositRequest.amount, reference_id: depositRequest.id, ... })` (positive amount)
- On withdrawal approval — controllers/admin/withdrawalRequestController.js: `WalletTransaction.create({ type: "withdrawal", amount: -Math.abs(withdrawalRequest.amount), reference_id: withdrawalRequest.id, ... })` (amount forced negative)

So the convention is: **sign the `amount` at creation time (positive for credits, negative for debits) and derive balance as `SUM(amount)`.** There's no locking/transaction wrapping around "check balance then create transaction then update status" — the approve endpoints just do sequential awaits, no DB transaction. Worth keeping in mind if your new feature does concurrent balance-affecting writes.

---

## 4. Admin Auth

Two-middleware stack applied per-router with `router.use(...)`:

**authMiddleware.js** — verifies JWT, attaches `{ id, role }` to `req.user`
```js
const jwt = require("jsonwebtoken");
require("dotenv").config();

const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Not authorized, token missing." });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.NODE_TRADERSROOM_JWT_SECRET);

    req.user = {
      id: decoded.id,
      role: decoded.role,
    };

    next();
  } catch (err) {
    console.error(err);
    return res.status(401).json({ message: "Not authorized, token invalid or expired." });
  }
};

module.exports = authenticate;
```

**roleMiddleware.js** — role-based gate, takes allowed roles as variadic args
```js
const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: "Access denied. Insufficient permissions." });
    }
    next();
  };
};

module.exports = authorizeRoles;
```

`role` itself lives on the `User` model as `ENUM("client","admin")`, set at registration (`role: "client"` hardcoded in `authController.register`) and embedded in the JWT payload at login (`{ id, role }`).

**End-to-end admin route example** — deposit request approval:

Route (routes/admin/depositRequestRoutes.js):
```js
const express = require("express");
const router = express.Router();

const {
  getAllDepositRequests,
  approveDepositRequest,
  rejectDepositRequest,
} = require("../../controllers/admin/depositsController");

const authenticate = require("../../middlewares/authMiddleware");
const authorizeRoles = require("../../middlewares/roleMiddleware");

// Protect all routes: must be admin
router.use(authenticate);
router.use(authorizeRoles("admin"));

router.get("/", getAllDepositRequests);
router.patch("/:id/approve", approveDepositRequest);
router.patch("/:id/reject", rejectDepositRequest);

module.exports = router;
```

Controller (relevant handler, controllers/admin/depositsController.js):
```js
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

    // ...sends approval email via nodemailer, then:
    resSuccess(res, { message: "Deposit request approved and wallet updated." });
  } catch (error) {
    console.error("Error in approveDepositRequest:", error);
    resError(res, error.message);
  }
};
```

Mounted in `index.js` as `app.use("/api/v1/admin/deposit-requests", adminDepositRequestRoutes)`.

---

## 5. Existing Wallet/Transaction Routes

| Route | Method | Controller | Purpose |
|---|---|---|---|
| `/api/v1/client/wallet/balance` | GET | `walletController.getWalletBalance` | Computed SUM of user's transactions |
| `/api/v1/client/wallet/deposit-history` | GET | `walletController.getDepositHistory` | Paginated `DepositRequest` list |
| `/api/v1/client/wallet/withdrawal-history` | GET | `walletController.getWithdrawalHistory` | Paginated `WithdrawalRequest` list |
| `/api/v1/client/deposits/methods` | GET | `depositController.getActiveDepositMethods` | Active deposit methods for client to choose |
| `/api/v1/client/deposits` | POST | `depositController.createDepositRequest` | Client submits deposit (multer file upload for proof) |
| `/api/v1/client/withdrawals/methods` | GET | `withdrawalController.getActiveWithdrawalMethodsByUserId` | Client's own active withdrawal methods |
| `/api/v1/client/withdrawals` | POST | `withdrawalController.createWithdrawalRequest` | Client submits withdrawal request |
| `/api/v1/client/withdrawals/eligibility` | GET | `withdrawalController.getWithdrawalEligibility` | Checks KYC + methods + balance > 0 |
| `/api/v1/admin/deposit-requests` | GET | `admin/depositsController.getAllDepositRequests` | Admin: list all, paginated |
| `/api/v1/admin/deposit-requests/:id/approve` | PATCH | `admin/depositsController.approveDepositRequest` | Admin: approve + create `WalletTransaction` |
| `/api/v1/admin/deposit-requests/:id/reject` | PATCH | `admin/depositsController.rejectDepositRequest` | Admin: reject, no wallet transaction |
| `/api/v1/admin/withdrawal-requests` | GET | `admin/withdrawalRequestController.getAllWithdrawalRequests` | Admin: list all, paginated |
| `/api/v1/admin/withdrawal-requests/:id/approve` | PATCH | `admin/withdrawalRequestController.approveWithdrawalRequest` | Admin: approve + create negative `WalletTransaction` |
| `/api/v1/admin/withdrawal-requests/:id/reject` | PATCH | `admin/withdrawalRequestController.rejectWithdrawalRequest` | Admin: reject, no wallet transaction |

There is currently **no direct endpoint to create a `WalletTransaction` of type `"adjustment"`**, and no generic "admin manually credits/debits a user's wallet" endpoint — if that's the feature you're planning, it'd be new territory following the existing `deposit`/`withdrawal` creation pattern.

Pattern consistently used across all of the above:
1. Manual `if (!field) return resError(...)` validation (no schema library)
2. `resSuccess(res, { ... })` / `resError(res, message, statusCode)` for every response
3. Every handler wrapped in `try { } catch (error) { console.error(...); resError(res, error.message); }`
4. Pagination via `{ page = 1, limit = 10 }` query params → `offset`/`limit` computed manually, response includes `{ total, page, totalPages, ...rows }`
5. Router-level `router.use(authenticate); router.use(authorizeRoles(...))` rather than per-route middleware

---

## 6. Naming / Conventions

**Response envelope** — utils/responseUtil.js:
```js
const resSuccess = (res, data = {}, statusCode = 200) => {
  return res.status(statusCode).json({ code: "OK", data });
};

const resError = (res, error, statusCode = 500) => {
  return res.status(statusCode).json({ code: "ERROR", error });
};
```
So every response body is `{ code: "OK", data: {...} }` or `{ code: "ERROR", error: "message string" }` (not `{ success, data, message }` — note `error` is a plain string, not an object, and there's no top-level `message` key outside of what's nested in `data`). The one exception is the two auth-middleware 401/403 responses, which bypass `resError` and return raw `res.status(...).json({ message: "..." })` — an inconsistency to be aware of.

**Error handling**: every controller function is `try/catch` with `console.error("Error in <fnName>:", error)` then `resError(res, error.message)` (default 500). Business-rule failures (missing fields, not-found, wrong state) return `resError(res, "<message>", <4xx>)` explicitly before the main logic.

**Validation**: no library (no Joi/express-validator/Zod in `package.json`). All validation is manual `if (!x) return resError(...)` checks at the top of the handler.

**Naming**:
- snake_case for DB columns/model fields (`user_id`, `full_name`, `created_at`) via Sequelize `underscored: true`
- camelCase for JS variables/function names (`getWalletBalance`, `depositRequest`)
- Models are PascalCase singular (`User`, `WalletTransaction`), table names snake_case plural (`users`, `wallet_transactions`)
- Route files/controllers are named after the resource (`walletRoutes.js` ↔ `walletController.js`), admin variants live in parallel `/admin` subfolders with identical naming
- Money fields are `DECIMAL(15, 2)` throughout (`amount` in `WalletTransaction`, `DepositRequest`, `WithdrawalRequest`)
- Status fields are Sequelize `ENUM` (`pending`/`approved`/`rejected` for requests, `active`/… for methods)
