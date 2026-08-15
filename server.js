require("dotenv").config();

const express = require("express");
const fs = require("fs");
const path = require("path");
const { MongoClient } = require("mongodb");

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_FILE = path.join(__dirname, "data.json");

app.use(express.json());
app.use(express.static(__dirname));


// ==========================================
// MONGODB
// ==========================================

if (!process.env.MONGODB_URI) {
    console.error("MONGODB_URI is missing.");
    process.exit(1);
}

const mongoClient = new MongoClient(process.env.MONGODB_URI);

let db;
let accountsCollection;


// ==========================================
// ADMIN
// ==========================================

const ADMIN_USERNAME =
    process.env.ADMIN_USERNAME || "admin";

const ADMIN_PASSWORD =
    process.env.ADMIN_PASSWORD || "TrustAdmin2026";


// ==========================================
// HELPERS
// ==========================================

function readData() {
    try {
        return JSON.parse(
            fs.readFileSync(DATA_FILE, "utf8")
        );
    } catch (error) {
        return {
            accounts: []
        };
    }
}


function generateId() {
    return (
        "ACC-" +
        Date.now() +
        "-" +
        Math.floor(Math.random() * 100000)
    );
}


function generateReference(prefix) {
    return (
        prefix +
        "-" +
        Math.floor(
            100000 +
            Math.random() * 900000
        )
    );
}


function cleanAccount(account) {
    if (!account) return null;

    return {
        id: account.id,
        name: account.name,
        username: account.username,
        accountNumber: account.accountNumber,
        balance: Number(account.balance) || 0,
        status: account.status || "active",
        transactions:
            Array.isArray(account.transactions)
                ? account.transactions
                : []
    };
}


function publicAccount(account) {
    if (!account) return null;

    return {
        id: account.id,
        name: account.name,
        username: account.username,
        accountNumber: account.accountNumber,
        balance: Number(account.balance) || 0,
        status: account.status || "active"
    };
}


// ==========================================
// SERVER STATUS
// ==========================================

app.get("/api/status", (req, res) => {

    res.json({
        success: true,
        message: "Trust Bank demo backend is running"
    });

});


// ==========================================
// ADMIN LOGIN
// ==========================================

app.post("/api/admin/login", (req, res) => {

    const {
        username,
        password
    } = req.body;

    if (
        username === ADMIN_USERNAME &&
        password === ADMIN_PASSWORD
    ) {

        return res.json({
            success: true,
            message: "Admin login successful"
        });

    }

    res.status(401).json({
        success: false,
        message:
            "Incorrect admin username or password."
    });

});


// ==========================================
// CUSTOMER LOGIN
// ==========================================

app.post("/api/login", async (req, res) => {

    try {

        const {
            username,
            password
        } = req.body;

        const account =
            await accountsCollection.findOne({
                username: username,
                password: password
            });

        if (!account) {

            return res.status(401).json({
                success: false,
                message:
                    "Incorrect username or password."
            });

        }

        if (account.status === "blocked") {

            return res.status(403).json({
                success: false,
                message:
                    "This account has been blocked."
            });

        }

        res.json({
            success: true,
            account: publicAccount(account)
        });

    } catch (error) {

        console.error("Login error:", error);

        res.status(500).json({
            success: false,
            message:
                "Unable to process login."
        });

    }

});


// ==========================================
// GET ALL ACCOUNTS
// ==========================================

app.get(
    "/api/admin/accounts",
    async (req, res) => {

        try {

            const accounts =
                await accountsCollection
                    .find({})
                    .sort({ _id: 1 })
                    .toArray();

            res.json({
                success: true,
                accounts:
                    accounts.map(account => ({
                        id: account.id,
                        name: account.name,
                        username: account.username,
                        accountNumber:
                            account.accountNumber,
                        balance:
                            Number(account.balance) || 0,
                        status:
                            account.status || "active",
                        transactionCount:
                            Array.isArray(
                                account.transactions
                            )
                                ? account.transactions.length
                                : 0
                    }))
            });

        } catch (error) {

            console.error(
                "Get accounts error:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Unable to load accounts."
            });

        }

    }
);

