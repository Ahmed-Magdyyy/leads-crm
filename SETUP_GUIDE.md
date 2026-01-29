# Platform Setup Guide

Complete step-by-step guide to get all required API credentials for Meta, Snapchat, and TikTok.

---

## 🔵 Meta (Facebook/Instagram)

### Prerequisites

- Facebook Business Account
- A Facebook Page where you'll run Lead Ads
- (Optional) Instagram Business Account linked to your Page

### Step 1: Create a Meta App

1. Go to [developers.facebook.com](https://developers.facebook.com)
2. Click **My Apps** → **Create App**
3. Select **Business** as the app type
4. Fill in:
   - App name: `Leads CRM` (or your choice)
   - App contact email: your email
   - Business Account: select yours
5. Click **Create App**

### Step 2: Get META_APP_SECRET

1. In your app dashboard, go to **Settings** → **Basic**
2. Find **App Secret** - click "Show" and enter password
3. Copy this value → This is your `META_APP_SECRET`

```
META_APP_SECRET=abc123def456...
```

### Step 3: Set META_VERIFY_TOKEN

This is **any string you create yourself**. It's used to verify Facebook is calling your real webhook.

1. Make up a random secure string, e.g.: `my_super_secret_token_123`
2. Save it in your `.env`:

```
META_VERIFY_TOKEN=my_super_secret_token_123
```

> ⚠️ Keep this secret! You'll enter this same value in Facebook's webhook setup.

### Step 4: Add Webhooks Product

1. In your app dashboard, click **Add Product**
2. Find **Webhooks** and click **Set Up**
3. Click **Webhooks** in the left sidebar
4. Select **Page** from the dropdown
5. Click **Subscribe to this object**
6. Enter:
   - **Callback URL**: `https://yourdomain.com/webhooks/meta`
   - **Verify Token**: Same value as `META_VERIFY_TOKEN` in your .env
7. Click **Verify and Save**
8. Subscribe to the **leadgen** field (check the box)

### Step 5: Get META_ACCESS_TOKEN (Page Access Token)

1. Go to [Graph API Explorer](https://developers.facebook.com/tools/explorer/)
2. Select your app from the dropdown
3. Click **Generate Access Token**
4. Add these permissions:
   - `pages_show_list`
   - `pages_read_engagement`
   - `pages_manage_metadata`
   - `leads_retrieval`
   - `ads_management`
5. Click **Generate Access Token** and approve
6. This gives you a **User Access Token** (expires in ~1 hour)

**To get a long-lived Page Access Token:**

1. In Graph API Explorer, paste:
   ```
   GET /me/accounts
   ```
2. Click Submit
3. Find your Page in the response
4. Copy the `access_token` for that page → This is your `META_ACCESS_TOKEN`

**Make it permanent (never expires):**

```
GET /oauth/access_token?grant_type=fb_exchange_token&client_id=YOUR_APP_ID&client_secret=YOUR_APP_SECRET&fb_exchange_token=YOUR_SHORT_TOKEN
```

### Step 6: Complete App Review (for Production)

For development/testing, you can skip this. For production:

1. Go to **App Review** → **Permissions and Features**
2. Request these permissions:
   - `leads_retrieval`
   - `pages_manage_metadata`
   - `pages_read_engagement`
3. Submit for review with a screencast showing your integration

---

## 🟡 Snapchat

### Prerequisites

- Snapchat Business Account
- Snapchat Ads Manager access

### Step 1: Create OAuth App

1. Log in to [Ads Manager](https://ads.snapchat.com)
2. Click on your profile → **Business Settings**
3. Go to **Business Details**
4. Scroll down to **OAuth Apps**
5. Click **+ OAuth App**
6. Accept the Developer Terms
7. Fill in:
   - **App Name**: `Leads CRM`
   - **Redirect URI**: `https://yourdomain.com/auth/snapchat/callback` (or any valid URL)
8. Click **Create**

### Step 2: Get SNAPCHAT_CLIENT_SECRET

After creating the OAuth App:

1. You'll see **Client ID** and **Client Secret**
2. Copy the **Client Secret** → This is your `SNAPCHAT_CLIENT_SECRET`

```
SNAPCHAT_CLIENT_SECRET=your_client_secret_here
```

> ⚠️ The Client Secret is only shown once! Save it immediately.

### Step 3: Configure Lead Webhook

1. In Ads Manager, go to **Lead Generation** settings
2. Find webhook configuration
3. Set your webhook URL: `https://yourdomain.com/webhooks/snapchat`
4. Snapchat will sign webhooks using your Client Secret

---

## ⬛ TikTok

### Prerequisites

- TikTok For Business account
- TikTok Ads Manager access

### Step 1: Create Developer App

1. Go to [TikTok for Developers](https://developers.tiktok.com/)
2. Click **Manage Apps** → **Create App**
3. Select **Marketing API** as the product
4. Fill in app details:
   - **App Name**: `Leads CRM`
   - **Description**: Lead management system
5. Submit for approval (usually quick)

### Step 2: Get TIKTOK_APP_SECRET

1. After app approval, go to **Manage Apps**
2. Click on your app
3. Go to **App Credentials** or **Basic Information**
4. Find **App Secret** → This is your `TIKTOK_APP_SECRET`

```
TIKTOK_APP_SECRET=your_tiktok_app_secret_here
```

### Step 3: Configure Lead Generation Webhook

1. Go to [TikTok Ads Manager](https://ads.tiktok.com)
2. Navigate to **Tools** → **Lead Generation**
3. Click on **Settings** or **Data Connection**
4. Set your webhook callback URL: `https://yourdomain.com/webhooks/tiktok`
5. TikTok will use your App Secret to sign webhook payloads

---

## 📋 Final .env Configuration

After completing all steps, your `.env` should look like:

```env
# Environment Variables
PORT=3000
NODE_ENV=development

# MongoDB
MONGODB_URI=mongodb://localhost:27017/leads-crm

# Meta (Facebook/Instagram)
META_VERIFY_TOKEN=my_super_secret_token_123
META_APP_SECRET=1234567890abcdef1234567890abcdef
META_ACCESS_TOKEN=EAAGxxx...very_long_token...xxx

# Snapchat
SNAPCHAT_CLIENT_SECRET=abc123-your-client-secret-xyz789

# TikTok
TIKTOK_APP_SECRET=your_tiktok_secret_key_here
```

---

## ⚠️ Important Notes

1. **HTTPS Required**: All platforms require your webhook URL to use HTTPS with a valid SSL certificate

2. **Development vs Production**:
   - Meta: App must be in "Live" mode and pass App Review for production
   - Snapchat: Test mode available for development
   - TikTok: Sandbox mode available for testing

3. **Token Expiration**:
   - Meta Page Access Token: Can be made permanent (never expires)
   - Snapchat/TikTok: App secrets don't expire

4. **Testing Without Real Server**:
   - Use [ngrok](https://ngrok.com) to create a public HTTPS URL for your localhost:
     ```bash
     ngrok http 3000
     ```
   - Use the ngrok URL as your webhook endpoint for testing

---

## 🧪 Quick Testing Checklist

- [ ] Meta: Use [Lead Ads Testing Tool](https://developers.facebook.com/tools/lead-ads-testing)
- [ ] Snapchat: Create test ad account with `test: true`
- [ ] TikTok: Use Sandbox mode in Developer Portal
- [ ] Verify your webhook receives the test payload
- [ ] Check leads appear in your database
