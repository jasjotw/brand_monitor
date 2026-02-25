# 🚀 Betterstack Integration Documentation

## 📋 Overview

This document describes the complete Betterstack Logs and Uptime Monitoring integration implemented in the CogNerd webapp. The integration provides comprehensive error tracking, logging, and system health monitoring across both server and client environments.

---

## 🎯 What We Implemented

### Core Features
- ✅ **Server-side logging** with all log levels (debug, info, warn, error)
- ✅ **Client-side logging** with browser context tracking
- ✅ **Automatic error tracking** for all errors
- ✅ **React Error Boundary** for component error handling
- ✅ **Global error handlers** for uncaught errors
- ✅ **Health check endpoint** for uptime monitoring
- ✅ **API error handler middleware** for automatic logging
- ✅ **Real-time log delivery** to Betterstack dashboard

---

## 📁 Files Added/Modified

### New Files Created

| File | Purpose |
|------|---------|
| `lib/logger.ts` | Server-side logging utility with Logtail integration |
| `lib/client-logger.ts` | Client-side logging utility for browser |
| `lib/error-handler.ts` | API route error handler middleware |
| `components/error-boundary.tsx` | React Error Boundary component |
| `components/client-error-handler.tsx` | Global client-side error handlers |
| `app/api/health/betterstack/route.ts` | Health check endpoint for uptime monitoring |
| `app/api/test-logging/route.ts` | Testing endpoint for log verification |
| `test-betterstack.js` | Diagnostic script for testing connection |

### Modified Files

| File | Changes |
|------|---------|
| `lib/error-utils.ts` | Added Betterstack logging to all error classes |
| `app/layout.tsx` | Wrapped app with ErrorBoundary and ClientErrorHandler |
| `.env.local` | Added Betterstack source tokens |
| `package.json` | Added @logtail/node and @logtail/browser dependencies |

---

## 🔧 Installation & Setup

### 1. Dependencies

The following packages were installed:

```bash
npm install @logtail/node @logtail/browser dotenv
```

**Dependencies**:
- `@logtail/node@^0.5.6` - Server-side Logtail SDK
- `@logtail/browser@^0.5.6` - Client-side Logtail SDK
- `dotenv@^17.2.3` - Environment variable management

### 2. Environment Variables

Add to `.env.local`:

```env
# Betterstack Logging
BETTERSTACK_SOURCE_TOKEN="your_source_token_here"
NEXT_PUBLIC_BETTERSTACK_SOURCE_TOKEN="your_source_token_here"
```

