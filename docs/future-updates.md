# Future Updates & Roadmap

This document serves as a backlog for future features, ideas, and system enhancements that have been deferred for later phases of development.

## 1. Automated Bank Reconciliation

**Status**: Deferred
**Description**: 
Automatically detect when a payment is received from a client or when a payout to a supplier successfully clears, and update the ledger automatically without manual entry.

**Implementation Options**:
- **Virtual Accounts / Payment Gateway**: Integrate RazorpayX or Cashfree to generate dynamic UPI QR codes or virtual accounts for each client. When a payment hits the virtual account, the payment gateway fires a webhook to our Firebase backend to auto-update the ledger.
- **Open Banking API**: Integrate Setu or ICICI Connected Banking to programmatically fetch the current account bank statement every 15 minutes, parsing UTR numbers to match outstanding invoices.
- **Email Parsing**: Set up a Make.com/Zapier automation to read "Credit Alert" emails from the bank and push the extracted amounts into the Firebase database.
