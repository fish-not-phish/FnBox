# Nginx Deployment for FnBox

This directory contains nginx configuration files for deploying FnBox with nginx as a reverse proxy.

## Quick Start

### 1. Start with Nginx

```bash
docker compose -f docker-compose.nginx.yml up -d
```

### 2. Access the Platform

- **Frontend**: http://localhost
- **Backend API**: http://localhost/api/
- **Admin Panel**: http://localhost/admin/

## Configuration

### HTTP (Development)

The default configuration uses HTTP on port 80. This is suitable for:
- Local development
- Internal networks
- Testing environments

### HTTPS (Production)

For production with SSL/TLS:

1. **Obtain SSL certificates** (using Let's Encrypt, your CA, or self-signed):
   ```bash
   # Example with certbot (Let's Encrypt)
   sudo certbot certonly --standalone -d your-domain.com

   # Copy certificates to nginx/ssl/
   sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem nginx/ssl/
   sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem nginx/ssl/
   ```

2. **Edit `nginx/conf.d/fnbox.conf`**:
   - Uncomment the HTTPS server block (lines starting with #)
   - Update `server_name` to your domain
   - Update SSL certificate paths if needed

3. **Restart nginx**:
   ```bash
   docker compose -f docker-compose.nginx.yml restart fnbox-nginx
   ```

## Routing

Nginx routes requests based on URL paths:

| Path | Target | Description |
|------|--------|-------------|
| `/api/*` | Backend:8000 | API endpoints |
| `/accounts/*` | Backend:8000 | Authentication endpoints |
| `/admin/*` | Backend:8000 | Django admin |
| `/static/*` | Static files | CSS, JS, images |
| `/media/*` | Media files | User uploads |
| `/*` | Frontend:3000 | Next.js application |

## Customization

### Change Domain

Edit `nginx/conf.d/fnbox.conf`:

```nginx
server_name your-domain.com;  # Change this line
```

### Increase Upload Size

Edit `nginx/nginx.conf`:

```nginx
client_max_body_size 500M;  # Default is 100M
```

### Add Custom Headers

Edit `nginx/conf.d/fnbox.conf` and add to server block:

```nginx
add_header X-Custom-Header "value";
```

### Enable Rate Limiting

Add to `nginx/conf.d/fnbox.conf` before server block:

```nginx
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;

server {
    # ... existing config ...

    location /api/ {
        limit_req zone=api_limit burst=20 nodelay;
        # ... existing proxy settings ...
    }
}
```

## SSL/TLS Security

The production HTTPS configuration includes:

- TLS 1.2 and 1.3 only
- Strong cipher suites
- HTTP/2 support
- Session caching
- Secure headers

### Recommended Additional Security Headers

Add these to your HTTPS server block:

```nginx
# Security headers
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
```

## Monitoring

### View Nginx Logs

```bash
# Access logs
docker compose -f docker-compose.nginx.yml logs -f fnbox-nginx

# Inside container
docker exec fnbox-nginx tail -f /var/log/nginx/access.log
docker exec fnbox-nginx tail -f /var/log/nginx/error.log
```

### Test Configuration

```bash
# Test nginx config syntax
docker exec fnbox-nginx nginx -t

# Reload config without downtime
docker exec fnbox-nginx nginx -s reload
```

## Troubleshooting

### 502 Bad Gateway

Check if backend/frontend containers are running:

```bash
docker compose -f docker-compose.nginx.yml ps
docker compose -f docker-compose.nginx.yml logs fnbox-backend
docker compose -f docker-compose.nginx.yml logs fnbox-frontend
```

### Permission Denied on Static Files

Check volume permissions:

```bash
docker exec fnbox-nginx ls -la /var/www/static
docker exec fnbox-nginx ls -la /var/www/media
```

### SSL Certificate Issues

Verify certificate files exist:

```bash
docker exec fnbox-nginx ls -la /etc/nginx/ssl/
```

Test SSL configuration:

```bash
docker exec fnbox-nginx nginx -t
```

## Performance Tuning

### Worker Processes

Edit `nginx/nginx.conf`:

```nginx
worker_processes auto;  # Uses all CPU cores
worker_connections 2048;  # Increase if needed
```

### Buffer Sizes

Add to `nginx/conf.d/fnbox.conf` http block:

```nginx
proxy_buffering on;
proxy_buffer_size 4k;
proxy_buffers 8 4k;
proxy_busy_buffers_size 8k;
```

### Caching

Enable proxy caching for better performance:

```nginx
# Add to http block in nginx.conf
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=my_cache:10m max_size=1g inactive=60m;

# Add to location blocks in fnbox.conf
proxy_cache my_cache;
proxy_cache_valid 200 60m;
proxy_cache_use_stale error timeout updating http_500 http_502 http_503 http_504;
```

## Comparison: Nginx vs Traefik

| Feature | Nginx | Traefik |
|---------|-------|---------|
| Configuration | File-based | Label-based |
| Learning Curve | Moderate | Easy |
| Performance | Excellent | Very Good |
| Let's Encrypt | Manual setup | Automatic |
| Dynamic Config | Requires reload | Automatic |
| Docker Integration | Good | Excellent |
| Best For | Traditional deployments | Container-native |

Choose nginx if:
- You're already familiar with nginx
- You want full control over configuration
- You're deploying to VMs or bare metal
- You need maximum performance

Choose Traefik if:
- You prefer Docker-native configuration
- You want automatic Let's Encrypt
- You need dynamic service discovery
- You're new to reverse proxies
