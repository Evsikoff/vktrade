# vktrade

Payment callback service for VK and OK games.

## VK endpoints

- `POST /vk/callback` receives `get_item` and `order_status_change` notifications.
- `POST /vk/verify` accepts `{ item, launch }` from a VK Mini App and returns the
  authenticated user's confirmed order ledger.

`order_status_change` is persisted before VK receives a successful response. The
client must grant a product only after its unique `order_id` appears in `/vk/verify`.

## Required production configuration

For each VK app that uses verification, configure its protected app key as an
environment secret. For the Ants app (`54729341`):

```text
VK_APP_SECRET_54729341=<protected app key>
VK_ALLOW_TEST=0
VK_ORDERS_FILE=/data/vk-orders.json
```

Never commit the protected key. `VK_ORDERS_FILE` must point at persistent storage
in production (a mounted Fly volume for the current deployment). A JSON ledger is
appropriate for a single server process; use a transactional database before
running more than one instance.

## Checks

```bash
cd app
npm test -- --runInBand
npm run build
```
