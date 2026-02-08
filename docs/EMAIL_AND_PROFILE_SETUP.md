# Email (Resend + Supabase) and Display Name Setup

## 1. Resend: Add and verify your domain

So confirmation emails (and magic links) can be sent to any address, not just your Resend account email.

1. Go to [Resend](https://resend.com) and sign in.
2. In the left sidebar, open **Domains** (or **Add a domain** from the “Send your first email” flow).
3. Click **Add domain**.
4. Enter your domain (e.g. `snapmap.lol` or `mail.yourdomain.com`).
5. Resend will show **DNS records** to add (TXT, MX, and sometimes CNAME). Add these in your domain’s DNS (where you bought the domain or your DNS provider).
6. In Resend, click **Verify**. Once status is “Verified”, you can send from `noreply@yourdomain.com` (or any address @ that domain).

## 2. Supabase SMTP: Use your domain as sender

After the domain is verified in Resend:

1. In [Supabase](https://supabase.com/dashboard), open your project.
2. Go to **Authentication** (main left sidebar) → **Emails** (or **Notifications** → **Email**) → **SMTP Settings**.
3. Ensure **Enable custom SMTP** is **ON**.
4. Set:
   - **Sender email**: `noreply@yourdomain.com` (use the domain you verified in Resend).
   - **Sender name**: `SnapMap` (or your app name).
   - **Host**: `smtp.resend.com`
   - **Port**: `465`
   - **Username**: `resend`
   - **Password**: Your Resend **API key** (Dashboard → API Keys → Create / copy).
5. Click **Save changes**.

You can turn **Confirm email** back **ON** in **Authentication** → **Sign In / Providers** so new users must confirm their email; those emails will now be sent via your domain.

## 3. Display name in the app

- After signing in, open **Settings** (gear) → **Profile** to go to your profile.
- On your own profile page, click **Edit profile** to set your **Display name** and optional **Bio**. Your **username** (e.g. `@yourname`) is created from your email when you first sign in and is shown on your profile.
