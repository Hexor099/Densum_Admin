# Upcoming Changes

## Phase 2: Full-Fledged Business Website & RBAC
- [ ] Build a public-facing website for the business to attract clients and provide information.
- [ ] Move the current `Densum_Admin` application into a secured `/admin` route (or behind an "Accounts" button).
- [ ] Implement Role-Based Access Control (RBAC):
  - **Public Visitors**: See the homepage, services, and contact info.
  - **Staff/Employees**: Access a limited version of the dashboard with their assigned tasks or schedules based on their Firebase `roles`.
  - **Admins**: Full access to the entire dashboard and financial tools (the current app).
- [ ] **Activity Logging System**: Track staff actions (e.g., creating/editing entries, uploading files, changing balances) and store them in an admin-only accessible database node for monitoring and auditing.