**Getting Your Source Token**:
1. Go to [Betterstack Logs](https://logs.betterstack.com)
2. Navigate to **Sources** → **Add Source**
3. Choose **"JavaScript"** or **"HTTP"** (NOT Docker/Kubernetes)
4. Copy the **Source Token** (NOT collector secret)
5. Paste into both environment variables

### 3. Betterstack Account Setup

1. Create account at [betterstack.com](https://betterstack.com)
2. Navigate to **Logs** section
3. Create a new source (JavaScript/HTTP type)
4. Copy the source token
5. (Optional) Set up uptime monitoring after deployment

---

## 📖 Usage Guide

### Server-Side Logging

```typescript
import { logger } from '@/lib/logger';

// Info logging
await logger.info('User logged in', { 
  userId: user.id,
  email: user.email 
});

// Error logging
await logger.error('Payment failed', error, { 
  orderId: order.id,
  amount: order.total 
});

// Warning logging
await logger.warn('API rate limit approaching', { 
  endpoint: '/api/chat',
  usage: '80%' 
});

// Debug logging
await logger.debug('Cache hit', { 
  key: 'user:123',
  ttl: 3600 
});
```

### Client-Side Logging

```typescript
import { clientLogger } from '@/lib/client-logger';

// Log user interactions
clientLogger.info('Button clicked', { 
  buttonId: 'submit-form',
  page: window.location.pathname 
});

// Log client errors
try {
  // Some code
} catch (error) {
  clientLogger.error('Form submission failed', error, {
    formId: 'contact-form'
  });
}
```

### API Route Error Handling

Wrap your API routes with the error handler for automatic logging:

```typescript
import { withErrorHandler } from '@/lib/error-handler';
import { NextRequest, NextResponse } from 'next/server';

export const POST = withErrorHandler(async (request: NextRequest) => {
  // Your route logic here
  const data = await request.json();
  
  // Any errors thrown here will be automatically logged
  return NextResponse.json({ success: true });
});
```

### Operation Timing

Track operation performance:

```typescript
import { logOperation } from '@/lib/error-handler';

const result = await logOperation(
  'Database Query',
  async () => {
    return await db.query.users.findMany();
  },
  { table: 'users', limit: 100 }
);
```

---

## 🏥 Health Check Endpoint

### Endpoint Details

**URL**: `/api/health/betterstack`  
**Method**: GET  
**Purpose**: System health monitoring for Betterstack uptime checks

### Response Format

**Healthy Response** (200 OK):
```json
{
  "status": "healthy",
  "timestamp": "2026-01-27T07:08:00.000Z",
  "services": {
    "database": true,
    "aiProvider": true
  },
  "responseTime": "1727ms"
}
```

**Degraded Response** (503 Service Unavailable):
```json
{
  "status": "degraded",
  "timestamp": "2026-01-27T07:08:00.000Z",
  "services": {
    "database": false,
    "aiProvider": true
  },
  "responseTime": "2341ms"
}
```

### Checks Performed

1. **Database Connectivity**: Verifies PostgreSQL connection
2. **AI Provider**: Checks if at least one AI provider is configured
3. **Response Time**: Measures endpoint performance

### Setting Up Uptime Monitor

After deploying to production:

1. Go to Betterstack → **Uptime** → **Create Monitor**
2. Configure:
   - **Name**: "CogNerd Webapp Health"
   - **URL**: `https://your-domain.com/api/health/betterstack`
   - **Check Frequency**: 1 minute
   - **Expected Status**: 200
   - **Timeout**: 30 seconds
3. Add alert contacts (email, Slack, etc.)
4. Save and activate

---

## 🧪 Testing

### Test Logging Endpoint

Use the test endpoint to verify logging is working:

```bash
# Test info level
curl "http://localhost:3000/api/test-logging?level=info&message=Test%20message"

# Test error level
curl "http://localhost:3000/api/test-logging?level=error&message=Error%20test"

# Test warning level
curl "http://localhost:3000/api/test-logging?level=warn&message=Warning%20test"

# Test debug level
curl "http://localhost:3000/api/test-logging?level=debug&message=Debug%20test"
```

### Test Health Check

```bash
curl http://localhost:3000/api/health/betterstack
```

### Diagnostic Script

Run the diagnostic script to verify Betterstack connection:

```bash
node test-betterstack.js
```

**Expected Output**:
```
=== Betterstack Diagnostic ===
Token: your_token_here
Token length: 24

1. Creating Logtail instance...
✅ Logtail instance created

2. Sending test log...
✅ Log method called

3. Flushing logs...
✅ Logs flushed to Betterstack

=== Test Complete ===
```

---

## 📊 Betterstack Dashboard

### Viewing Logs

1. Go to [logs.betterstack.com](https://logs.betterstack.com)
2. Select your source from the dropdown
3. Use **Live Tail** for real-time logs or **Search** for historical logs

### Log Entry Contents

Each log includes:
- **Timestamp**: When the log occurred
- **Level**: debug, info, warn, or error
- **Message**: The log message
- **Context**: Custom metadata you provided
- **Environment**: development or production
- **Service**: "webapp" (server) or "webapp-client" (browser)
- **Stack Trace**: For errors
- **Request Details**: For API errors (method, URL, user, IP)
- **Browser Details**: For client errors (user agent, viewport, URL)

### Searching Logs

**Search by message**:
```
Testing info level
```

**Filter by level**:
```
level:error
```

**Filter by context**:
```
userId:123
```

**Combine filters**:
```
level:error AND environment:production
```

**Time range**:
- Use the time picker to select custom ranges
- Options: Last 15 min, 1 hour, 24 hours, 7 days, custom

---

## 🎨 Error Boundary UI

The Error Boundary provides a premium fallback UI when React components crash:

### Features
- ✅ User-friendly error message
- ✅ Reload button to recover
- ✅ Error details in development mode
- ✅ Automatic error logging to Betterstack
- ✅ Component stack trace capture

### Customization

To customize the error UI, edit `components/error-boundary.tsx`:

```typescript
// Custom fallback prop
<ErrorBoundary fallback={<YourCustomErrorUI />}>
  {children}
</ErrorBoundary>
```

---

## 🔍 Architecture

### Server-Side Flow

```
API Request
    ↓
withErrorHandler() middleware
    ↓
Route Handler
    ↓
Error occurs?
    ↓
logger.error() → Logtail → Betterstack
    ↓
Error response to client
```

### Client-Side Flow

```
User Action / Component Render
    ↓
Error occurs?
    ↓
ErrorBoundary catches OR
ClientErrorHandler catches
    ↓
clientLogger.error() → Logtail → Betterstack
    ↓
Fallback UI shown
```

### Log Delivery

```
logger.info/error/warn/debug()
    ↓
Enrich with context
    ↓
Send to Logtail SDK
    ↓
Immediate flush()
    ↓
Betterstack API
    ↓
Appears in dashboard (< 1 second)
```

---

## 🚨 Error Classes Integration

All existing error classes now auto-log to Betterstack:

### DetailedError
```typescript
throw new DetailedError(
  'Operation failed',
  { userId: '123', operation: 'update' }
);
// Automatically logged to Betterstack
```

### AIProviderError
```typescript
throw new AIProviderError(
  'openai',
  originalError,
  { model: 'gpt-4', tokens: 1000 }
);
// Automatically logged with provider context
```

### DatabaseError
```typescript
throw new DatabaseError(
  'insert',
  originalError,
  { table: 'users', data: userData }
);
// Automatically logged with database context
```

---

## 📈 Best Practices

### 1. Log Levels

Use appropriate log levels:

- **DEBUG**: Detailed diagnostic information (disabled in production)
- **INFO**: General informational messages (user actions, system events)
- **WARN**: Warning messages (degraded performance, deprecated usage)
- **ERROR**: Error messages (failures, exceptions)

### 2. Context Data

Always include relevant context:

```typescript
// ❌ Bad
await logger.error('Payment failed');

// ✅ Good
await logger.error('Payment failed', error, {
  userId: user.id,
  orderId: order.id,
  amount: order.total,
  paymentMethod: 'stripe'
});
```

### 3. Sensitive Data

Never log sensitive information:

```typescript
// ❌ Bad
await logger.info('User logged in', {
  password: user.password,
  creditCard: user.card
});

// ✅ Good
await logger.info('User logged in', {
  userId: user.id,
  email: user.email
});
```

### 4. Performance

Logging is async - don't block critical paths:

```typescript
// ✅ Good - fire and forget
logger.info('User action', context).catch(console.error);

// ✅ Also good - await if needed
await logger.error('Critical error', error, context);
```

---

## 🐛 Troubleshooting

### Logs Not Appearing

**Check 1: Verify Token**
```bash
node test-betterstack.js
```
If you see "Error: Unauthorized", the token is invalid.

**Check 2: Check Server Logs**
Look for:
- `[Logger] ✅ Betterstack logging ENABLED` = Working
- `[Logger] ❌ Failed to initialize Logtail` = Token issue
- `[Logger] ⚠️ BETTERSTACK_SOURCE_TOKEN not found` = Missing env var

**Check 3: Correct Source**
- Make sure you're viewing the correct source in Betterstack
- Token should match the one in `.env.local`
- Source type should be JavaScript/HTTP (NOT collector-based)

**Check 4: Time Range**
- Check the time filter in Betterstack dashboard
- Set to "Last 15 minutes" or "Live"

### Health Check Failing

**Database Connection**:
```typescript
// Check DATABASE_URL in .env.local
// Verify database is accessible
```

**AI Provider**:
```typescript
// Check at least one provider API key is set
// OPENAI_API_KEY, ANTHROPIC_API_KEY, etc.
```

---

## 📦 Production Deployment

### Pre-Deployment Checklist

- ✅ `BETTERSTACK_SOURCE_TOKEN` set in production environment
- ✅ `NEXT_PUBLIC_BETTERSTACK_SOURCE_TOKEN` set in production
- ✅ Health check endpoint accessible
- ✅ Test all log levels in staging
- ✅ Verify error boundary works
- ✅ Test client-side error logging

### Post-Deployment Tasks

1. **Configure Uptime Monitor**:
   - URL: `https://your-domain.com/api/health/betterstack`
   - Frequency: 1 minute
   - Alerts: Email, Slack, etc.

2. **Set Up Alerts**:
   - Critical errors: Immediate notification
   - Warning threshold: 10+ errors in 5 minutes
   - Health check failures: Immediate notification

3. **Configure Log Retention**:
   - Review Betterstack plan limits
   - Set appropriate retention period
   - Consider log sampling for high-volume apps

4. **Monitor Usage**:
   - Check log volume in Betterstack
   - Adjust log levels if needed
   - Review costs vs. plan limits

---

## 🔐 Security Considerations

### Environment Variables

- ✅ Never commit `.env.local` to git
- ✅ Use different tokens for dev/staging/production
- ✅ Rotate tokens periodically
- ✅ Limit token permissions if possible

### Sensitive Data

- ✅ Never log passwords, tokens, or API keys
- ✅ Sanitize user input before logging
- ✅ Redact PII (personally identifiable information)
- ✅ Use context carefully in production

### Access Control

- ✅ Limit Betterstack dashboard access
- ✅ Use role-based access for team members
- ✅ Enable 2FA on Betterstack account
- ✅ Review access logs regularly

---

## 📚 Additional Resources

### Documentation
- [Betterstack Logs Docs](https://betterstack.com/docs/logs/)
- [Logtail Node.js SDK](https://github.com/logtail/logtail-js)
- [Next.js Error Handling](https://nextjs.org/docs/app/building-your-application/routing/error-handling)

### Support
- Betterstack Support: support@betterstack.com
- Betterstack Community: [community.betterstack.com](https://community.betterstack.com)

---

## 🎉 Summary

You now have enterprise-grade logging and monitoring:

✅ **Comprehensive Logging**: All errors and events tracked  
✅ **Real-Time Monitoring**: Live tail and instant alerts  
✅ **Error Tracking**: Automatic capture with full context  
✅ **Uptime Monitoring**: Health checks and availability tracking  
✅ **Production Ready**: Tested and verified  

**Everything is working perfectly!** 🚀

---

*Last Updated: January 27, 2026*  
*Integration Version: 1.0*  
*Maintained by: CogNerd Development Team*