// ==========================================
// APPROVE DEPOSIT
// ==========================================

app.post(
    "/api/admin/deposits/approve",
    async (req, res) => {

        try {

            const {
                accountId,
                reference
            } = req.body;

            if (!accountId || !reference) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Account ID and transaction reference are required."
                });

            }

            const account =
                await accountsCollection.findOne({
                    id: accountId
                });

            if (!account) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Account not found."
                });

            }

            const transactions =
                Array.isArray(account.transactions)
                    ? account.transactions
                    : [];

            const transaction =
                transactions.find(
                    item =>
                        item.reference === reference &&
                        item.type === "Deposit"
                );

            if (!transaction) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Deposit transaction not found."
                });

            }

            if (transaction.status === "Approved") {

                return res.status(400).json({
                    success: false,
                    message:
                        "This deposit has already been approved."
                });

            }

            if (transaction.status !== "Pending") {

                return res.status(400).json({
                    success: false,
                    message:
                        "Only pending deposits can be approved."
                });

            }

            const depositAmount =
                Number(transaction.amount);

            if (
                !Number.isFinite(depositAmount) ||
                depositAmount <= 0
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Invalid deposit amount."
                });

            }

            const updatedBalance =
                (Number(account.balance) || 0) +
                depositAmount;

            const result =
                await accountsCollection.updateOne(

                    {
                        id: accountId,
                        "transactions.reference":
                            reference,
                        "transactions.status":
                            "Pending"
                    },

                    {
                        $set: {
                            balance:
                                updatedBalance,

                            "transactions.$.status":
                                "Approved",

                            "transactions.$.approvedAt":
                                new Date()
                        }
                    }

                );

            if (result.modifiedCount === 0) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Deposit could not be approved."
                });

            }

            res.json({

                success: true,

                message:
                    "Deposit approved successfully.",

                balance:
                    updatedBalance

            });

        } catch (error) {

            console.error(
                "Approve deposit error:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Unable to approve deposit."
            });

        }

    }
);


// ==========================================
// CREATE DEMO ACCOUNT
// ==========================================

app.post(
    "/api/admin/accounts",
    async (req, res) => {

        try {

            const {
                name,
                username,
                password,
                accountNumber,
                balance
            } = req.body;

            if (
                !name ||
                !username ||
                !password ||
                !accountNumber
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Please complete all account fields."
                });

            }

            const usernameExists =
                await accountsCollection.findOne({
                    username: username
                });

            if (usernameExists) {

                return res.status(400).json({
                    success: false,
                    message:
                        "That username already exists."
                });

            }

            const accountNumberExists =
                await accountsCollection.findOne({
                    accountNumber:
                        accountNumber
                });

            if (accountNumberExists) {

                return res.status(400).json({
                    success: false,
                    message:
                        "That account number already exists."
                });

            }

            const startingBalance =
                Number(balance) || 0;

            const newAccount = {

                id: generateId(),

                name: name,

                username: username,

                password: password,

                accountNumber:
                    accountNumber,

                balance:
                    startingBalance,

                status:
                    "active",

                transactions: [],

                createdAt:
                    new Date()

            };

            await accountsCollection.insertOne(
                newAccount
            );

            res.json({

                success: true,

                message:
                    "Demo account created successfully.",

                account:
                    publicAccount(newAccount)

            });

        } catch (error) {

            console.error(
                "Create account error:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Unable to create account."
            });

        }

    }
);


// ==========================================
// TOP UP DEMO ACCOUNT
// ==========================================

