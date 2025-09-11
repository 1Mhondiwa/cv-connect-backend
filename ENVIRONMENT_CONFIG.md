# Environment Configuration Guide

## Required Environment Variables

### Critical (Must be set)
- `JWT_SECRET` - Secret key for JWT token signing (NO FALLBACK)
- `CLIENT_URL` - Frontend URL for CORS (NO WILDCARD)
- `MOBILE_URL` - Mobile app URL for CORS (NO WILDCARD)

### Database
- `DB_HOST` - Database host
- `DB_PORT` - Database port
- `DB_NAME` - Database name
- `DB_USER` - Database user
- `DB_PASSWORD` - Database password

### Optional Database Pool Settings
- `DB_POOL_MAX` - Maximum connections (default: 20)
- `DB_POOL_MIN` - Minimum connections (default: 2)
- `DB_IDLE_TIMEOUT` - Idle timeout in ms (default: 30000)
- `DB_CONNECTION_TIMEOUT` - Connection timeout in ms (default: 2000)
- `DB_MAX_USES` - Max uses per connection (default: 7500)

### Server
- `NODE_ENV` - Environment (development/production)
- `PORT` - Server port (default: 5000)
- `LOG_LEVEL` - Logging level (debug/info/warn/error)

### File Upload
- `MAX_FILE_SIZE` - Max file size in bytes (default: 5MB)

## Example .env file

```env
# Critical
JWT_SECRET=your-super-secret-jwt-key-here
CLIENT_URL=http://localhost:3000
MOBILE_URL=http://localhost:3001

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=cv_connect
DB_USER=your_db_user
DB_PASSWORD=your_db_password

# Server
NODE_ENV=development
PORT=5000
LOG_LEVEL=debug

# Optional
MAX_FILE_SIZE=5242880
```

## Security Notes

1. **JWT_SECRET**: Must be a strong, random string. No fallback provided for security.
2. **CORS**: No wildcard origins allowed. Must specify exact URLs.
3. **Database**: Use strong passwords and consider SSL in production.
4. **Environment**: Never commit .env files to version control.
