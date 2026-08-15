document.addEventListener("DOMContentLoaded", function () {

    // =========================================================
    // TRUST BANK - CUSTOMER SCRIPT
    // =========================================================

    const DEFAULT_PASSWORD = "myTbank123";
    const DEFAULT_TRANSFER_PIN = "1234";

    let CURRENT_ACCOUNT_ID =
        localStorage.getItem("trustBankAccountId") || null;

    let CURRENT_ACCOUNT = null;

    let balance = 0;

    let transactions = [];

    let notifications = [];

    let cardFrozen = false;

    let savedPassword = DEFAULT_PASSWORD;

    let transferPin = DEFAULT_TRANSFER_PIN;


    // =========================================================
    // ACCOUNT STORAGE KEY
    // =========================================================

    function accountKey(name) {

        if (!CURRENT_ACCOUNT_ID) {
            return "trustBank";
        }

        return "trustBank_" +
            CURRENT_ACCOUNT_ID +
            "_" +
            name;
    }


    // =========================================================
    // LOAD CUSTOMER ACCOUNT
    // =========================================================

    async function loadCustomerAccount() {

        try {

            const accountId =
                localStorage.getItem(
                    "trustBankAccountId"
                );

            if (!accountId) {

                console.error(
                    "No logged-in account found."
                );

                return false;
            }


            const response =
                await fetch(
                    `/api/account/${accountId}`
                );


            const result =
                await response.json();


            if (!response.ok || !result.success) {

                console.error(
                    "Account loading failed:",
                    result
                );

                return false;
            }


            // =================================================
            // THIS IS THE CURRENT CUSTOMER
            // =================================================

            CURRENT_ACCOUNT =
                result.account;

            CURRENT_ACCOUNT_ID =
                CURRENT_ACCOUNT.id;


            // =================================================
            // BALANCE
            // =================================================

            balance =
                Number(
                    CURRENT_ACCOUNT.balance || 0
                );


            // =================================================
            // SAVE ACCOUNT LOCALLY
            // =================================================

            localStorage.setItem(
                "trustBankAccount",
                JSON.stringify(
                    CURRENT_ACCOUNT
                )
            );


            localStorage.setItem(
                "trustBankBalance",
                String(balance)
            );


            // =================================================
            // LOAD CUSTOMER-SPECIFIC LOCAL DATA
            // =================================================

            notifications =
                JSON.parse(
                    localStorage.getItem(
                        accountKey("notifications")
                    ) || "[]"
                );


            cardFrozen =
                localStorage.getItem(
                    accountKey("cardFrozen")
                ) === "true";


            savedPassword =
                localStorage.getItem(
                    accountKey("password")
                ) ||
                CURRENT_ACCOUNT.password ||
                DEFAULT_PASSWORD;


            transferPin =
                localStorage.getItem(
                    accountKey("transferPin")
                ) ||
                DEFAULT_TRANSFER_PIN;


            // =================================================
            // LOAD TRANSACTIONS FROM SERVER
            // =================================================

            const transactionResponse =
                await fetch(
                    `/api/transactions/${CURRENT_ACCOUNT_ID}`
                );


            if (transactionResponse.ok) {

                const transactionResult =
                    await transactionResponse.json();

                transactions =
                    transactionResult.transactions || [];

            } else {

                transactions = [];

            }


            return true;


        } catch (error) {

            console.error(
                "Account loading error:",
                error
            );

            alert(
                "Unable to connect to the banking server."
            );

            return false;
        }
    }


    // =========================================================
    // SAVE LOCAL CUSTOMER DATA
    // =========================================================

    function saveData() {

        localStorage.setItem(
            "trustBankBalance",
            String(balance)
        );


        localStorage.setItem(
            accountKey("transactions"),
            JSON.stringify(transactions)
        );


        localStorage.setItem(
            accountKey("notifications"),
            JSON.stringify(notifications)
        );


        localStorage.setItem(
            accountKey("cardFrozen"),
            String(cardFrozen)
        );


        localStorage.setItem(
            accountKey("password"),
            savedPassword
        );


        localStorage.setItem(
            accountKey("transferPin"),
            transferPin
        );
    }


    // =========================================================
    // HELPERS
    // =========================================================

    function formatMoney(number) {

        return Number(number || 0).toLocaleString(
            "en-US",
            {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }
        );
    }


    function currencySymbol() {

        if (
            CURRENT_ACCOUNT &&
            CURRENT_ACCOUNT.currency
        ) {

            return CURRENT_ACCOUNT.currency;
        }

        return "$";
    }


    function generateReference() {

        return "TB-" +
            Math.floor(
                100000 +
                Math.random() * 900000
            );
    }


    function escapeHtml(value) {

        return String(
            value ?? ""
        )
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }


    function addNotification(
        message,
        type
    ) {

        notifications.unshift({

            message:
                message,

            type:
                type,

            date:
                new Date().toLocaleString(),

            read:
                false

        });

        saveData();
    }


    // =========================================================
    // LOGIN
    // =========================================================

    const landingLoginForm =
        document.getElementById(
            "loginForm"
        );


    if (landingLoginForm) {

        landingLoginForm.addEventListener(
            "submit",
            async function (event) {

                event.preventDefault();


                const username =
                    document.getElementById(
                        "loginUsername"
                    )
                        ? document
                            .getElementById(
                                "loginUsername"
                            )
                            .value
                            .trim()
                        : landingLoginForm
                            .querySelectorAll(
                                "input"
                            )[0]
                            .value
                            .trim();


                const password =
                    document.getElementById(
                        "loginPassword"
                    )
                        ? document
                            .getElementById(
                                "loginPassword"
                            )
                            .value
                        : landingLoginForm
                            .querySelectorAll(
                                "input"
                            )[1]
                            .value;


                // =================================================
                // ADMIN LOGIN
                // =================================================

                if (
                    username === "admin" &&
                    password === "admin123"
                ) {

                    sessionStorage.setItem(
                        "trustBankAdmin",
                        "true"
                    );


                    window.location.href =
                        "/admin.html";


                    return;
                }


                // =================================================
                // CUSTOMER LOGIN
                // =================================================

                try {

                    const response =
                        await fetch(
                            "/api/login",
                            {

                                method:
                                    "POST",

                                headers: {
                                    "Content-Type":
                                        "application/json"
                                },

                                body:
                                    JSON.stringify({
                                        username:
                                            username,

                                        password:
                                            password
                                    })
                            }
                        );


                    const result =
                        await response.json();


                    if (!response.ok) {

                        const loginMessage =
                            document.getElementById(
                                "loginMessage"
                            );


                        if (loginMessage) {

                            loginMessage.textContent =
                                result.message ||
                                "Login failed.";

                            loginMessage.style.display =
                                "block";
                        }

                        return;
                    }


                    if (
                        result.success &&
                        result.account
                    ) {

                        // =========================================
                        // SAVE THE ACTUAL ACCOUNT THAT LOGGED IN
                        // =========================================

                        localStorage.setItem(
                            "trustBankAccountId",
                            result.account.id
                        );


                        CURRENT_ACCOUNT_ID =
                            result.account.id;


                        balance =
                            Number(
                                result.account.balance || 0
                            );


                        localStorage.setItem(
                            "trustBankBalance",
                            String(balance)
                        );


                        // Load the complete account
                        // from the server

                        const loaded =
                            await loadCustomerAccount();


                        if (!loaded) {
                            return;
                        }


                        await showDashboard();

                    }


                } catch (error) {

                    console.error(
                        "Login error:",
                        error
                    );


                    const loginMessage =
                        document.getElementById(
                            "loginMessage"
                        );


                    if (loginMessage) {

                        loginMessage.textContent =
                            "Unable to connect to the banking server.";

                        loginMessage.style.display =
                            "block";
                    }

                }

            }
        );
    }


    // =========================================================
    // DASHBOARD
    // =========================================================

    async function showDashboard() {

    const accountLoaded = await loadCustomerAccount();

    if (!accountLoaded) {
        return;
    }

    const unreadCount =
        notifications.filter(function (item) {
            return !item.read;
        }).length;

    const name =
        CURRENT_ACCOUNT.name ||
        "Customer";

    const accountNumber =
        CURRENT_ACCOUNT.accountNumber ||
        "N/A";

    const accountType =
        CURRENT_ACCOUNT.accountType ||
        "Current Account";

    const currency =
        CURRENT_ACCOUNT.currency ||
        "$";

    // =====================================================
    // RECENT TRANSACTIONS
    // =====================================================

    const recentTransactions =
        transactions.slice(0, 5);

    let transactionHTML = "";

    if (recentTransactions.length === 0) {

        transactionHTML = `
            <div class="empty-transactions">
                <div class="empty-icon">↔</div>

                <p>
                    No transactions yet
                </p>

                <span>
                    Your recent transactions will appear here.
                </span>
            </div>
        `;

    } else {

        recentTransactions.forEach(function (transaction) {

            const description =
                transaction.description ||
                transaction.type ||
                "Transaction";

            const amount =
                Number(transaction.amount || 0);

            /*
             * Transfers and bill payments are outgoing.
             * Explicit credits/incoming transactions are green.
             */

            const transactionType =
                String(
                    transaction.type ||
                    ""
                ).toLowerCase();

            const descriptionText =
                String(
                    transaction.description ||
                    ""
                ).toLowerCase();

            const isCredit =
                transaction.direction === "credit" ||
                transaction.credit === true ||
                transactionType === "deposit" ||
                transactionType === "salary" ||
                transactionType === "credit" ||
                descriptionText.includes("deposit") ||
                descriptionText.includes("salary");

            const amountClass =
                isCredit
                    ? "transaction-credit"
                    : "transaction-debit";

            const amountPrefix =
                isCredit
                    ? "+"
                    : "-";

            const status =
                transaction.status ||
                "Successful";

            const statusClass =
                String(status).toLowerCase() === "successful"
                    ? "status-success"
                    : "status-other";

            transactionHTML += `

                <div class="dashboard-transaction">

                    <div class="transaction-icon ${
                        isCredit
                            ? "credit-icon"
                            : "debit-icon"
                    }">

                        ${
                            isCredit
                                ? "↓"
                                : "↑"
                        }

                    </div>


                    <div class="transaction-main">

                        <strong>
                            ${escapeHtml(description)}
                        </strong>

                        <span>
                            ${
                                escapeHtml(
                                    transaction.recipient ||
                                    transaction.bank ||
                                    transaction.type ||
                                    "Bank Transaction"
                                )
                            }
                        </span>

                        <small>
                            ${escapeHtml(
                                transaction.date ||
                                ""
                            )}
                        </small>

                    </div>


                    <div class="transaction-amount">

                        <strong class="${amountClass}">
                            ${amountPrefix}${escapeHtml(currency)}
                            ${formatMoney(amount)}
                        </strong>

                        <span class="${statusClass}">
                            ${escapeHtml(status)}
                        </span>

                    </div>

                </div>

            `;
        });
    }


    // =====================================================
    // VIRTUAL CARD
    // =====================================================

    const cardHolder =
        (
            CURRENT_ACCOUNT.name ||
            "CUSTOMER"
        ).toUpperCase();

    const cardDigits =
        String(accountNumber)
            .replace(/\s/g, "")
            .slice(-4) ||
        "4821";


    document.body.innerHTML = `

        <header class="bank-header">

            <div class="bank-logo">
                TRUST BANK
            </div>


            <nav class="bank-nav">

                <button id="navHome">
                    Home
                </button>

                <button id="navHistory">
                    Transactions
                </button>

                <button id="navNotifications">
                    Notifications
                    ${
                        unreadCount > 0
                            ? `(${unreadCount})`
                            : ""
                    }
                </button>

                <button id="navLogout">
                    Logout
                </button>

            </nav>

        </header>


        <main class="dashboard">

            <div class="dashboard-welcome">

                <div>

                    <p class="dashboard-label">
                        TRUST BANK
                    </p>

                    <h1>
                        Welcome back,
                        ${escapeHtml(name)}
                    </h1>

                    <p class="dashboard-subtitle">
                        Manage your account securely.
                    </p>

                </div>

            </div>


            <!-- =========================================
                 BALANCE
                 ========================================= -->

            <section class="balance-card">

                <div class="balance-top">

                    <span>
                        Available Balance
                    </span>

                    <button
                        id="toggleBalance"
                        class="balance-eye"
                        type="button"
                    >
                        👁
                    </button>

                </div>


                <h1 id="dashboardBalance">
                    ${escapeHtml(currency)}
                    ${formatMoney(balance)}
                </h1>


                <div class="balance-account">

                    <span>
                        Account
                    </span>

                    <strong>
                        •••• ${escapeHtml(
                            String(accountNumber).slice(-4)
                        )}
                    </strong>

                </div>

            </section>


            <!-- =========================================
                 QUICK ACTIONS
                 ========================================= -->

            <section class="quick-actions">

                <button
                    class="quick-action transfer-action"
                    id="transferBtn"
                >

                    <span class="quick-icon">
                        ↔
                    </span>

                    <span>
                        Transfer
                    </span>

                </button>


                <button
                    class="quick-action"
                    id="depositBtn"
                >

                    <span class="quick-icon">
                        +
                    </span>

                    <span>
                        Deposit
                    </span>

                </button>


                <button
                    class="quick-action"
                    id="withdrawBtn"
                >

                    <span class="quick-icon">
                        ↓
                    </span>

                    <span>
                        Withdraw
                    </span>

                </button>


                <button
                    class="quick-action"
                    id="billsBtn"
                >

                    <span class="quick-icon">
                        ▣
                    </span>

                    <span>
                        Bills
                    </span>

                </button>

            </section>


            <!-- =========================================
                 VIRTUAL CARD
                 ========================================= -->

            <section class="dashboard-section">

                <div class="section-heading">

                    <div>

                        <span class="section-label">
                            YOUR CARD
                        </span>

                        <h2>
                            Virtual Card
                        </h2>

                    </div>


                    <button
                        id="manageCardBtn"
                        class="text-button"
                    >
                        Manage
                    </button>

                </div>


                <div class="dashboard-virtual-card">

                    <div class="virtual-card-top">

                        <strong>
                            TRUST BANK
                        </strong>

                        <span>
                            VIRTUAL
                        </span>

                    </div>


                    <div class="virtual-card-chip"></div>


                    <div class="virtual-card-number">
                        •••• •••• •••• ${escapeHtml(cardDigits)}
                    </div>


                    <div class="virtual-card-bottom">

                        <div>

                            <small>
                                CARD HOLDER
                            </small>

                            <strong>
                                ${escapeHtml(cardHolder)}
                            </strong>

                        </div>


                        <div>

                            <small>
                                EXPIRES
                            </small>

                            <strong>
                                12/30
                            </strong>

                        </div>

                    </div>


                    <div class="virtual-card-status">

                        <span class="${
                            cardFrozen
                                ? "card-status-frozen"
                                : "card-status-active"
                        }">

                            ${
                                cardFrozen
                                    ? "● Frozen"
                                    : "● Active"
                            }

                        </span>

                    </div>

                </div>

            </section>


            <!-- =========================================
                 TRANSACTIONS
                 ========================================= -->

            <section class="dashboard-section">

                <div class="section-heading">

                    <div>

                        <span class="section-label">
                            ACCOUNT ACTIVITY
                        </span>

                        <h2>
                            Recent Transactions
                        </h2>

                    </div>


                    <button
                        id="viewAllHistory"
                        class="text-button"
                    >
                        View All
                    </button>

                </div>


                <div class="dashboard-transactions">

                    ${transactionHTML}

                </div>

            </section>


            <!-- =========================================
                 ACCOUNT INFORMATION
                 ========================================= -->

            <section class="dashboard-account-summary">

                <div>

                    <span>
                        Account Holder
                    </span>

                    <strong>
                        ${escapeHtml(name)}
                    </strong>

                </div>


                <div>

                    <span>
                        Account Number
                    </span>

                    <strong>
                        ${escapeHtml(accountNumber)}
                    </strong>

                </div>


                <div>

                    <span>
                        Account Type
                    </span>

                    <strong>
                        ${escapeHtml(accountType)}
                    </strong>

                </div>


                <div>

                    <span>
                        Status
                    </span>

                    <strong class="account-active">
                        ${escapeHtml(
                            CURRENT_ACCOUNT.status ||
                            "Active"
                        )}
                    </strong>

                </div>

            </section>


        </main>


        <footer class="bank-footer">

            <p>
                ©️ 2026 Trust Bank
            </p>

            <p>
                Secure Banking Portal
            </p>

        </footer>

    `;


    // =====================================================
    // BALANCE HIDE / SHOW
    // =====================================================

    let balanceVisible = true;

    document
        .getElementById("toggleBalance")
        .addEventListener(
            "click",
            function () {

                balanceVisible =
                    !balanceVisible;

                document
                    .getElementById(
                        "dashboardBalance"
                    )
                    .textContent =
                    balanceVisible
                        ? `${currency}${formatMoney(balance)}`
                        : "••••••••";

                this.textContent =
                    balanceVisible
                        ? "👁"
                        : "🙈";
            }
        );


    // =====================================================
    // NAVIGATION
    // =====================================================

    document
        .getElementById("navHome")
        .addEventListener(
            "click",
            showDashboard
        );


    document
        .getElementById("navHistory")
        .addEventListener(
            "click",
            showHistoryPage
        );


    document
        .getElementById("navNotifications")
        .addEventListener(
            "click",
            showNotificationsPage
        );


    document
        .getElementById("navLogout")
        .addEventListener(
            "click",
            logout
        );


    // =====================================================
    // QUICK ACTIONS
    // =====================================================

    document
        .getElementById("transferBtn")
        .addEventListener(
            "click",
            showTransferPage
        );


    document
        .getElementById("billsBtn")
        .addEventListener(
            "click",
            showBillsPage
        );


    document
        .getElementById("manageCardBtn")
        .addEventListener(
            "click",
            showCardsPage
        );


    document
        .getElementById("viewAllHistory")
        .addEventListener(
            "click",
            showHistoryPage
        );


    // Deposit / Withdraw are design buttons for now.
    // We will connect them to backend operations when those
    // endpoints exist.

    document
         .getElementById("depositBtn")
         .addEventListener(
             "click",
             showDepositPage
          );


     document
         .getElementById("withdrawBtn")
         .addEventListener(
             "click",
             showWithdrawalPage
         );
}

async function submitDepositRequest() {

    const method =
        document
            .getElementById("depositMethod")
            .value;

    const amount =
        Number(
            document
                .getElementById("depositAmount")
                .value
        );

    const message =
        document
            .getElementById("depositMessage");


    if (!method) {

        message.textContent =
            "Please select a deposit method.";

        return;
    }


    if (
        !Number.isFinite(amount) ||
        amount <= 0
    ) {

        message.textContent =
            "Please enter a valid amount.";

        return;
    }


    try {

        const response =
            await fetch(
                "/api/deposit",
                {

                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({

                            accountId:
                                CURRENT_ACCOUNT_ID,

                            amount:
                                amount,

                            method:
                                method

                        })

                }
            );


        const result =
            await response.json();


        if (!response.ok) {

            message.textContent =
                result.message ||
                "Deposit request failed.";

            return;
        }


        message.textContent =
            "Deposit request submitted. Status: Pending.";


        setTimeout(
            showHistoryPage,
            1200
        );


    } catch (error) {

        console.error(
            "Deposit request error:",
            error
        );

        message.textContent =
            "Unable to connect to the banking server.";

    }
}


    // =========================================================
    // MY ACCOUNT
    // =========================================================

    function showProfilePage() {

        const name =
            CURRENT_ACCOUNT.name ||
            "Customer";


        const username =
            CURRENT_ACCOUNT.username ||
            "N/A";


        const accountNumber =
            CURRENT_ACCOUNT.accountNumber ||
            "N/A";


        const accountType =
            CURRENT_ACCOUNT.accountType ||
            "Current Account";


        const email =
            CURRENT_ACCOUNT.email ||
            "N/A";


        const phone =
            CURRENT_ACCOUNT.phone ||
            "N/A";


        const address =
            CURRENT_ACCOUNT.address ||
            "N/A";


        document.body.innerHTML = `

            <div class="transfer-page">

                <h1>
                    My Account
                </h1>


                <div class="account-card">

                    <h2>
                        Personal Information
                    </h2>


                    <div class="account-row">
                        <span>Account Holder</span>

                        <strong>
                            ${escapeHtml(name)}
                        </strong>
                    </div>


                    <div class="account-row">
                        <span>Username</span>

                        <strong>
                            ${escapeHtml(username)}
                        </strong>
                    </div>


                    <div class="account-row">
                        <span>Account Number</span>

                        <strong>
                            ${escapeHtml(accountNumber)}
                        </strong>
                    </div>


                    <div class="account-row">
                        <span>Account Type</span>

                        <strong>
                            ${escapeHtml(accountType)}
                        </strong>
                    </div>


                    <div class="account-row">
                        <span>Account Status</span>

                        <strong>
                            ${escapeHtml(
                                CURRENT_ACCOUNT.status ||
                                "Active"
                            )}
                        </strong>
                    </div>

                </div>


                <div class="account-card">

                    <h2>
                        Contact Information
                    </h2>


                    <div class="account-row">
                        <span>Email</span>

                        <strong>
                            ${escapeHtml(email)}
                        </strong>
                    </div>


                    <div class="account-row">
                        <span>Phone</span>

                        <strong>
                            ${escapeHtml(phone)}
                        </strong>
                    </div>


                    <div class="account-row">
                        <span>Address</span>

                        <strong>
                            ${escapeHtml(address)}
                        </strong>
                    </div>

                </div>


                <button id="backDashboard">
                    Back to Dashboard
                </button>

            </div>

        `;


        document
            .getElementById("backDashboard")
            .addEventListener(
                "click",
                showDashboard
            );
    }

    // =============================================================
// DEPOSIT PAGE
// =============================================================

function showDepositPage() {

    const currency =
        CURRENT_ACCOUNT.currency ||
        "$";

    document.body.innerHTML = `

        <header class="bank-header">

            <div class="bank-logo">
                TRUST BANK
            </div>

            <nav class="bank-nav">

                <button id="depositBack">
                    Dashboard
                </button>

                <button id="depositHistory">
                    Transactions
                </button>

                <button id="depositLogout">
                    Logout
                </button>

            </nav>

        </header>


        <main class="dashboard">

            <section class="dashboard-welcome">

                <div>

                    <p class="dashboard-label">
                        TRUST BANK
                    </p>

                    <h1>
                        Deposit Funds
                    </h1>

                    <p class="dashboard-subtitle">
                        Choose how you want to deposit funds.
                    </p>

                </div>

            </section>


            <section class="bank-form-card">

                <div class="section-heading">

                    <div>

                        <span class="section-label">
                            ADD FUNDS
                        </span>

                        <h2>
                            Deposit Method
                        </h2>

                    </div>

                </div>


                <label>
                     Deposit Method
                 </label>

                 <select id="depositMethod">

                     <option value="">
                         Select a method
                     </option>

                 <option value="Cash App">
                     Cash App
                 </option>

                 <option value="Zelle">
                     Zelle
                 </option>

                 <option value="Bitcoin">
                     Bitcoin
                 </option>

                 <option value="Card">
                     Card
                 </option>

                 </select>


                 <div
                     id="depositAccountField"
                     style="display: none;"
                 >

                     <label id="depositAccountLabel">
                         Account Information
                     </label>

                     <input
                         id="depositAccount"
                         type="text"
                         placeholder=""
                     >

                 </div>


                     <label>
                         Amount
                     </label>

                 <div class="money-input">

                     <span>
                         ${escapeHtml(currency)}
                     </span>

                 <input
                     id="depositAmount"
                     type="number"
                     min="0.01"
                     step="0.01"
                     placeholder="0.00"
                 >

             </div>


             <button
                 id="submitDeposit"
                 class="primary-bank-button"
             >
                 Submit Deposit
             </button>


             <button
                 id="cancelDeposit"
                 class="secondary-bank-button"
             >
                 Cancel
             </button>


         <div
             id="depositMessage"
             class="bank-form-message"
         ></div>

         </section>

         </main>

         `;

         const depositMethod =
             document.getElementById("depositMethod");

         const depositAccountField =
             document.getElementById("depositAccountField");

         const depositAccountLabel =
             document.getElementById("depositAccountLabel");

         const depositAccount =
             document.getElementById("depositAccount");


         depositMethod.addEventListener(
             "change",
             function () {

             const method =
                 depositMethod.value;

             if (method === "Zelle") {

                 depositAccountField.style.display =
                     "block";

                 depositAccountLabel.textContent =
                     "Zelle number or email";

                 depositAccount.placeholder =
                     "Enter Zelle number or email";

             } else if (method === "Cash App") {

                 depositAccountField.style.display =
                     "block";

                 depositAccountLabel.textContent =
                     "Cash App name";

                 depositAccount.placeholder =
                     "Enter Cash App name";

             } else if (method === "Bitcoin") {

                 depositAccountField.style.display =
                     "block";

                 depositAccountLabel.textContent =
                     "Bitcoin wallet address";

                 depositAccount.placeholder =
                     "Enter Bitcoin wallet address";

             } else {

                 depositAccountField.style.display =
                     "none";

                 depositAccount.value = "";

                 }

             }
         );


    document
        .getElementById("submitDeposit")
        .addEventListener(
            "click",
            submitDepositRequest
        );


    document
        .getElementById("cancelDeposit")
        .addEventListener(
            "click",
            showDashboard
        );


    document
        .getElementById("depositBack")
        .addEventListener(
            "click",
            showDashboard
        );


    document
        .getElementById("depositHistory")
        .addEventListener(
            "click",
            showHistoryPage
        );


    document
        .getElementById("depositLogout")
        .addEventListener(
            "click",
            logout
        );
}

// =============================================================
// WITHDRAWAL PAGE
// =============================================================

function showWithdrawalPage() {

    const currency =
        CURRENT_ACCOUNT.currency ||
        "$";

    document.body.innerHTML = `

        <header class="bank-header">

            <div class="bank-logo">
                TRUST BANK
            </div>

            <nav class="bank-nav">

                <button id="withdrawBack">
                    Dashboard
                </button>

                <button id="withdrawHistory">
                    Transactions
                </button>

                <button id="withdrawLogout">
                    Logout
                </button>

            </nav>

        </header>


        <main class="dashboard">

            <section class="dashboard-welcome">

                <div>

                    <p class="dashboard-label">
                        TRUST BANK
                    </p>

                    <h1>
                        Withdraw Funds
                    </h1>

                    <p class="dashboard-subtitle">
                        Choose how you want to withdraw funds.
                    </p>

                </div>

            </section>


            <section class="bank-form-card">

                <div class="section-heading">

                    <div>

                        <span class="section-label">
                            WITHDRAW FUNDS
                        </span>

                        <h2>
                            Withdrawal Method
                        </h2>

                    </div>

                </div>


                <label>
                    Withdrawal Method
                </label>

                <select id="withdrawMethod">

                    <option value="">
                        Select a method
                    </option>

                    <option value="Bitcoin">
                        Bitcoin
                    </option>

                    <option value="Cash">
                        Cash
                    </option>

                </select>


                <label>
                    Amount
                </label>

                <div class="money-input">

                    <span>
                        ${escapeHtml(currency)}
                    </span>

                    <input
                        id="withdrawAmount"
                        type="number"
                        min="0.01"
                        step="0.01"
                        placeholder="0.00"
                    >

                </div>


                <button
                    id="submitWithdrawal"
                    class="primary-bank-button"
                >
                    Submit Withdrawal
                </button>


                <button
                    id="cancelWithdrawal"
                    class="secondary-bank-button"
                >
                    Cancel
                </button>


                <div
                    id="withdrawMessage"
                    class="bank-form-message"
                ></div>

            </section>

        </main>

    `;


    document
        .getElementById("submitWithdrawal")
        .addEventListener(
            "click",
            submitWithdrawalRequest
        );


    document
        .getElementById("cancelWithdrawal")
        .addEventListener(
            "click",
            showDashboard
        );


    document
        .getElementById("withdrawBack")
        .addEventListener(
            "click",
            showDashboard
        );


    document
        .getElementById("withdrawHistory")
        .addEventListener(
            "click",
            showHistoryPage
        );


    document
        .getElementById("withdrawLogout")
        .addEventListener(
            "click",
            logout
        );

}

// =============================================================
// SUBMIT WITHDRAWAL REQUEST
// =============================================================

async function submitWithdrawalRequest() {

    const method =
        document
            .getElementById("withdrawMethod")
            .value;

    const amount =
        Number(
            document
                .getElementById("withdrawAmount")
                .value
        );
    
    const accountInfo =
         document
             .getElementById("depositAccount")
             .value
             .trim();

    const message =
        document
            .getElementById("withdrawMessage");


    if (!method) {

        message.textContent =
            "Please select a withdrawal method.";

        return;
    }


    if (
        !Number.isFinite(amount) ||
        amount <= 0
    ) {

        message.textContent =
            "Please enter a valid amount.";

        return;
    }

    if (
    (
        method === "Zelle" ||
        method === "Cash App" ||
        method === "Bitcoin"
    ) &&
    !accountInfo
) {

    message.textContent =
        method === "Zelle"
            ? "Please enter your Zelle number or email."
            : method === "Cash App"
                ? "Please enter your Cash App name."
                : "Please enter your Bitcoin wallet address.";

    return;
}


    try {

        const response =
            await fetch(
                "/api/withdraw",
                {

                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({

                            accountId:
                                CURRENT_ACCOUNT_ID,

                            amount:
                                amount,

                            method:
                                method,
                                
                            accountInfo:
                                accountInfo

                        })

                }
            );


        const result =
            await response.json();


        if (!response.ok) {

            message.textContent =
                result.message ||
                "Withdrawal request failed.";

            return;
        }


        message.textContent =
            "Withdrawal request submitted. Status: Pending.";


        setTimeout(
            showHistoryPage,
            1200
        );


    } catch (error) {

        console.error(
            "Withdrawal request error:",
            error
        );

        message.textContent =
            "Unable to connect to the banking server.";

    }
}

    // =========================================================
    // MY CARDS
    // =========================================================

    function showCardsPage() {

        const name =
            (
                CURRENT_ACCOUNT.name ||
                "CUSTOMER"
            ).toUpperCase();


        const accountNumber =
            CURRENT_ACCOUNT.accountNumber ||
            "00000000";


        const cardDigits =
            String(accountNumber)
                .replace(/\s/g, "")
                .slice(-4);


        document.body.innerHTML = `

            <div class="transfer-page">

                <h1>
                    My Cards
                </h1>


                <div class="card-display">

                    <div class="card-bank-name">
                        Trust Bank
                    </div>


                    <div class="card-chip"></div>


                    <div class="card-number">
                        4821 **** **** ${escapeHtml(cardDigits)}
                    </div>


                    <div class="card-bottom">

                        <div class="card-holder">

                            <span>
                                Card Holder
                            </span>

                            <strong>
                                ${escapeHtml(name)}
                            </strong>

                        </div>


                        <div class="card-expiry">

                            <span>
                                Expires
                            </span>

                            <strong>
                                12/30
                            </strong>

                        </div>

                    </div>


                    <div class="card-cvv">

                        <span>
                            CVV
                        </span>

                        <strong>
                            1**
                        </strong>

                    </div>

                </div>


                <div class="account-card">

                    <div class="account-row">

                        <span>
                            Card Status
                        </span>

                        <strong>
                            ${
                                cardFrozen
                                    ? "Frozen"
                                    : "Active"
                            }
                        </strong>

                    </div>

                </div>


                <button id="freezeCardBtn">

                    ${
                        cardFrozen
                            ? "Unfreeze Card"
                            : "Freeze Card"
                    }

                </button>


                <button id="backDashboard">
                    Back to Dashboard
                </button>

            </div>

        `;


        document
            .getElementById("freezeCardBtn")
            .addEventListener(
                "click",
                function () {

                    cardFrozen =
                        !cardFrozen;


                    saveData();


                    addNotification(
                        cardFrozen
                            ? "Your card has been frozen."
                            : "Your card has been unfrozen.",
                        "Security"
                    );


                    showCardsPage();

                }
            );


        document
            .getElementById("backDashboard")
            .addEventListener(
                "click",
                showDashboard
            );
    }


    // =========================================================
    // SETTINGS
    // =========================================================

    function showSecurityPage() {

        document.body.innerHTML = `

            <div class="transfer-page">

                <h1>
                    Settings & Privacy
                </h1>


                <div class="account-card">

                    <h2>
                        Security
                    </h2>


                    <div class="account-row">
                        <span>Account Status</span>
                        <strong>Secure</strong>
                    </div>


                    <div class="account-row">
                        <span>Login Protection</span>
                        <strong>Enabled</strong>
                    </div>


                    <div class="account-row">
                        <span>Card Protection</span>
                        <strong>Enabled</strong>
                    </div>


                    <button id="changePasswordBtn">
                        Change Password
                    </button>

                </div>


                <div class="account-card">

                    <h2>
                        Transfer Security
                    </h2>


                    <p>
                        Your transfer PIN is required
                        before completing a transfer.
                    </p>


                    <button id="changePinBtn">
                        Change Transfer PIN
                    </button>

                </div>


                <div class="account-card">

                    <h2>
                        Privacy
                    </h2>


                    <p>
                        Your account information is
                        protected by the security controls
                        available in this portal.
                    </p>

                </div>


                <button id="backDashboard">
                    Back to Dashboard
                </button>

            </div>

        `;


        document
            .getElementById("changePasswordBtn")
            .addEventListener(
                "click",
                changePassword
            );


        document
            .getElementById("changePinBtn")
            .addEventListener(
                "click",
                changeTransferPin
            );


        document
            .getElementById("backDashboard")
            .addEventListener(
                "click",
                showDashboard
            );
    }


    // =========================================================
    // CHANGE PASSWORD
    // =========================================================

    function changePassword() {

        const current =
            prompt(
                "Enter your current password:"
            );


        if (current === null) {
            return;
        }


        if (current !== savedPassword) {

            alert(
                "Current password is incorrect."
            );

            return;
        }


        const newPassword =
            prompt(
                "Enter your new password:"
            );


        if (!newPassword) {

            alert(
                "Password cannot be empty."
            );

            return;
        }


        if (newPassword.length < 8) {

            alert(
                "Password must be at least 8 characters."
            );

            return;
        }


        const confirmation =
            prompt(
                "Confirm your new password:"
            );


        if (
            newPassword !== confirmation
        ) {

            alert(
                "Passwords do not match."
            );

            return;
        }


        savedPassword =
            newPassword;


        saveData();


        alert(
            "Password changed for this demo browser."
        );
    }


    // =========================================================
    // CHANGE TRANSFER PIN
    // =========================================================

    function changeTransferPin() {

        const currentPin =
            prompt(
                "Enter your current 4-digit Transfer PIN:"
            );


        if (currentPin === null) {
            return;
        }


        if (currentPin !== transferPin) {

            alert(
                "Current Transfer PIN is incorrect."
            );

            return;
        }


        const newPin =
            prompt(
                "Enter your new 4-digit Transfer PIN:"
            );


        if (
            !/^\d{4}$/.test(newPin)
        ) {

            alert(
                "Transfer PIN must contain exactly 4 numbers."
            );

            return;
        }


        const confirmPin =
            prompt(
                "Confirm your new Transfer PIN:"
            );


        if (
            newPin !== confirmPin
        ) {

            alert(
                "Transfer PINs do not match."
            );

            return;
        }


        transferPin =
            newPin;


        saveData();


        alert(
            "Transfer PIN changed successfully."
        );
    }


    // =========================================================
    // NOTIFICATIONS
    // =========================================================

    function showNotificationsPage() {

        let html = "";


        if (
            notifications.length === 0
        ) {

            html = `

                <div class="account-card">

                    <h3>
                        No notifications
                    </h3>

                    <p>
                        Your notifications will appear here.
                    </p>

                </div>

            `;

        } else {

            notifications.forEach(
                function (item) {

                    html += `

                        <div class="account-card">

                            <h3>
                                ${escapeHtml(
                                    item.type
                                )}
                            </h3>

                            <p>
                                ${escapeHtml(
                                    item.message
                                )}
                            </p>

                            <small>
                                ${escapeHtml(
                                    item.date
                                )}
                            </small>

                        </div>

                    `;

                }
            );

        }


        document.body.innerHTML = `

            <div class="transfer-page">

                <h1>
                    Notifications
                </h1>

                ${html}


                <button id="markAllRead">
                    Mark All as Read
                </button>


                <button id="clearNotifications">
                    Clear Notifications
                </button>


                <button id="backDashboard">
                    Back to Dashboard
                </button>

            </div>

        `;


        notifications.forEach(
            function (item) {
                item.read = true;
            }
        );


        saveData();


        document
            .getElementById("markAllRead")
            .addEventListener(
                "click",
                function () {

                    notifications.forEach(
                        function (item) {
                            item.read = true;
                        }
                    );


                    saveData();


                    showNotificationsPage();

                }
            );


        document
            .getElementById("clearNotifications")
            .addEventListener(
                "click",
                function () {

                    notifications = [];


                    saveData();


                    showNotificationsPage();

                }
            );


        document
            .getElementById("backDashboard")
            .addEventListener(
                "click",
                showDashboard
            );
    }


    // =========================================================
    // TRANSFER PAGE
    // =========================================================

    function showTransferPage() {

        document.body.innerHTML = `

            <div class="transfer-page">

                <h1>
                    Transfer Money
                </h1>


                <label>
                    Transfer Type
                </label>


                <select id="transferType">

                    <option value="local">
                        Local Transfer
                    </option>

                    <option value="international">
                        International Transfer
                    </option>

                </select>


                <input
                    type="text"
                    id="recipientName"
                    placeholder="Recipient Name"
                />


                <input
                    type="text"
                    id="accountNumber"
                    placeholder="Account Number"
                />


                <input
                    type="text"
                    id="bankName"
                    placeholder="Bank Name"
                />


                <div id="localFields">

                    <input
                        type="text"
                        id="routingNumber"
                        placeholder="Routing Number"
                    />

                </div>


                <div
                    id="internationalFields"
                    style="display:none;"
                >

                    <input
                        type="text"
                        id="iban"
                        placeholder="IBAN"
                    />


                    <input
                        type="text"
                        id="swiftCode"
                        placeholder="SWIFT / BIC"
                    />

                </div>


                <input
                    type="text"
                    id="recipientAddress"
                    placeholder="Recipient Address"
                />


                <input
                    type="number"
                    id="transferAmount"
                    placeholder="Amount"
                    min="0"
                    step="0.01"
                />


                <button id="sendTransfer">
                    Send Money
                </button>


                <button id="backDashboard">
                    Back to Dashboard
                </button>

            </div>

        `;


        document
            .getElementById("transferType")
            .addEventListener(
                "change",
                function () {

                    const local =
                        document.getElementById(
                            "localFields"
                        );


                    const international =
                        document.getElementById(
                            "internationalFields"
                        );


                    if (
                        this.value ===
                        "international"
                    ) {

                        local.style.display =
                            "none";

                        international.style.display =
                            "block";

                    } else {

                        local.style.display =
                            "block";

                        international.style.display =
                            "none";
                    }

                }
            );


        document
            .getElementById("sendTransfer")
            .addEventListener(
                "click",
                processTransfer
            );


        document
            .getElementById("backDashboard")
            .addEventListener(
                "click",
                showDashboard
            );
    }


    // =========================================================
    // PROCESS TRANSFER
    // =========================================================

    async function processTransfer() {

        const type =
            document.getElementById(
                "transferType"
            ).value;


        const recipient =
            document.getElementById(
                "recipientName"
            ).value.trim();


        const account =
            document.getElementById(
                "accountNumber"
            ).value.trim();


        const bank =
            document.getElementById(
                "bankName"
            ).value.trim();


        const address =
            document.getElementById(
                "recipientAddress"
            ).value.trim();


        const amount =
            Number(
                document.getElementById(
                    "transferAmount"
                ).value
            );


        if (
            !recipient ||
            !account ||
            !bank ||
            !address ||
            !amount ||
            amount <= 0
        ) {

            alert(
                "Please complete all required fields."
            );

            return;
        }


        let routingNumber = "";
        let iban = "";
        let swift = "";


        if (type === "local") {

            routingNumber =
                document.getElementById(
                    "routingNumber"
                ).value.trim();


            if (!routingNumber) {

                alert(
                    "Please enter the Routing Number."
                );

                return;
            }

        } else {

            iban =
                document.getElementById(
                    "iban"
                ).value.trim();


            swift =
                document.getElementById(
                    "swiftCode"
                ).value.trim();


            if (!iban || !swift) {

                alert(
                    "Please enter the IBAN and SWIFT/BIC Code."
                );

                return;
            }
        }


        if (amount > balance) {

            alert(
                "Insufficient balance."
            );

            return;
        }


        // =====================================================
        // TRANSFER PIN
        // =====================================================

        const enteredPin =
            prompt(
                "Enter your 4-digit Transfer PIN:"
            );


        if (enteredPin === null) {
            return;
        }


        if (enteredPin !== transferPin) {

            alert(
                "Incorrect Transfer PIN. Transfer cancelled."
            );

            return;
        }


        const reference =
            generateReference();


        // =====================================================
        // IMPORTANT:
        // USE THE CURRENT LOGGED-IN ACCOUNT
        // NOT ACC-DAVIES
        // =====================================================

        const result =
            await sendTransferToBackend(
                CURRENT_ACCOUNT_ID,
                amount,
                recipient,
                reference
            );


        if (!result) {
            return;
        }


        balance =
            Number(
                result.balance
            );


        const date =
            new Date().toLocaleString();


        transactions.unshift({

            type:
                "Transfer",

            description:
                type === "international"
                    ? "International Transfer"
                    : "Local Transfer",

            recipient:
                recipient,

            bank:
                bank,

            account:
                account,

            address:
                address,

            routingNumber:
                routingNumber,

            iban:
                iban,

            swift:
                swift,

            amount:
                amount,

            status:
                "Successful",

            reference:
                reference,

            date:
                date

        });


        addNotification(

            "Your " +
            (
                type === "international"
                    ? "international"
                    : "local"
            ) +
            " transfer of " +
            currencySymbol() +
            " " +
            formatMoney(amount) +
            " to " +
            recipient +
            " was successful.",

            "Transfer"

        );


        saveData();


        showTransferReceipt({

            recipient:
                recipient,

            bank:
                bank,

            account:
                account,

            address:
                address,

            routingNumber:
                routingNumber,

            iban:
                iban,

            swift:
                swift,

            amount:
                amount,

            transferType:
                type,

            reference:
                reference,

            date:
                date

        });
    }


    // =========================================================
    // TRANSFER RECEIPT
    // =========================================================

    function showTransferReceipt(data) {

        document.body.innerHTML = `

            <div class="transfer-page">

                <div class="receipt-card">

                    <h1>
                        Transfer Successful
                    </h1>


                    <p>
                        Your transfer has been completed.
                    </p>


                    <hr>


                    <div class="account-row">
                        <span>Status</span>
                        <strong>Successful</strong>
                    </div>


                    <div class="account-row">
                        <span>Reference</span>

                        <strong>
                            ${escapeHtml(
                                data.reference
                            )}
                        </strong>
                    </div>


                    <div class="account-row">
                        <span>Recipient</span>

                        <strong>
                            ${escapeHtml(
                                data.recipient
                            )}
                        </strong>
                    </div>


                    <div class="account-row">
                        <span>Bank</span>

                        <strong>
                            ${escapeHtml(
                                data.bank
                            )}
                        </strong>
                    </div>


                    <div class="account-row">
                        <span>Account Number</span>

                        <strong>
                            ${escapeHtml(
                                data.account
                            )}
                        </strong>
                    </div>


                    ${
                        data.transferType === "local"

                            ? `

                                <div class="account-row">

                                    <span>
                                        Routing Number
                                    </span>

                                    <strong>
                                        ${escapeHtml(
                                            data.routingNumber
                                        )}
                                    </strong>

                                </div>

                            `

                            : `

                                <div class="account-row">

                                    <span>
                                        IBAN
                                    </span>

                                    <strong>
                                        ${escapeHtml(
                                            data.iban
                                        )}
                                    </strong>

                                </div>


                                <div class="account-row">

                                    <span>
                                        SWIFT / BIC
                                    </span>

                                    <strong>
                                        ${escapeHtml(
                                            data.swift
                                        )}
                                    </strong>

                                </div>

                            `
                    }


                    <div class="account-row">

                        <span>
                            Recipient Address
                        </span>

                        <strong>
                            ${escapeHtml(
                                data.address
                            )}
                        </strong>

                    </div>


                    <div class="account-row">

                        <span>
                            Amount
                        </span>

                        <strong>
                            ${currencySymbol()}
                            ${formatMoney(
                                data.amount
                            )}
                        </strong>

                    </div>


                    <div class="account-row">

                        <span>
                            Date
                        </span>

                        <strong>
                            ${escapeHtml(
                                data.date
                            )}
                        </strong>

                    </div>


                    <hr>


                    <button id="receiptDashboard">
                        Back to Dashboard
                    </button>


                    <button id="receiptHistory">
                        View Transaction History
                    </button>

                </div>

            </div>

        `;


        document
            .getElementById("receiptDashboard")
            .addEventListener(
                "click",
                showDashboard
            );


        document
            .getElementById("receiptHistory")
            .addEventListener(
                "click",
                showHistoryPage
            );
    }


    // =========================================================
    // PAY BILLS
    // =========================================================

    function showBillsPage() {

        document.body.innerHTML = `

            <div class="transfer-page">

                <h1>
                    Pay Bills
                </h1>


                <input
                    type="text"
                    id="billerName"
                    placeholder="Biller Name"
                />


                <input
                    type="text"
                    id="customerNumber"
                    placeholder="Customer Number"
                />


                <input
                    type="number"
                    id="billAmount"
                    placeholder="Amount"
                    min="0"
                    step="0.01"
                />


                <button id="payBill">
                    Pay Bill
                </button>


                <button id="backDashboard">
                    Back to Dashboard
                </button>

            </div>

        `;


        document
            .getElementById("payBill")
            .addEventListener(
                "click",
                async function () {

                    const biller =
                        document.getElementById(
                            "billerName"
                        ).value.trim();


                    const customer =
                        document.getElementById(
                            "customerNumber"
                        ).value.trim();


                    const amount =
                        Number(
                            document.getElementById(
                                "billAmount"
                            ).value
                        );


                    if (
                        !biller ||
                        !customer ||
                        !amount ||
                        amount <= 0
                    ) {

                        alert(
                            "Please complete all bill payment fields."
                        );

                        return;
                    }


                    if (amount > balance) {

                        alert(
                            "Insufficient balance."
                        );

                        return;
                    }


                    const reference =
                        generateReference();


                    const date =
                        new Date().toLocaleString();


                    balance -= amount;


                    transactions.unshift({

                        type:
                            "Bill Payment",

                        description:
                            "Bill Payment",

                        recipient:
                            biller,

                        amount:
                            amount,

                        status:
                            "Successful",

                        reference:
                            reference,

                        date:
                            date

                    });


                    addNotification(

                        "Your bill payment of " +
                        currencySymbol() +
                        " " +
                        formatMoney(amount) +
                        " to " +
                        biller +
                        " was successful.",

                        "Bill Payment"

                    );


                    saveData();


                    alert(
                        "Bill payment successful!"
                    );


                    showDashboard();

                }
            );


        document
            .getElementById("backDashboard")
            .addEventListener(
                "click",
                showDashboard
            );
    }


    // =========================================================
    // TRANSACTION HISTORY
    // =========================================================

    function showHistoryPage() {

    let html = "";

    if (transactions.length === 0) {

        html = `
            <div class="history-empty">
                <div class="history-empty-icon">↔</div>

                <h3>No transactions yet</h3>

                <p>
                    Your completed transactions will appear here.
                </p>
            </div>
        `;

    } else {

        transactions.forEach(function (transaction) {

            const amount =
                Number(transaction.amount || 0);

            const isIncoming =
                transaction.type === "credit" ||
                transaction.type === "deposit" ||
                transaction.type === "received";

            html += `

                <div class="history-transaction">

                    <div class="history-left">

                        <div class="history-icon ${
                            isIncoming
                                ? "history-icon-incoming"
                                : "history-icon-outgoing"
                        }">

                            ${isIncoming ? "↓" : "↑"}

                        </div>

                        <div class="history-details">

                            <strong>
                                ${escapeHtml(
                                    transaction.description ||
                                    transaction.type ||
                                    "Transaction"
                                )}
                            </strong>

                            <span>
                                ${
                                    isIncoming
                                        ? "Money received"
                                        : "Transfer"
                                }
                            </span>

                            <small>
                                ${escapeHtml(
                                    transaction.date ||
                                    ""
                                )}
                            </small>

                        </div>

                    </div>


                    <div class="history-right">

                        <strong class="${
                            isIncoming
                                ? "history-credit"
                                : "history-debit"
                        }">

                            ${isIncoming ? "+" : "-"}

                            ${currencySymbol()}
                            ${formatMoney(amount)}

                        </strong>

                        <span>
                            ${
                                transaction.reference
                                    ? "Ref: " +
                                      escapeHtml(
                                          transaction.reference
                                      )
                                    : ""
                            }
                        </span>

                    </div>

                </div>

            `;

        });

    }


    document.body.innerHTML = `

        <div class="history-page">

            <div class="history-header">

                <button
                    id="backDashboard"
                    class="history-back"
                >
                    ← Back
                </button>

                <div>

                    <h1>
                        Transaction History
                    </h1>

                    <p>
                        View your recent account activity
                    </p>

                </div>

            </div>


            <div class="history-card">

                <div class="history-card-header">

                    <div>

                        <h2>
                            Recent Transactions
                        </h2>

                        <p>
                            ${transactions.length}
                            transaction${
                                transactions.length === 1
                                    ? ""
                                    : "s"
                            }
                        </p>

                    </div>

                </div>


                <div class="history-list">

                    ${html}

                </div>

            </div>

        </div>

    `;


    document
        .getElementById("backDashboard")
        .addEventListener(
            "click",
            showDashboard
        );
}

    // =========================================================
    // LOGOUT
    // =========================================================

    function logout() {

        localStorage.removeItem(
            "trustBankAccountId"
        );


        localStorage.removeItem(
            "trustBankAccount"
        );


        localStorage.removeItem(
            "trustBankBalance"
        );


        CURRENT_ACCOUNT_ID = null;

        CURRENT_ACCOUNT = null;

        balance = 0;

        transactions = [];

        notifications = [];


        window.location.href = "/";
    }


    // =========================================================
    // START EXISTING SESSION
    // =========================================================

    const existingAccount =
        localStorage.getItem(
            "trustBankAccountId"
        );


    if (
        existingAccount &&
        !landingLoginForm
    ) {

        loadCustomerAccount()
            .then(
                function (success) {

                    if (success) {

                        showDashboard();

                    }

                }
            );

    }

});


// =============================================================
// BACKEND TRANSFER REQUEST
// =============================================================

async function sendTransferToBackend(
    accountId,
    amount,
    recipient,
    reference
) {

    try {

        const response =
            await fetch(
                "/api/transfer",
                {

                    method:
                        "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({

                            accountId:
                                accountId,

                            amount:
                                Number(amount),

                            recipient:
                                recipient,

                            reference:
                                reference

                        })

                }
            );


        const result =
            await response.json();


        if (!response.ok) {

            alert(
                result.message ||
                "Transfer failed."
            );

            return false;
        }


        return result;


    } catch (error) {

        console.error(
            "Transfer error:",
            error
        );


        alert(
            "Unable to connect to the banking server."
        );


        return false;
    }
}