app.post(
    "/api/admin/topup",
    async (req, res) => {

        try {

            const {
                accountId,
                amount
            } = req.body;

            const topUpAmount =
                Number(amount);

            if (
                !accountId ||
                !Number.isFinite(topUpAmount) ||
                topUpAmount <= 0
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Enter a valid top-up amount."
                });

            }

            const account =
                await accountsCollection.findOne({
                    id: accountId
                });

            if (!account) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Account not found."
                });

            }

            const transaction = {

                type:
                    "Admin Top Up",

                description:
                    "Demo Account Top Up",

                recipient:
                    account.name,

                amount:
                    topUpAmount,

                status:
                    "Successful",

                reference:
                    generateReference("TOP"),

                date:
                    new Date().toLocaleString()

            };

            const currentBalance =
                Number(account.balance) || 0;

            const newBalance =
                currentBalance +
                topUpAmount;

            await accountsCollection.updateOne(

                { id: accountId },

                {
                    $set: {
                        balance:
                            newBalance
                    },

                    $push: {
                        transactions: {
                            $each: [transaction],
                            $position: 0
                        }
                    }
                }

            );

            res.json({

                success: true,

                message:
                    "Demo account topped up successfully.",

                balance:
                    newBalance,

                transaction:
                    transaction

            });

        } catch (error) {

            console.error(
                "Top up error:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Unable to top up account."
            });

        }

    }
);


// ==========================================
// BLOCK / UNBLOCK ACCOUNT
// ==========================================

app.post(
    "/api/admin/accounts/status",
    async (req, res) => {

        try {

            const {
                accountId,
                status
            } = req.body;

            if (
                !accountId ||
                !["active", "blocked"]
                    .includes(status)
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Invalid account status."
                });

            }

            const result =
                await accountsCollection.updateOne(

                    { id: accountId },

                    {
                        $set: {
                            status:
                                status
                        }
                    }

                );

            if (result.matchedCount === 0) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Account not found."
                });

            }

            res.json({

                success: true,

                message:
                    status === "blocked"
                        ? "Demo account blocked."
                        : "Demo account unblocked.",

                status:
                    status

            });

        } catch (error) {

            console.error(
                "Status update error:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Unable to update account status."
            });

        }

    }
);


// ==========================================
// DELETE CUSTOMER ACCOUNT
// ==========================================

app.delete(
    "/api/admin/accounts/:id",
    async (req, res) => {

        try {

            const accountId =
                req.params.id;

            const account =
                await accountsCollection.findOne({
                    id: accountId
                });

            if (!account) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Account not found."
                });

            }

            await accountsCollection.deleteOne({
                id: accountId
            });

            res.json({

                success: true,

                message:
                    `${account.name}'s account has been deleted successfully.`

            });

        } catch (error) {

            console.error(
                "Delete account error:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Unable to delete account."
            });

        }

    }
);


// ==========================================
// ACCOUNT DETAILS
// ==========================================

app.get(
    "/api/admin/accounts/:id",
    async (req, res) => {

        try {

            const account =
                await accountsCollection.findOne({
                    id: req.params.id
                });

            if (!account) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Account not found."
                });

            }

            res.json({
                success: true,
                account:
                    cleanAccount(account)
            });

        } catch (error) {

            console.error(
                "Account details error:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Unable to load account."
            });

        }

    }
);


// ==========================================
// CUSTOMER ACCOUNT
// ==========================================

app.get(
    "/api/account/:id",
    async (req, res) => {

        try {

            const account =
                await accountsCollection.findOne({
                    id: req.params.id
                });

            if (!account) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Account not found."
                });

            }

            res.json({

                success: true,

                account:
                    publicAccount(account)

            });

        } catch (error) {

            console.error(
                "Customer account error:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Unable to load account."
            });

        }

    }
);


// ==========================================
// CUSTOMER TRANSACTIONS
// ==========================================

app.get(
    "/api/transactions/:id",
    async (req, res) => {

        try {

            const account =
                await accountsCollection.findOne({
                    id: req.params.id
                });

            if (!account) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Account not found."
                });

            }

            res.json({

                success: true,

                transactions:
                    Array.isArray(
                        account.transactions
                    )
                        ? account.transactions
                        : []

            });

        } catch (error) {

            console.error(
                "Transactions error:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Unable to load transactions."
            });

        }

    }
);


// ==========================================
// CUSTOMER TRANSFER
// ==========================================

