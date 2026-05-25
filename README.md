# SmartBiz Retail Application

SmartBiz Retail is a full-stack retail management system built with Express, MongoDB and Angular. It supports secure login, inventory control, customer records, sales processing, reporting and assignment-ready API integration demos.

## Main Features

- Authentication with login, registration, email verification demo and forgot-password demo.
- Protected backend routes using JWT tokens and role checks.
- Dashboard with total revenue, daily revenue, monthly sales, customers, products, low-stock alerts and recent sales.
- Product/inventory CRUD with stock status, reorder levels and delete confirmation.
- Customer CRUD with searchable customer records.
- Sales creation with empty-order prevention, stock validation and automatic stock reduction.
- Sales edit/cancel actions with stock restoration on cancellation.
- Reports page with sales summary, revenue, inventory value, customer purchase summary, best-selling products, low-stock report and sales history.
- Downloadable sales CSV report.
- Demo API cards for weather/logistics, AED currency conversion and courier tracking with safe mock data.
- Responsive Bootstrap UI with alerts, badges, cards and tables.

## Project Structure

```text
smartbiz-retail-app/
  backend/       Express API, MongoDB models, routes and seed script
  frontend2/     Runnable Angular application
  frontend/      Original loose frontend source kept for reference
```

Use `backend` and `frontend2` to run the final application.

## Requirements

- Node.js 20 or newer recommended.
- MongoDB running locally, or a MongoDB Atlas connection string.
- npm.

## Backend Setup

```bash
cd backend
npm install
npm run seed
npm start
```

The backend runs on:

```text
http://localhost:5000
```

Default `.env` values:

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/smartbiz
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
JWT_EXPIRES_IN=7d
NODE_ENV=development
EMAIL_USER=
EMAIL_PASS=
```

Seed login:

```text
Email: admin@smartbiz.local
Password: Admin123!
Role: admin
```

## Frontend Setup

Open a second terminal:

```bash
cd frontend2
npm install
npm start
```

The Angular app runs on:

```text
http://localhost:4200
```

## API Demo Notes

The dashboard and reports pages include demo integrations for:

- Weather/logistics alerts.
- AED currency exchange conversion.
- Courier tracking status.

These are intentionally safe demo responses served by the backend, so no paid API keys are required. This keeps the project stable for assignment marking while clearly showing API integration design.

Email verification also runs in demo mode when `EMAIL_USER` and `EMAIL_PASS` are blank. New registrations, resend requests and unverified-login attempts show:

```text
Demo OTP: 123456
```

## Testing Checklist

- Run `npm run build` in `frontend2`.
- Run `node --check server.js` in `backend`.
- Login with the seed admin account.
- Add, edit and delete a product.
- Add, edit and delete a customer.
- Create a sale and verify inventory stock reduces.
- Attempt a sale with quantity above stock and confirm it is blocked.
- Cancel a sale and confirm stock is restored.
- Open Dashboard and Reports to confirm live statistics load.
- Download the sales CSV report.

## Troubleshooting

- If login fails, run `npm run seed` in `backend` and use the seed credentials.
- If the backend cannot start, confirm MongoDB is running and `MONGODB_URI` is correct.
- If email sending is not configured, verification shows `Demo OTP: 123456` on screen and also logs demo information in the backend console.
- If Angular shows size-budget warnings during build, they are non-blocking warnings from the existing visual styling.
