# SSL Certificates Directory

Place your SSL/TLS certificates in this directory for HTTPS support.

## Required Files

- `fullchain.pem` - Full certificate chain (certificate + intermediate certificates)
- `privkey.pem` - Private key file

## Obtaining Certificates

### Option 1: Let's Encrypt (Recommended)

Using certbot:

```bash
# Install certbot
sudo apt-get install certbot  # Ubuntu/Debian
# or
sudo yum install certbot       # CentOS/RHEL

# Get certificate (standalone mode - requires port 80 to be free)
sudo certbot certonly --standalone -d your-domain.com

# Certificates will be in: /etc/letsencrypt/live/your-domain.com/
# Copy them to this directory:
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem ./
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem ./
```

### Option 2: Self-Signed Certificate (Testing Only)

For development/testing purposes only:

```bash
# Generate self-signed certificate (valid for 365 days)
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout privkey.pem \
  -out fullchain.pem \
  -subj "/C=US/ST=State/L=City/O=Organization/CN=your-domain.com"
```

**Warning:** Self-signed certificates will show security warnings in browsers. Only use for testing!

### Option 3: Commercial CA

If you purchased a certificate from a commercial Certificate Authority:

1. Download your certificate files from your CA
2. Rename them to match:
   - Certificate + intermediate chain → `fullchain.pem`
   - Private key → `privkey.pem`
3. Copy them to this directory

## File Permissions

Ensure proper permissions for security:

```bash
chmod 644 fullchain.pem
chmod 600 privkey.pem
```

## Automatic Renewal (Let's Encrypt)

If using Let's Encrypt, set up automatic renewal:

```bash
# Test renewal
sudo certbot renew --dry-run

# Add to crontab for automatic renewal
sudo crontab -e

# Add this line to renew certificates twice daily:
0 0,12 * * * certbot renew --quiet --post-hook "cp /etc/letsencrypt/live/your-domain.com/*.pem /path/to/faas/nginx/ssl/ && docker compose -f /path/to/faas/docker-compose.nginx.yml restart fnbox-nginx"
```

## Verification

After placing certificates, verify they're valid:

```bash
# Check certificate details
openssl x509 -in fullchain.pem -text -noout

# Check if certificate matches private key
openssl x509 -noout -modulus -in fullchain.pem | openssl md5
openssl rsa -noout -modulus -in privkey.pem | openssl md5
# The MD5 hashes should match
```

## Troubleshooting

### Certificate Errors

If you see certificate errors after placing files:

1. Check file names match exactly: `fullchain.pem` and `privkey.pem`
2. Verify file permissions
3. Restart nginx: `docker compose -f docker-compose.nginx.yml restart fnbox-nginx`
4. Check nginx logs: `docker logs fnbox-nginx`

### Mixed Content Errors

If you see mixed content errors after enabling HTTPS:

1. Update `backend/.env`:
   ```bash
   CUSTOM_DOMAIN=https://your-domain.com
   ```

2. Update `frontend/.env.local`:
   ```bash
   NEXT_PUBLIC_API_BASE_URL=https://your-domain.com/api/
   NEXT_PUBLIC_BASE_URL_ACCOUNTS=https://your-domain.com/
   ```

3. Rebuild and restart containers

## Security Notes

- **Never commit these files to version control** (already in .gitignore)
- Keep `privkey.pem` secure - it should only be readable by nginx
- Regularly update certificates before expiration
- Use strong encryption (TLS 1.2+ only)
- Consider using HSTS headers (already in nginx config)