app.post(
    "/api/transfer",
    async (req, res) => {

        try {

            const {
                accountId,
                amount,
                recipient,
                reference
            } = req.body;

            const transferAmount =
                Number(amount);

            if (
                !accountId ||
                !recipient ||
                !Number.isFinite(
                    transferAmount
                ) ||
                transferAmount <= 0
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Invalid transfer details."
                });

            }

            const account =
                await accountsCollection.findOne({
                    id: accountId
                });

            if (!account) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Account not found."
                });

            }

            if (
                account.status === "blocked"
            ) {

                return res.status(403).json({
                    success: false,
                    message:
                        "This account is blocked."
                });

            }

            const currentBalance =
                Number(account.balance) || 0;

            if (
                transferAmount >
                currentBalance
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Insufficient balance."
                });

            }

            const newBalance =
                currentBalance -
                transferAmount;

            const transaction = {

                type:
                    "Transfer",

                description:
                    "Money Transfer",

                recipient:
                    recipient,

                amount:
                    transferAmount,

                status:
                    "Successful",

                reference:
                    reference ||
                    generateReference("TB"),

                date:
                    new Date().toLocaleString()

            };

            await accountsCollection.updateOne(

                {
                    id: accountId,

                    balance: {
                        $gte:
                            transferAmount
                    }
                },

                {
                    $set: {
                        balance:
                            newBalance
                    },

                    $push: {
                        transactions: {
                            $each: [transaction],
                            $position: 0
                        }
                    }

                }

            );

            res.json({

                success: true,

                message:
                    "Transfer successful",

                balance:
                    newBalance,

                transaction:
                    transaction

            });

        } catch (error) {

            console.error(
                "Transfer error:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Unable to process transfer."
            });

        }

    }
);

// ==========================================
// DEPOSIT REQUEST
// ==========================================

app.post(
    "/api/deposit",
    async (req, res) => {

        try {

            const {
                accountId,
                amount,
                method
            } = req.body;

            const depositAmount =
                Number(amount);

            const allowedMethods = [
                "Cash App",
                "Zelle",
                "Bitcoin",
                "Card"
            ];

            if (
                !accountId ||
                !allowedMethods.includes(method) ||
                !Number.isFinite(depositAmount) ||
                depositAmount <= 0
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Invalid deposit details."
                });

            }

            const account =
                await accountsCollection.findOne({
                    id: accountId
                });

            if (!account) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Account not found."
                });

            }

            if (
                account.status === "blocked"
            ) {

                return res.status(403).json({
                    success: false,
                    message:
                        "This account is blocked."
                });

            }

            const transaction = {

                type:
                    "Deposit",

                description:
                    `${method} Deposit`,

                recipient:
                    account.name,

                amount:
                    depositAmount,

                method:
                    method,

                status:
                    "Pending",

                reference:
                    generateReference("DEP"),

                date:
                    new Date().toLocaleString()

            };

            await accountsCollection.updateOne(

                {
                    id: accountId
                },

                {
                    $push: {
                        transactions: {
                            $each: [transaction],
                            $position: 0
                        }
                    }

                }

            );

            res.json({

                success: true,

                message:
                    "Deposit request submitted successfully.",

                transaction:
                    transaction

            });

        } catch (error) {

            console.error(
                "Deposit request error:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Unable to process deposit request."
            });

        }

    }
);

// ==========================================
// WITHDRAWAL REQUEST
// ==========================================

app.post(
    "/api/withdraw",
    async (req, res) => {

        try {

            const {
                accountId,
                amount,
                method
            } = req.body;

            const withdrawalAmount =
                Number(amount);

            const allowedMethods = [
                "Bitcoin",
                "Cash"
            ];

            if (
                !accountId ||
                !allowedMethods.includes(method) ||
                !Number.isFinite(withdrawalAmount) ||
                withdrawalAmount <= 0
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Invalid withdrawal details."
                });

            }

            const account =
                await accountsCollection.findOne({
                    id: accountId
                });

            if (!account) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Account not found."
                });

            }

            if (
                account.status === "blocked"
            ) {

                return res.status(403).json({
                    success: false,
                    message:
                        "This account is blocked."
                });

            }

            const currentBalance =
                Number(account.balance) || 0;

            if (
                withdrawalAmount >
                currentBalance
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Insufficient balance."
                });

            }

            const transaction = {

                type:
                    "Withdrawal",

                description:
                    `${method} Withdrawal`,

                recipient:
                    account.name,

                amount:
                    withdrawalAmount,

                method:
                    method,

                status:
                    "Pending",

                reference:
                    generateReference("WTH"),

                date:
                    new Date().toLocaleString()

            };

            await accountsCollection.updateOne(

                {
                    id: accountId
                },

                {
                    $push: {
                        transactions: {
                            $each: [transaction],
                            $position: 0
                        }
                    }

                }

            );

            res.json({

                success: true,

                message:
                    "Withdrawal request submitted successfully.",

                transaction:
                    transaction

            });

        } catch (error) {

            console.error(
                "Withdrawal request error:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Unable to process withdrawal request."
            });

        }

    }
);


