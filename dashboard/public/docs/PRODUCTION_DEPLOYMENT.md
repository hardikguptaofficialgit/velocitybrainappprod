# Production Deployment Guide

This guide covers deploying Velocity Brain to production environments with security, monitoring, and operational best practices.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Configuration](#environment-configuration)
3. [Database Setup](#database-setup)
4. [Application Deployment](#application-deployment)
5. [Security Configuration](#security-configuration)
6. [Monitoring and Observability](#monitoring-and-observability)
7. [Backup and Recovery](#backup-and-recovery)
8. [Performance Optimization](#performance-optimization)
9. [Troubleshooting](#troubleshooting)

## Prerequisites

### System Requirements

- **Operating System**: Ubuntu 20.04+ / CentOS 8+ / RHEL 8+
- **CPU**: Minimum 4 cores, recommended 8+ cores
- **Memory**: Minimum 8GB RAM, recommended 16GB+ RAM
- **Storage**: Minimum 100GB SSD, recommended 500GB+ SSD
- **Network**: Stable internet connection with SSL/TLS support

### Software Dependencies

- Docker 20.10+ and Docker Compose 2.0+
- PostgreSQL 15+ (if not using Docker)
- Redis 7+ (if not using Docker)
- Python 3.11+ (if not using Docker)
- Nginx 1.20+ (for reverse proxy)

### Security Requirements

- SSL/TLS certificates for HTTPS
- Firewall configuration (ports 80, 443, 22)
- Regular security updates
- Backup storage solution

## Environment Configuration

### 1. Create Production Environment File

```bash
# Copy the production environment template
cp .env.prod.example .env.prod
```

### 2. Configure Required Settings

Edit `.env.prod` with your production values:

```bash
# Database Configuration (REQUIRED)
DB_USER=velocity
DB_PASSWORD=your_secure_password_here
DB_NAME=velocitybrain
DB_HOST=db
DB_PORT=5432

# Security Configuration (REQUIRED)
SECRET_KEY=your_very_long_random_secret_key_at_least_32_characters
JWT_ALGORITHM=HS256
ACCESS_TOKEN_TTL_MINUTES=60

# Redis Configuration (REQUIRED)
REDIS_PASSWORD=your_redis_password_here

# Application Settings
ENV=production
PORT=8080
LOG_LEVEL=INFO
```

### 3. Generate Secure Secrets

```bash
# Generate secure secret key
python -c "import secrets; print(secrets.token_urlsafe(32))"

# Generate database password
openssl rand -base64 32

# Generate Redis password
openssl rand -base64 32
```

## Database Setup

### Option 1: Docker Compose (Recommended)

```bash
# Start database with production configuration
docker-compose -f docker-compose.prod.yml up -d db redis

# Wait for database to be ready
docker-compose -f docker-compose.prod.yml exec db pg_isready -U velocity

# Initialize schema
docker-compose -f docker-compose.prod.yml exec db psql -U velocity -d velocitybrain -f /docker-entrypoint-initdb.d/01-schema.sql

# Apply constraints
docker-compose -f docker-compose.prod.yml exec db psql -U velocity -d velocitybrain -f /docker-entrypoint-initdb.d/02-constraints.sql
```

### Option 2: External PostgreSQL

If using an external PostgreSQL instance:

```sql
-- Create database and user
CREATE DATABASE velocitybrain;
CREATE USER velocity WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE velocitybrain TO velocity;

-- Enable extensions
\c velocitybrain
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

### Database Security

```sql
-- Configure security settings
ALTER SYSTEM SET ssl = on;
ALTER SYSTEM SET ssl_cert_file = '/path/to/cert.pem';
ALTER SYSTEM SET ssl_key_file = '/path/to/key.pem';
ALTER SYSTEM SET log_connections = on;
ALTER SYSTEM SET log_disconnections = on;
ALTER SYSTEM SET log_statement = 'mod';
SELECT pg_reload_conf();
```

## Application Deployment

### 1. Build and Deploy with Docker

```bash
# Build production image
docker build -f Dockerfile.prod -t velocitybrain:prod .

# Deploy with Docker Compose
docker-compose -f docker-compose.prod.yml up -d

# Check deployment status
docker-compose -f docker-compose.prod.yml ps
```

### 2. Configure Nginx Reverse Proxy

Create `/etc/nginx/sites-available/velocitybrain`:

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains";

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req zone=api burst=20 nodelay;

    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Health check endpoint (no rate limiting)
    location /v1/healthz {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
    }
}
```

### 3. Enable Site

```bash
sudo ln -s /etc/nginx/sites-available/velocitybrain /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Security Configuration

### 1. SSL/TLS Setup

```bash
# Generate self-signed certificate (for testing)
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/key.pem \
    -out /etc/nginx/ssl/cert.pem

# Or use Let's Encrypt (recommended for production)
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### 2. Firewall Configuration

```bash
# Configure UFW firewall
sudo ufw enable
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw deny 5432/tcp  # Database from external
sudo ufw deny 6379/tcp  # Redis from external
```

### 3. Application Security

```bash
# Set appropriate file permissions
sudo chown -R velocitybrain:velocitybrain /opt/velocitybrain
sudo chmod 750 /opt/velocitybrain
sudo chmod 640 /opt/velocitybrain/.env.prod

# Configure log rotation
sudo tee /etc/logrotate.d/velocitybrain << EOF
/opt/velocitybrain/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 velocitybrain velocitybrain
    postrotate
        docker-compose -f /opt/velocitybrain/docker-compose.prod.yml restart api
    endscript
}
EOF
```

## Monitoring and Observability

### 1. Health Checks

Monitor these endpoints:

- `/v1/healthz` - Basic health check
- `/v1/health/detailed` - Comprehensive health with metrics
- `/v1/runtime/status` - Runtime status and audit logs

### 2. Prometheus Metrics

Access Prometheus at `https://velocitybrain.vercel.app`

Key metrics to monitor:

- `velocitybrain_requests_total` - Total HTTP requests
- `velocitybrain_request_duration_seconds` - Request latency
- `velocitybrain_errors_total` - Error count
- `velocitybrain_database_connections_active` - Active DB connections
- `velocitybrain_memory_usage_bytes` - Memory usage

### 3. Grafana Dashboards

Access Grafana at `https://velocitybrain.vercel.app`

Pre-configured dashboards:

- Application Overview
- Database Performance
- System Resources
- Security Events

### 4. Log Monitoring

```bash
# View application logs
docker-compose -f docker-compose.prod.yml logs -f api

# View database logs
docker-compose -f docker-compose.prod.yml logs -f db

# View specific time range
docker-compose -f docker-compose.prod.yml logs --since="2024-01-01T00:00:00" api
```

## Backup and Recovery

### 1. Database Backup

```bash
# Create backup script
cat > backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/backups/velocitybrain"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/velocitybrain_$DATE.sql"

mkdir -p $BACKUP_DIR

# Create database backup
docker-compose -f docker-compose.prod.yml exec -T db pg_dump -U velocity velocitybrain > $BACKUP_FILE

# Compress backup
gzip $BACKUP_FILE

# Remove backups older than 30 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete

echo "Backup completed: $BACKUP_FILE.gz"
EOF

chmod +x backup.sh

# Schedule daily backups at 2 AM
echo "0 2 * * * /opt/velocitybrain/backup.sh" | sudo crontab -
```

### 2. Application Data Backup

```bash
# Backup skills and data
tar -czf /opt/backups/velocitybrain_data_$(date +%Y%m%d_%H%M%S).tar.gz \
    /opt/velocitybrain/data \
    /opt/velocitybrain/skills \
    /opt/velocitybrain/logs
```

### 3. Recovery Procedure

```bash
# Stop application
docker-compose -f docker-compose.prod.yml down

# Restore database
gunzip -c /opt/backups/velocitybrain_YYYYMMDD_HHMMSS.sql.gz | \
    docker-compose -f docker-compose.prod.yml exec -T db psql -U velocity velocitybrain

# Restore application data
tar -xzf /opt/backups/velocitybrain_data_YYYYMMDD_HHMMSS.tar.gz -C /

# Start application
docker-compose -f docker-compose.prod.yml up -d
```

## Performance Optimization

### 1. Database Optimization

```sql
-- Analyze table statistics
ANALYZE;

-- Rebuild indexes
REINDEX DATABASE velocitybrain;

-- Configure PostgreSQL for production
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET default_statistics_target = 100;
SELECT pg_reload_conf();
```

### 2. Application Optimization

```bash
# Configure worker processes
# In docker-compose.prod.yml:
environment:
  WORKERS: 4
  WORKER_CONNECTIONS: 1000
  KEEPALIVE_TIMEOUT: 65
```

### 3. Caching Strategy

- Redis for session storage
- Application-level caching for frequently accessed data
- CDN for static assets if applicable

## Troubleshooting

### Common Issues

#### 1. Database Connection Failed

```bash
# Check database status
docker-compose -f docker-compose.prod.yml exec db pg_isready -U velocity

# Check database logs
docker-compose -f docker-compose.prod.yml logs db

# Test connection from application container
docker-compose -f docker-compose.prod.yml exec api python -c "
from src.core.db import get_conn
with get_conn() as conn:
    print('Database connection successful')
"
```

#### 2. High Memory Usage

```bash
# Check memory usage
docker stats

# Monitor application memory
docker-compose -f docker-compose.prod.yml exec api ps aux

# Check for memory leaks
docker-compose -f docker-compose.prod.yml exec api python -c "
import psutil
import time
while True:
    print(f'Memory: {psutil.virtual_memory().percent}%')
    time.sleep(10)
"
```

#### 3. Slow Queries

```sql
-- Enable query logging
ALTER SYSTEM SET log_min_duration_statement = 1000;
SELECT pg_reload_conf();

-- Find slow queries
SELECT query, mean_exec_time, calls, total_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

### Health Check Commands

```bash
# Basic health check
curl -f http://localhost:8080/v1/healthz

# Detailed health check
curl -f http://localhost:8080/v1/health/detailed

# Check application logs for errors
docker-compose -f docker-compose.prod.yml logs api | grep ERROR

# Monitor system resources
htop
iotop
nethogs
```

### Emergency Procedures

#### 1. Application Crash

```bash
# Restart application
docker-compose -f docker-compose.prod.yml restart api

# Check logs for crash reason
docker-compose -f docker-compose.prod.yml logs api --tail=100

# If persistent crash, rollback to previous version
docker tag velocitybrain:prod velocitybrain:prod_backup
docker pull velocitybrain:previous_version
docker-compose -f docker-compose.prod.yml up -d
```

#### 2. Database Corruption

```bash
# Stop application
docker-compose -f docker-compose.prod.yml down

# Restore from most recent backup
# (See backup and recovery section)

# Verify database integrity
docker-compose -f docker-compose.prod.yml exec db psql -U velocity velocitybrain -c "
SELECT COUNT(*) FROM entities;
SELECT COUNT(*) FROM timeline_events;
"
```

#### 3. Security Incident

```bash
# Immediately block suspicious IPs
sudo iptables -A INPUT -s SUSPICIOUS_IP -j DROP

# Review audit logs
docker-compose -f docker-compose.prod.yml logs api | grep audit

# Rotate all secrets
# Update .env.prod with new passwords/keys
# Restart all services
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d
```

## Maintenance Tasks

### Daily

- Monitor health checks
- Review error logs
- Check backup completion

### Weekly

- Review performance metrics
- Update security patches
- Clean up old logs

### Monthly

- Database maintenance (VACUUM, ANALYZE)
- Review and rotate certificates
- Update application dependencies

### Quarterly

- Security audit
- Performance review
- Capacity planning

## Support

For production support:

1. Check this documentation first
2. Review logs and metrics
3. Consult the troubleshooting section
4. Create an issue with detailed information

Include in support requests:
- Environment details
- Error messages and logs
- Steps to reproduce
- Health check results
- System metrics
