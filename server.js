const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3000;

const DATA_FILE = path.join(__dirname, "data.json");

app.use(express.json());
app.use(express.static(__dirname));


// ==========================================
// DATA
// ==========================================

function readData() {
    try {
        return JSON.parse(
            fs.readFileSync(DATA_FILE, "utf8")
        );
    } catch (error) {

        return {
            admin: {
                username: "admin",
                password: "TrustAdmin2026"
            },
            accounts: []
        };

    }
}


function saveData(data) {

    fs.writeFileSync(
        DATA_FILE,
        JSON.stringify(data, null, 2)
    );

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

    const data = readData();

    if (
        username === data.admin.username &&
        password === data.admin.password
    ) {

        return res.json({
            success: true,
            message: "Admin login successful"
        });

    }

    res.status(401).json({
        success: false,
        message: "Incorrect admin username or password."
    });

});


// ==========================================
// CUSTOMER LOGIN
// ==========================================

app.post("/api/login", (req, res) => {

    const {
        username,
        password
    } = req.body;

    const data = readData();

    const account =
        data.accounts.find(
            function (item) {

                return (
                    item.username === username &&
                    item.password === password
                );

            }
        );


    if (!account) {

        return res.status(401).json({
            success: false,
            message: "Incorrect username or password."
        });

    }


    if (account.status === "blocked") {

        return res.status(403).json({
            success: false,
            message: "This account has been blocked."
        });

    }


    res.json({

        success: true,

        account: {
            id: account.id,
            name: account.name,
            username: account.username,
            accountNumber: account.accountNumber,
            balance: account.balance,
            status: account.status
        }

    });

});


// ==========================================
// GET ALL ACCOUNTS
// ==========================================

app.get("/api/admin/accounts", (req, res) => {

    const data = readData();

    const accounts =
        data.accounts.map(
            function (account) {

                return {
                    id: account.id,
                    name: account.name,
                    username: account.username,
                    accountNumber: account.accountNumber,
                    balance: account.balance,
                    status: account.status,
                    transactionCount:
                        account.transactions
                            ? account.transactions.length
                            : 0
                };

            }
        );


    res.json({
        success: true,
        accounts: accounts
    });

});


// ==========================================
// CREATE DEMO ACCOUNT
// ==========================================

app.post("/api/admin/accounts", (req, res) => {

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
            message: "Please complete all account fields."
        });

    }


    const data = readData();


    const usernameExists =
        data.accounts.some(
            function (account) {
                return account.username === username;
            }
        );


    if (usernameExists) {

        return res.status(400).json({
            success: false,
            message: "That username already exists."
        });

    }


    const accountNumberExists =
        data.accounts.some(
            function (account) {
                return account.accountNumber === accountNumber;
            }
        );


    if (accountNumberExists) {

        return res.status(400).json({
            success: false,
            message: "That account number already exists."
        });

    }


    const startingBalance =
        Number(balance) || 0;


    const newAccount = {

        id:
            "ACC-" +
            Date.now(),

        name:
            name,

        username:
            username,

        password:
            password,

        accountNumber:
            accountNumber,

        balance:
            startingBalance,

        status:
            "active",

        transactions:
            []

    };


    data.accounts.push(
        newAccount
    );


    saveData(data);


    res.json({

        success: true,

        message:
            "Demo account created successfully.",

        account: {
            id: newAccount.id,
            name: newAccount.name,
            username: newAccount.username,
            accountNumber:
                newAccount.accountNumber,
            balance:
                newAccount.balance,
            status:
                newAccount.status
        }

    });

});


// ==========================================
// TOP UP DEMO ACCOUNT
// ==========================================

app.post("/api/admin/topup", (req, res) => {

    const {
        accountId,
        amount
    } = req.body;

    const topUpAmount =
        Number(amount);


    if (
        !accountId ||
        !topUpAmount ||
        topUpAmount <= 0
    ) {

        return res.status(400).json({
            success: false,
            message: "Enter a valid top-up amount."
        });

    }


    const data = readData();


    const account =
        data.accounts.find(
            function (item) {
                return item.id === accountId;
            }
        );


    if (!account) {

        return res.status(404).json({
            success: false,
            message: "Account not found."
        });

    }


    account.balance =
        Number(account.balance) +
        topUpAmount;


    if (!Array.isArray(account.transactions)) {
        account.transactions = [];
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
            "TOP-" +
            Math.floor(
                100000 +
                Math.random() * 900000
            ),

        date:
            new Date().toLocaleString()

    };


    account.transactions.unshift(
        transaction
    );


    saveData(data);


    res.json({

        success: true,

        message:
            "Demo account topped up successfully.",

        balance:
            account.balance,

        transaction:
            transaction

    });

});


// ==========================================
// BLOCK / UNBLOCK ACCOUNT
// ==========================================

app.post("/api/admin/accounts/status", (req, res) => {

    const {
        accountId,
        status
    } = req.body;


    if (
        !accountId ||
        !["active", "blocked"].includes(status)
    ) {

        return res.status(400).json({
            success: false,
            message: "Invalid account status."
        });

    }


    const data = readData();


    const account =
        data.accounts.find(
            function (item) {
                return item.id === accountId;
            }
        );


    if (!account) {

        return res.status(404).json({
            success: false,
            message: "Account not found."
        });

    }


    account.status =
        status;


    saveData(data);


    res.json({

        success: true,

        message:
            status === "blocked"
                ? "Demo account blocked."
                : "Demo account unblocked.",

        status:
            account.status

    });

});


