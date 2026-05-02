# ZaoDirect MVP Stabilization + Operator Runbook

## A. 1-Day Stabilization Sprint (Execute In Order)
- Run frontend build: `cd frontend && npm run build`
- Start backend: `cd backend && npm run dev`
- Start frontend: `cd frontend && npm start`
- Log in as Admin at `http://localhost:3000`
- Verify no red API errors on:
- `Dashboard`
- `International Orders`
- `Farmer Procurement`
- `Batch & Quality`
- `Finance Tracker`
- `Shipment Tracking`
- `Financier Readiness`
- Verify `Mark Paid` works for procurement orders in `Picked up` or `Settled`
- Verify international order status auto-updates to `Delivered` when delivered quantity reaches required quantity
- Verify `Create Procurement` and `Create Batch` are disabled only for `Shipped`, `Delivered`, `Cancelled` orders
- Verify `Create Procurement` and `Create Batch` still work for `Partially shipped` orders
- Verify shipped KPI on International Orders includes both `Shipped` and `Delivered` orders
- Record any failures in `Exceptions & Disputes` as `HIGH` severity
- Fix blocker bugs immediately before moving to pilot

## B. Start Of Day
- Start backend: `cd backend && npm run dev`
- Start frontend: `cd frontend && npm start`
- Confirm app loads at `http://localhost:3000`
- Log in as Admin and confirm no red errors on Dashboard

## C. Capture International Demand
- Go to `International Orders` -> `Create Order`
- Fill buyer details, crop type, quantity, unit, and required `Target Price`
- Save order and confirm it appears in Order Book with:
- `Open` status
- Correct `Price`
- Correct `Order value`

## D. Push Procurement To Farmers
- On International Orders, click `Create Procurement`
- Choose farmer with matching crop listing
- Save procurement order
- Confirm farmer can see request in their procurement page

## E. Farmer Confirmation
- Farmer opens request and sets status to `Confirmed`
- Admin checks `Farmer Procurement` and confirms order status is `Confirmed`

## F. Allocate To Batch
- Admin opens procurement order and allocates quantity to batch
- If no suitable batch exists, use `Create Batch` then allocate
- Confirm redirect to Batch page succeeds
- Confirm allocation appears under `Current Allocations`

## G. Pickup + QA
- In Batch page, add QA check for allocated order
- Enter rejected quantity only if needed
- Confirm accepted quantity updates correctly
- When farmer is ready, status should progress to pickup flow as configured

## H. Partial Shipment Lots
- Create shipment lot with quantity (lot code auto-generates)
- Move lot status in strict order only:
- `Created` -> `Dispatched` -> `Shipped` -> `Delivered`
- Confirm invalid jumps are blocked with clear error

## I. Financial Effects
- After dispatch stage, verify payout records are created/updated
- In `Finance Tracker`, confirm records reflect expected pending/paid state
- Settling procurement and marking payout paid should remain synchronized

## J. International Fulfillment Tracking
- Return to `International Orders`
- Confirm shipped quantity, remaining quantity, and fulfillment % reflect lot progress
- Confirm order status auto-progresses by shipment reality:
- `Open` -> `Procurement` -> `Partially shipped` -> `Shipped` -> `Delivered`

## K. Financier Readiness Verification
- Open `Financier Readiness`
- Confirm these metrics update with live operations:
- Trade worth moved YTD
- In-transit worth YTD
- Delivered worth YTD
- Open order value
- Pending payout value
- Export `Full Pack` and verify CSV files download

## L. End Of Day Controls
- Check `Exceptions & Disputes` for open critical cases
- Check `Audit Log` for major status and payout actions
- Confirm no orders are stuck in invalid intermediate states

## M. Deployment Checklist (Pilot-Ready)
- Confirm `.env` values are production-safe:
- strong `JWT_SECRET`
- correct `DATABASE_URL`
- correct `FRONTEND_URL`
- Run required migrations on prod DB:
- `npm run db:migrate:mvp-operations`
- `npm run db:migrate:shipment-events`
- `npm run db:migrate:audit-events`
- `npm run db:migrate:dispute-cases`
- `npm run db:migrate:batch-shipment-lots`
- `npm run db:migrate:intl-order-statuses`
- Create admin user if needed: `npm run db:seed`
- Restart backend and verify `/api/auth/login` and `/api/ops/kpis` work
- Verify CORS allows only approved frontend origins
- Take DB backup before first live pilot day

## N. Demo Script (5 Minutes)
- Create international order with price
- Create procurement for farmer
- Confirm farmer order
- Allocate to batch
- Add QA
- Create and dispatch lot
- Show International Orders fulfillment update
- Show Financier Readiness value update
- Export evidence pack