// ==========================================
// ADMIN BALANCE ADJUSTMENT
// ==========================================

app.post(
    "/api/admin/accounts/:id/balance",
    async (req, res) => {

        try {

            const accountId =
                req.params.id;

            const {
                action,
                amount,
                reason
            } = req.body;

            const adjustmentAmount =
                Number(amount);

            if (
                action !== "topup" &&
                action !== "deduct"
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Invalid balance action."
                });

            }

            if (
                !Number.isFinite(
                    adjustmentAmount
                ) ||
                adjustmentAmount <= 0
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Enter a valid amount."
                });

            }

            const account =
                await accountsCollection.findOne({
                    id: accountId
                });

            if (!account) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Account not found."
                });

            }

            const oldBalance =
                Number(account.balance) || 0;

            if (
                action === "deduct" &&
                adjustmentAmount >
                    oldBalance
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Cannot deduct more than the account balance."
                });

            }

            const newBalance =
                action === "topup"
                    ? oldBalance +
                      adjustmentAmount
                    : oldBalance -
                      adjustmentAmount;

            const isTopUp =
                action === "topup";

            const transaction = {

                type:
                    isTopUp
                        ? "Admin Credit"
                        : "Admin Debit",

                description:
                    reason ||
                    (
                        isTopUp
                            ? "Admin Balance Top Up"
                            : "Admin Balance Deduction"
                    ),

                recipient:
                    account.name,

                amount:
                    adjustmentAmount,

                status:
                    "Successful",

                reference:
                    generateReference("ADM"),

                date:
                    new Date().toLocaleString()

            };

            await accountsCollection.updateOne(

                { id: accountId },

                {
                    $set: {
                        balance:
                            newBalance
                    },

                    $push: {
                        transactions: {
                            $each: [transaction],
                            $position: 0
                        }
                    }
                }

            );

            res.json({

                success: true,

                message:
                    isTopUp
                        ? "Account balance topped up successfully."
                        : "Account balance reduced successfully.",

                balance:
                    newBalance,

                transaction:
                    transaction

            });

        } catch (error) {

            console.error(
                "Balance adjustment error:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Unable to update account balance."
            });

        }

    }
);

// ==========================================
// DEPOSIT REQUEST
// ==========================================

app.post(
    "/api/deposit",
    async (req, res) => {

        try {

            const {
                accountId,
                amount,
                method
            } = req.body;

            const depositAmount =
                Number(amount);

            const allowedMethods = [
                "Cash App",
                "Zelle",
                "Bitcoin",
                "Card"
            ];

            if (
                !accountId ||
                !Number.isFinite(depositAmount) ||
                depositAmount <= 0 ||
                !allowedMethods.includes(method)
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Invalid deposit details."
                });

            }

            const account =
                await accountsCollection.findOne({
                    id: accountId
                });

            if (!account) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Account not found."
                });

            }

            if (
                account.status === "blocked"
            ) {

                return res.status(403).json({
                    success: false,
                    message:
                        "This account is blocked."
                });

            }

            const transaction = {

                type:
                    "Deposit",

                description:
                    `${method} Deposit`,

                method:
                    method,

                amount:
                    depositAmount,

                status:
                    "Pending",

                reference:
                    generateReference("DEP"),

                date:
                    new Date().toLocaleString()

            };

            await accountsCollection.updateOne(

                { id: accountId },

                {
                    $push: {
                        transactions: {
                            $each: [transaction],
                            $position: 0
                        }
                    }
                }

            );

            res.json({

                success: true,

                message:
                    "Deposit request submitted and is pending approval.",

                transaction:
                    transaction

            });

        } catch (error) {

            console.error(
                "Deposit error:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Unable to process deposit request."
            });

        }

    }
);