// ==========================================
// ACCOUNT DETAILS
// ==========================================

app.get(
    "/api/admin/accounts/:id",
    (req, res) => {

        const data = readData();


        const account =
            data.accounts.find(
                function (item) {
                    return item.id === req.params.id;
                }
            );


        if (!account) {

            return res.status(404).json({
                success: false,
                message: "Account not found."
            });

        }


        res.json({

            success: true,

            account:
                account

        });

    }
);


// ==========================================
// CUSTOMER ACCOUNT
// ==========================================

app.get(
    "/api/account/:id",
    (req, res) => {

        const data = readData();


        const account =
            data.accounts.find(
                function (item) {
                    return item.id === req.params.id;
                }
            );


        if (!account) {

            return res.status(404).json({
                success: false,
                message: "Account not found."
            });

        }


        res.json({

            success: true,

            account: {
                id:
                    account.id,

                name:
                    account.name,

                username:
                    account.username,

                accountNumber:
                    account.accountNumber,

                balance:
                    account.balance,

                status:
                    account.status
            }

        });

    }
);


// ==========================================
// CUSTOMER TRANSACTIONS
// ==========================================

app.get(
    "/api/transactions/:id",
    (req, res) => {

        const data = readData();


        const account =
            data.accounts.find(
                function (item) {
                    return item.id === req.params.id;
                }
            );


        if (!account) {

            return res.status(404).json({
                success: false,
                message: "Account not found."
            });

        }


        res.json({

            success: true,

            transactions:
                account.transactions || []

        });

    }
);


// ==========================================
// CUSTOMER TRANSFER
// ==========================================

app.post("/api/transfer", (req, res) => {

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
            !transferAmount ||
            transferAmount <= 0
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Invalid transfer details."

            });

        }


        const data = readData();


        const account =
            data.accounts.find(
                function (item) {
                    return item.id === accountId;
                }
            );


        if (!account) {

            return res.status(404).json({

                success: false,

                message:
                    "Account not found."

            });

        }


        if (account.status === "blocked") {

            return res.status(403).json({

                success: false,

                message:
                    "This account is blocked."

            });

        }


        const currentBalance =
            Number(account.balance);


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


        account.balance =
            currentBalance -
            transferAmount;


        if (!Array.isArray(account.transactions)) {
            account.transactions = [];
        }


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
                "TB-" +
                Math.floor(
                    100000 +
                    Math.random() * 900000
                ),

            date:
                new Date().toLocaleString()

        };


        account.transactions.unshift(
            transaction
        );


        saveData(data);


        res.json({

            success:
                true,

            message:
                "Transfer successful",

            balance:
                account.balance,

            transaction:
                transaction

        });


    } catch (error) {

        console.error(
            "Transfer error:",
            error
        );


        res.status(500).json({

            success:
                false,

            message:
                "Unable to process transfer."

        });

    }

});

// ==========================================
// ADMIN BALANCE ADJUSTMENT
// ==========================================

app.post(
    "/api/admin/accounts/:id/balance",
    (req, res) => {

        try {

            const accountId = req.params.id;

            const {
                action,
                amount,
                reason
            } = req.body;

            const adjustmentAmount = Number(amount);


            // ======================================
            // VALIDATE ACTION
            // ======================================

            if (
                action !== "topup" &&
                action !== "deduct"
            ) {

                return res.status(400).json({
                    success: false,
                    message: "Invalid balance action."
                });

            }


            // ======================================
            // VALIDATE AMOUNT
            // ======================================

            if (
                !Number.isFinite(adjustmentAmount) ||
                adjustmentAmount <= 0
            ) {

                return res.status(400).json({
                    success: false,
                    message: "Enter a valid amount."
                });

            }


            const data = readData();


            // ======================================
            // FIND ACCOUNT
            // ======================================

            const account =
                data.accounts.find(
                    function (item) {
                        return item.id === accountId;
                    }
                );


            if (!account) {

                return res.status(404).json({
                    success: false,
                    message: "Account not found."
                });

            }


            // ======================================
            // CURRENT BALANCE
            // ======================================

            const oldBalance =
                Number(account.balance) || 0;


            // ======================================
            // TOP UP
            // ======================================

            if (action === "topup") {

                account.balance =
                    oldBalance +
                    adjustmentAmount;

            }


            // ======================================
            // DEDUCT
            // ======================================

            if (action === "deduct") {

                if (
                    adjustmentAmount >
                    oldBalance
                ) {

                    return res.status(400).json({
                        success: false,
                        message:
                            "Cannot deduct more than the account balance."
                    });

                }


                account.balance =
                    oldBalance -
                    adjustmentAmount;

            }


            // ======================================
            // TRANSACTIONS
            // ======================================

            if (!Array.isArray(account.transactions)) {

                account.transactions = [];

            }


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
                    "ADM-" +
                    Math.floor(
                        100000 +
                        Math.random() * 900000
                    ),

                date:
                    new Date().toLocaleString()

            };


            account.transactions.unshift(
                transaction
            );


            // ======================================
            // SAVE
            // ======================================

            saveData(data);


            // ======================================
            // RESPONSE
            // ======================================

            res.json({

                success: true,

                message:
                    isTopUp
                        ? "Account balance topped up successfully."
                        : "Account balance reduced successfully.",

                balance:
                    account.balance,

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
// VERCEL
// ==========================================

module.exports = app;