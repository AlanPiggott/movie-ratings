# Security Guide for Movie Score

## 🔐 Environment Variables

### Critical Security Steps

1. **Rotate ALL Credentials Immediately**
   - Generate new Supabase service key
   - Get new API keys from TMDB
   - Change DataForSEO password
   - Create a strong admin password

### Generating a Strong Admin Password

Use one of these methods to create a secure admin password:

**Option 1: Using OpenSSL (Recommended)**
```bash
openssl rand -base64 32
```

**Option 2: Using Node.js**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**Option 3: Using a password manager**
- Use 1Password, Bitwarden, or similar to generate a 32+ character password

### Environment Variables Setup

Create `.env.local` with these variables:

```env
# Database (get from Supabase dashboard)
DATABASE_URL="postgresql://..."

# Supabase (ROTATE THESE!)
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_KEY="your-service-key"

# TMDB API (get new keys from TMDB)
TMDB_API_KEY="your-api-key"
TMDB_API_READ_ACCESS_TOKEN="your-token"

# DataForSEO (change password!)
DATAFORSEO_LOGIN="your-email"
DATAFORSEO_PASSWORD="new-strong-password"

# Admin (use generated password)
ADMIN_PASSWORD="your-generated-strong-password"

# App URL
NEXT_PUBLIC_APP_URL="https://your-domain.com"
```

## 🛡️ Security Features Implemented

### 1. Admin Route Protection
- All `/api/admin/*` routes require authentication
- Use Bearer token with admin password
- Example:
  ```bash
  curl -H "Authorization: Bearer YOUR_ADMIN_PASSWORD" \
    https://your-site.com/api/admin/rating-stats
  ```

### 2. Security Headers
The middleware adds these security headers to all responses:
- `X-Content-Type-Options: nosniff` - Prevents MIME type sniffing
- `X-Frame-Options: DENY` - Prevents clickjacking
- `X-XSS-Protection: 1; mode=block` - XSS protection
- `Referrer-Policy: strict-origin-when-cross-origin` - Controls referrer info
- `Permissions-Policy` - Disables unnecessary browser features
- `Strict-Transport-Security` - Forces HTTPS (production only)

### 3. Error Message Protection
- Production errors show generic messages
- Detailed errors only in development
- No stack traces exposed to users

## 🚨 Security Checklist

### Before Deployment
- [ ] Rotate all API keys and passwords
- [ ] Update Vercel environment variables
- [ ] Use strong admin password (32+ characters)
- [ ] Remove any test/demo credentials
- [ ] Review all NEXT_PUBLIC_ variables (these are visible to users!)

### Regular Maintenance
- [ ] Rotate API keys every 90 days
- [ ] Monitor API usage for anomalies
- [ ] Check Supabase logs for suspicious activity
- [ ] Update dependencies regularly
- [ ] Review admin access logs

## 📊 Monitoring Recommendations

### 1. Set up Alerts
- Supabase: Enable email alerts for unusual activity
- TMDB: Monitor API usage dashboard
- DataForSEO: Check monthly usage
- Vercel: Enable deployment notifications

### 2. API Rate Limiting
Consider implementing rate limiting:
- Use Vercel Edge Config
- Or implement custom middleware
- Set reasonable limits per IP/user

### 3. Logging
- Keep admin action logs
- Monitor failed authentication attempts
- Track API usage patterns

## 🆘 Incident Response

If you suspect a security breach:

1. **Immediately rotate all credentials**
2. **Check access logs** in Supabase and Vercel
3. **Review recent deployments**
4. **Enable 2FA** on all services
5. **Notify users** if data was affected

## 📚 Additional Resources

- [Supabase Security Best Practices](https://supabase.com/docs/guides/platform/security)
- [Next.js Security Headers](https://nextjs.org/docs/advanced-features/security-headers)
- [OWASP Security Guidelines](https://owasp.org/www-project-top-ten/)
- [Vercel Security](https://vercel.com/security)

## 🤝 Reporting Security Issues

If you discover a security vulnerability:
1. Do NOT create a public GitHub issue
2. Email security concerns to your admin email
3. Include steps to reproduce if possible
4. Allow time for patching before disclosure

---

Remember: Security is an ongoing process, not a one-time setup. Stay vigilant! 🔒