// ==========================================
// WITHDRAWAL REQUEST
// ==========================================

app.post(
    "/api/withdraw",
    async (req, res) => {

        try {

            const {
                accountId,
                amount,
                method
            } = req.body;

            const withdrawalAmount =
                Number(amount);

            const allowedMethods = [
                "Bitcoin",
                "Cash"
            ];

            if (
                !accountId ||
                !Number.isFinite(withdrawalAmount) ||
                withdrawalAmount <= 0 ||
                !allowedMethods.includes(method)
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Invalid withdrawal details."
                });

            }

            const account =
                await accountsCollection.findOne({
                    id: accountId
                });

            if (!account) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Account not found."
                });

            }

            if (
                account.status === "blocked"
            ) {

                return res.status(403).json({
                    success: false,
                    message:
                        "This account is blocked."
                });

            }

            const currentBalance =
                Number(account.balance) || 0;

            if (
                withdrawalAmount >
                currentBalance
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Insufficient balance."
                });

            }

            const transaction = {

                type:
                    "Withdrawal",

                description:
                    `${method} Withdrawal`,

                method:
                    method,

                amount:
                    withdrawalAmount,

                status:
                    "Pending",

                reference:
                    generateReference("WDL"),

                date:
                    new Date().toLocaleString()

            };

            await accountsCollection.updateOne(

                { id: accountId },

                {
                    $push: {
                        transactions: {
                            $each: [transaction],
                            $position: 0
                        }
                    }
                }

            );

            res.json({

                success: true,

                message:
                    "Withdrawal request submitted and is pending approval.",

                transaction:
                    transaction

            });

        } catch (error) {

            console.error(
                "Withdrawal error:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Unable to process withdrawal request."
            });

        }

    }
);

// ==========================================
// IMPORT EXISTING DATA.JSON
// ==========================================
// This runs only when MongoDB has no accounts.
// It allows your existing demo accounts to
// appear in MongoDB the first time.

async function importExistingAccounts() {

    const existingCount =
        await accountsCollection.countDocuments();

    if (existingCount > 0) {
        console.log(
            `MongoDB already contains ${existingCount} account(s).`
        );
        return;
    }

    const data = readData();

    if (
        !data ||
        !Array.isArray(data.accounts) ||
        data.accounts.length === 0
    ) {

        console.log(
            "No accounts found in data.json to import."
        );

        return;
    }

    const accounts =
        data.accounts.map(account => ({
            ...account,
            balance:
                Number(account.balance) || 0,
            status:
                account.status || "active",
            transactions:
                Array.isArray(
                    account.transactions
                )
                    ? account.transactions
                    : [],
            importedAt:
                new Date()
        }));

    await accountsCollection.insertMany(
        accounts
    );

    console.log(
        `Imported ${accounts.length} account(s) from data.json into MongoDB.`
    );

}


// ==========================================
// START SERVER
// ==========================================

async function startServer() {

    try {

        await mongoClient.connect();

        console.log(
            "MongoDB connected successfully"
        );

        db =
            mongoClient.db("trustbank");

        accountsCollection =
            db.collection("accounts");

        await accountsCollection.createIndex(
            { id: 1 },
            { unique: true }
        );

        await accountsCollection.createIndex(
            { username: 1 },
            { unique: true }
        );

        await accountsCollection.createIndex(
            { accountNumber: 1 },
            { unique: true }
        );

        await importExistingAccounts();

        app.listen(
            PORT,
            "0.0.0.0",
            () => {

                console.log(
                    `Trust Bank server running on port ${PORT}`
                );

            }
        );

    } catch (error) {

        console.error(
            "MongoDB connection failed:",
            error
        );

        process.exit(1);

    }

}

startServer();

module.exports = app;
