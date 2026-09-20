# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Order entry module for a currency exchange system: create, list, and cancel **Take Profit** and **Stop Loss** orders. Scope is deliberately limited to order entry — there is no matching/execution engine and no market data feed. Orders only ever move `PENDING` → `CANCELLED`; there is no "filled" state.

## Commands

### Backend (`backend/`, Java 21 / Spring Boot / Maven)

```
mvn spring-boot:run          # run the API on http://localhost:8080
mvn compile                  # compile only
mvn test                     # run all tests
mvn test -Dtest=OrderServiceTest   # run a single test class
mvn clean package            # build the jar
```

Connects to MongoDB at `spring.data.mongodb.uri` (`application.yml`), default `mongodb://localhost:27017/currency_exchange`, overridable via the `MONGODB_URI` env var. CORS allowed origin defaults to `http://localhost:5173`, overridable via `FRONTEND_ORIGIN`.

### Frontend (`frontend/`, TypeScript / React / Vite)

```
npm install
npm run dev        # dev server on http://localhost:5173
npm run build       # tsc -b && vite build
npm run preview
```

Talks to the backend via `VITE_API_BASE_URL` (see `.env.example`), default `http://localhost:8080`.

## Architecture

**Backend** (`backend/src/main/java/com/currencyexchange/orderentry/`) is a standard layered Spring Boot app:

- `model/` — `Order` (the Mongo `@Document`), and enums `OrderSide` (BUY/SELL), `OrderType` (TAKE_PROFIT/STOP_LOSS), `OrderStatus` (PENDING/CANCELLED).
- `repository/OrderRepository` — `MongoRepository<Order, String>`.
- `service/OrderService` — the only place that touches the repository; builds `Order` from `CreateOrderRequest`, throws `OrderNotFoundException` when an id doesn't resolve.
- `controller/OrderController` — thin REST layer at `/api/orders` (POST create, GET list/get, DELETE cancel). No business logic here.
- `dto/` — `CreateOrderRequest` (bean-validated: currency pair must match `^[A-Z]{3}/[A-Z]{3}$`, amounts/prices must be `> 0`) and `ApiError` (uniform error response shape).
- `exception/GlobalExceptionHandler` — turns validation failures and `OrderNotFoundException` into JSON `ApiError` responses (400/404) instead of stack traces.
- `config/WebConfig` — CORS registration for the frontend origin.

Adding a new order type is meant to be a small, additive change: add the enum value to `OrderType` (and any type-specific fields to `Order`/`CreateOrderRequest`) — the controller/service/repository layers don't need restructuring for it.

**Frontend** (`frontend/src/`) is a single-page form + list, no routing/state library:

- `types/order.ts` — TS types mirroring the backend's enums and DTOs; keep these in sync with the Java side by hand (no shared schema/codegen).
- `api/orderApi.ts` — thin `fetch` wrapper (`createOrder`, `listOrders`, `cancelOrder`); the only module that knows about `VITE_API_BASE_URL` and the API's JSON shape.
- `components/OrderEntryForm.tsx` — controlled form with client-side validation mirroring the backend's constraints; calls `onSubmit` (wired to `createOrder` in `App.tsx`).
- `components/OrderList.tsx` — renders orders, cancel button per row.
- `App.tsx` — owns the `orders` state and re-fetches the list after every create/cancel (no optimistic updates or caching layer).

## Test Strategy
See .claude/rules/test-strategy.md for our testing approach.