# Admin Scripts

Scripts for managing users and administrative tasks.

## Creating Users

Since public signup is disabled, users must be created manually by administrators.

### Prerequisites

Set the `ADMIN_SECRET` environment variable in your `.env` file:

```bash
# Generate a secure secret
ADMIN_SECRET=$(openssl rand -base64 32)
```

### Method 1: Interactive Script (Recommended)

Run the interactive script to create users:

```bash
bun run scripts/create-user.ts
```

You'll be prompted for:
- Email address
- Full name
- Password (minimum 8 characters)

### Method 2: Environment Variables

Create a user non-interactively using environment variables:

```bash
USER_EMAIL=admin@example.com \
USER_PASSWORD=secure-password \
USER_NAME="Admin User" \
bun run scripts/create-user.ts
```

### Method 3: Batch Create Users (Multiple Users at Once)

Create multiple users with auto-generated passwords in one operation:

```bash
bun run batch-create-users
```

You'll be prompted for:
- **Base username** (e.g., "user") - will create user1, user2, user3, etc.
- **Starting number** (e.g., 1) - first user will be user1
- **Number of users** (e.g., 10) - how many users to create
- **Email domain** (e.g., "example.com") - for user1@example.com

**Example output:**
```
Creating user1... ✅
Creating user2... ✅
Creating user3... ✅

================================================================================
📊 BATCH USER CREATION RESULTS
================================================================================
Total: 3 | Success: 3 | Failed: 0
================================================================================

✅ Successfully Created Users:

No.   Email                         Name                Password
--------------------------------------------------------------------------------
1     user1@example.com            User 1              aB9#kL2$mP5!qR8@
2     user2@example.com            User 2              xY4%zW7&nM3^tV6*
3     user3@example.com            User 3              fG1!hJ8@kD5#pQ2$

================================================================================
⚠️  IMPORTANT: Save these credentials securely!
================================================================================
```

**Non-interactive batch creation:**

```bash
BASE_NAME=user \
START_NUMBER=1 \
USER_COUNT=10 \
EMAIL_DOMAIN=example.com \
bun run batch-create-users
```

### Method 4: Direct API Call

You can also create users via the admin API endpoint:

```bash
curl -X POST http://localhost:3000/api/admin/create-user \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: YOUR_ADMIN_SECRET" \
  -d '{
    "email": "user@example.com",
    "password": "secure-password",
    "name": "User Name"
  }'
```

For production:

```bash
curl -X POST https://your-domain.com/api/admin/create-user \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: YOUR_ADMIN_SECRET" \
  -d '{
    "email": "user@example.com",
    "password": "secure-password",
    "name": "User Name"
  }'
```

## Security

### How Public Signup is Blocked

1. **Better Auth Hook**: A `signUp` hook in the auth configuration checks for the `x-admin-secret` header
2. **Admin API Endpoint**: The `/api/admin/create-user` endpoint requires the admin secret
3. **UI Disabled**: The signup form shows "Registration Disabled" message

### Important Security Notes

- **Keep `ADMIN_SECRET` confidential** - Store it securely in environment variables
- **Never commit** `.env` files with real secrets to version control
- **Rotate secrets** periodically for better security
- **Use strong passwords** when creating user accounts
- **Limit access** to the admin API endpoint (consider IP whitelisting on production)

### Environment Variables

Required in `.env`:

```bash
# [required] Admin secret for user creation
ADMIN_SECRET=your-secure-secret-here

# [required] Auth secret for sessions
AUTH_SECRET=your-auth-secret-here

# [required] Database connection
DATABASE_URL=your-postgres-url
```

## Troubleshooting

### "Unauthorized. Invalid admin secret"

- Ensure `ADMIN_SECRET` is set in your `.env` file
- Verify the secret matches between `.env` and your API request
- Check that `.env` file is in the project root

### "Password must be at least 8 characters"

- Use a password with 8 or more characters
- Consider using a password generator for stronger passwords

### "User already exists"

- The email address is already registered
- Use a different email or delete the existing user from the database

### Server not running

If using the script with the default API URL (localhost:3000):

```bash
# Start the development server first
bun run dev

# Then in another terminal, run the script
bun run scripts/create-user.ts
```

Or specify a different API URL:

```bash
API_URL=https://your-production-url.com bun run scripts/create-user.ts
```
