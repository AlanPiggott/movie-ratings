# Amazon Affiliate Links Setup & Troubleshooting

## Overview
This document explains how Amazon affiliate links are implemented in the TrueReviews.tv website and how to troubleshoot OneLink issues.

## Configuration

### Environment Variable
Add your Amazon affiliate tag to `.env.local`:
```
AMAZON_AFFILIATE_TAG=truereview08c-20
```

## How It Works

1. **Link Generation**: When a user views a movie/TV show with Amazon streaming options, the system generates affiliate links automatically.

2. **OneLink Support**: By default, all Amazon links use the `.com` domain to support OneLink, which should automatically redirect international visitors to their local Amazon store.

3. **Supported Amazon Services**:
   - Amazon Prime Video
   - Amazon Video (Purchase/Rent)
   - Amazon Prime Video with Ads
   - Freevee
   - Amazon Channels (Paramount+, Max, Apple TV+)

## Troubleshooting OneLink Not Working

If UK visitors are not being redirected to Amazon.co.uk automatically, here are the steps to diagnose and fix:

### 1. Verify OneLink is Enabled
- Log into your Amazon Associates account
- Go to "Tools" → "OneLink"
- Ensure OneLink is activated for all supported countries
- Check that your store ID is linked to all regional programs

### 2. Test with Direct Links
Try these test URLs to verify OneLink is working:
```
https://www.amazon.com/s?k=Interstellar&i=instant-video&tag=truereview08c-20
```

When accessed from the UK, this should redirect to:
```
https://www.amazon.co.uk/s?k=Interstellar&i=instant-video&tag=truereview08c-20
```

### 3. Force Regional Domains (Fallback Option)
If OneLink is not working properly, you can disable it and use regional domains directly:

1. Add to `.env.local`:
```
AMAZON_USE_ONELINK=false
```

2. The system will then use regional domains:
   - Provider ID 119 (Amazon UK) → amazon.co.uk
   - Other providers → amazon.com

### 4. Check TMDB Provider Data
The issue might be that TMDB is not returning the correct regional provider. To debug:

1. Check which provider IDs are being returned for UK users
2. Verify that provider ID 119 (Amazon Prime Video UK) is included
3. If not, this is a TMDB data issue, not an affiliate link issue

### 5. Browser/VPN Issues
- Clear browser cache and cookies
- Try incognito/private browsing mode
- Ensure VPN is properly configured for UK IP
- Test with a real UK IP address if possible

## Important Notes

1. **Commission Rates**: Different regions have different commission rates. UK rates may differ from US rates.

2. **Payment Thresholds**: Each regional program has its own payment threshold. Ensure you meet the minimum in each region.

3. **Product Availability**: Not all content is available in all regions. OneLink will redirect to search results if the exact product isn't found.

4. **Tracking**: Monitor your Amazon Associates dashboard to verify clicks and conversions are being tracked properly across different regions.

## Testing Affiliate Links

To test if affiliate links are working:

1. Click on an Amazon streaming link
2. Check the URL contains your affiliate tag
3. Add a product to cart (don't need to purchase)
4. Check your Amazon Associates dashboard after 24 hours
5. You should see the click tracked even without a purchase

## Contact Support

If OneLink continues to not work properly:
1. Contact Amazon Associates support
2. Provide them with example URLs and your store ID
3. Ask specifically about OneLink configuration for your account