# Leads CRM API

A backend API for tracking leads from social media platforms (Meta/Facebook/Instagram, Snapchat, TikTok).

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your credentials
# Then start the server
npm run dev
```

## Environment Variables

| Variable                 | Description                                 |
| ------------------------ | ------------------------------------------- |
| `PORT`                   | Server port (default: 3000)                 |
| `MONGODB_URI`            | MongoDB connection string                   |
| `META_VERIFY_TOKEN`      | Token for Meta webhook verification         |
| `META_APP_SECRET`        | Meta app secret for signature verification  |
| `META_ACCESS_TOKEN`      | Page access token for fetching lead details |
| `SNAPCHAT_CLIENT_SECRET` | Snapchat client secret                      |
| `TIKTOK_APP_SECRET`      | TikTok app secret                           |

---

## API Endpoints

### Leads

| Method   | Endpoint           | Description                  |
| -------- | ------------------ | ---------------------------- |
| `GET`    | `/api/leads`       | List leads with filters      |
| `GET`    | `/api/leads/:id`   | Get single lead              |
| `PATCH`  | `/api/leads/:id`   | Update lead status/notes     |
| `DELETE` | `/api/leads/:id`   | Delete lead                  |
| `GET`    | `/api/leads/stats` | Get lead statistics          |
| `GET`    | `/api/leads/chart` | Get leads by date for charts |

### Query Parameters for `GET /api/leads`

| Param       | Type     | Description                                                            |
| ----------- | -------- | ---------------------------------------------------------------------- |
| `platform`  | string   | Filter by platform: `meta`, `snapchat`, `tiktok`                       |
| `status`    | string   | Filter by status: `new`, `contacted`, `qualified`, `converted`, `lost` |
| `search`    | string   | Search by name, email, or phone                                        |
| `fromDate`  | ISO date | Filter from date                                                       |
| `toDate`    | ISO date | Filter to date                                                         |
| `page`      | number   | Page number (default: 1)                                               |
| `limit`     | number   | Items per page (default: 20)                                           |
| `sortBy`    | string   | Sort field (default: `receivedAt`)                                     |
| `sortOrder` | string   | `asc` or `desc` (default: `desc`)                                      |

### Webhooks

| Method | Endpoint             | Platform             |
| ------ | -------------------- | -------------------- |
| `GET`  | `/webhooks/meta`     | Meta verification    |
| `POST` | `/webhooks/meta`     | Meta lead events     |
| `POST` | `/webhooks/snapchat` | Snapchat lead events |
| `POST` | `/webhooks/tiktok`   | TikTok lead events   |

---

## Lead Object Schema

```json
{
  "_id": "ObjectId",
  "platform": "meta | snapchat | tiktok",
  "platformLeadId": "string",
  "formId": "string",
  "formName": "string",
  "adId": "string",
  "campaignId": "string",
  "customerName": "string",
  "firstName": "string",
  "lastName": "string",
  "email": "string",
  "phone": "string",
  "customFields": {},
  "status": "new | contacted | qualified | converted | lost",
  "notes": "string",
  "platformCreatedAt": "ISO date",
  "receivedAt": "ISO date",
  "createdAt": "ISO date",
  "updatedAt": "ISO date"
}
```

---

## Platform Setup

### Meta (Facebook/Instagram)

1. Go to [developers.facebook.com](https://developers.facebook.com)
2. Create an app and add "Webhooks" product
3. Subscribe to `leadgen` field for your Page
4. Set callback URL to `https://yourdomain.com/webhooks/meta`
5. Set verify token to match `META_VERIFY_TOKEN` in .env

### Snapchat

1. Go to [business.snapchat.com](https://business.snapchat.com)
2. Navigate to Lead Gen settings
3. Set webhook URL to `https://yourdomain.com/webhooks/snapchat`

### TikTok

1. Go to [ads.tiktok.com](https://ads.tiktok.com) → Tools → Lead Generation
2. Configure webhook callback URL: `https://yourdomain.com/webhooks/tiktok`

---

## Example Requests

```bash
# Get all leads
curl http://localhost:3000/api/leads

# Get leads from Meta only
curl "http://localhost:3000/api/leads?platform=meta"

# Get new leads from last 7 days
curl "http://localhost:3000/api/leads?status=new&fromDate=2025-01-21"

# Update lead status
curl -X PATCH http://localhost:3000/api/leads/123 \
  -H "Content-Type: application/json" \
  -d '{"status": "contacted", "notes": "Called customer"}'

# Get statistics
curl http://localhost:3000/api/leads/stats
```
