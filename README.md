# Currency Exchange — Order Entry

Order entry module for a currency exchange system: submit and manage **Take Profit** and **Stop Loss** orders. This covers order entry only — there is no matching/execution engine or market data feed here.

## Stack

- **Backend**: Java 21, Spring Boot, Spring Data MongoDB (Maven)
- **Frontend**: TypeScript, React, Vite
- **Database**: MongoDB

## Prerequisites

- JDK 21+
- Maven 3.9+ (or use your IDE's bundled Maven)
- Node.js 20+ and npm
- MongoDB running locally (`mongodb://localhost:27017`) or a connection string to a hosted instance (e.g. MongoDB Atlas)

## Backend

```
cd backend
mvn spring-boot:run
```

Runs on `http://localhost:8080`. By default it connects to `mongodb://localhost:27017/currency_exchange`; override with the `MONGODB_URI` environment variable.

### API

| Method | Path              | Description                     |
|--------|-------------------|----------------------------------|
| POST   | `/api/orders`     | Create an order                  |
| GET    | `/api/orders`     | List all orders (newest first)   |
| GET    | `/api/orders/{id}`| Get a single order                |
| DELETE | `/api/orders/{id}`| Cancel an order                  |

Create request body:

```json
{
  "currencyPair": "EUR/USD",
  "side": "BUY",
  "type": "TAKE_PROFIT",
  "triggerPrice": 1.0850,
  "amount": 1000
}
```

`side` is `BUY` or `SELL`; `type` is `TAKE_PROFIT` or `STOP_LOSS`.

## Frontend

```
cd frontend
npm install
npm run dev
```

Runs on `http://localhost:5173` and talks to the backend at `http://localhost:8080` by default (override via `VITE_API_BASE_URL` in a `.env` file — see `.env.example`).

## Running both

Start MongoDB, then the backend, then the frontend, each in its own terminal.
