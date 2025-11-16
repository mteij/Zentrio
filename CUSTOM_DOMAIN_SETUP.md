# Setting Up Custom Domain docs.zentrio.eu

I've configured your documentation site to use the custom domain `docs.zentrio.eu`. Here's what you need to do to complete the setup:

## 🌐 DNS Configuration

You need to add DNS records for your domain. Go to your domain registrar (where you bought zentrio.eu) and add the following DNS records:

### Option A: Using a CNAME record (Recommended)
```
Type: CNAME
Name: docs
Value: michieleijpe.github.io
TTL: 3600 (or default)
```

### Option B: Using A records (if CNAME doesn't work)
```
Type: A
Name: docs
Value: 185.199.108.153
TTL: 3600

Type: A  
Name: docs
Value: 185.199.109.153
TTL: 3600

Type: A
Name: docs
Value: 185.199.110.153
TTL: 3600

Type: A
Name: docs
Value: 185.199.111.153
TTL: 3600
```

## 📋 What I've Already Done

✅ Created [`docs/CNAME`](docs/CNAME) file with your domain  
✅ Updated [`docs/_config.yml`](docs/_config.yml) with custom domain URL  
✅ Set baseurl to empty for custom domain  

## 🚀 Steps to Complete

1. **Add DNS records** at your domain registrar (see above)
2. **Wait for DNS propagation** (can take 5 minutes to 48 hours)
3. **Push changes to GitHub**:
   ```bash
   git add docs/
   git commit -m "Configure custom domain docs.zentrio.eu"
   git push origin main
   ```
4. **Verify in GitHub**:
   - Go to Settings → Pages
   - You should see "Your site is published at https://docs.zentrio.eu"
   - Check for any DNS warnings

## 🔍 Verification

Once DNS propagates, you can:
1. Visit `https://docs.zentrio.eu` - should show your documentation
2. Check SSL certificate - GitHub Pages provides free HTTPS
3. Test all navigation links work correctly

## 🛠️ Troubleshooting

### DNS not propagating
- Use `dig docs.zentrio.eu` or `nslookup docs.zentrio.eu` to check
- Try clearing your browser cache
- Wait longer (DNS can take up to 48 hours)

### GitHub Pages shows DNS error
- Double-check DNS records match exactly
- Ensure CNAME file has no extra spaces or newlines
- Try the A records option if CNAME fails

### HTTPS not working
- HTTPS is automatically enabled after DNS verification
- May take up to 24 hours after DNS propagates

## 📱 Benefits of Custom Domain

- **Professional appearance** - Branded documentation URL
- **Consistent branding** - Matches your main site zentrio.eu
- **Free SSL certificate** - Provided by GitHub Pages
- **Easy to remember** - docs.zentrio.eu vs github.io URL

That's it! Once DNS propagates, your documentation will be available at `https://docs.zentrio.eu` 🎉