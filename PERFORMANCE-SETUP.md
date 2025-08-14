# 🚀 Performance Monitoring Setup Guide

This guide will set up real-time performance monitoring for your CV-Connect system, ensuring your System Performance reports show **100% real data** from your database.

## 📋 What This Setup Creates

- ✅ **PostgreSQL Extensions**: `pg_stat_statements` for query monitoring
- ✅ **Performance Tables**: Store real-time metrics and alerts
- ✅ **Monitoring Views**: Easy access to current system health
- ✅ **Automated Functions**: Real-time issue detection and alerts
- ✅ **Real Data Integration**: No more fake/hardcoded values

## 🎯 What You'll See After Setup

- **Real Database Connections**: Live connection counts from `pg_stat_activity`
- **Real Query Performance**: Actual query times from `pg_stat_statements`
- **Real User Activity**: Live counts from your `User` table
- **Real System Resources**: CPU, memory, disk usage (when implemented)
- **Real-Time Alerts**: Issues detected based on actual metrics

## 🚀 Quick Setup (3 Steps)

### **Step 1: Run the Migration**
```bash
cd backend
node run-migration.js
```

### **Step 2: Restart Backend Server**
```bash
npm start
```

### **Step 3: Test the Reports**
1. Open Admin Dashboard
2. Click "Reports & Documentation"
3. Click "View Report" for System Performance
4. See real data from your database! 🎉

## 🔧 Manual Setup (If Migration Fails)

If you get permission errors for the `pg_stat_statements` extension:

### **Option 1: Install Extension Manually**
```bash
# Connect to PostgreSQL as superuser
psql -U postgres -d CV_Connect

# Then run:
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
\q
```

### **Option 2: Use pgAdmin**
1. Open pgAdmin
2. Connect to your database
3. Open Query Tool
4. Run: `CREATE EXTENSION IF NOT EXISTS pg_stat_statements;`

## 📊 Database Tables Created

| Table | Purpose | Data Stored |
|-------|---------|-------------|
| `system_performance_metrics` | Core metrics | CPU, memory, disk, query performance |
| `performance_alerts` | System alerts | Active issues and their resolutions |
| `system_health_snapshots` | Historical data | Performance trends over time |

## 🔍 What Happens During Migration

1. **Extension Setup**: Attempts to create `pg_stat_statements`
2. **Table Creation**: Creates all monitoring tables
3. **Index Creation**: Optimizes query performance
4. **View Creation**: Simplifies data access
5. **Function Creation**: Enables automated monitoring
6. **Initial Data**: Sets up baseline metrics

## 🚨 Troubleshooting

### **Error: "relation pg_stat_statements does not exist"**
- The extension wasn't created due to insufficient privileges
- Run the manual extension creation steps above

### **Error: "permission denied"**
- Your database user doesn't have CREATE privileges
- Contact your database administrator or use superuser account

### **Tables Already Exist**
- Migration will skip existing tables
- No data will be lost

## ✅ Verification

After successful migration, you should see:
```
🎉 Performance Monitoring Setup Complete!

📋 What was created:
   ✅ pg_stat_statements extension (if privileges allow)
   ✅ system_performance_metrics table
   ✅ performance_alerts table
   ✅ system_health_snapshots table
   ✅ Performance indexes
   ✅ Monitoring views
   ✅ Automated monitoring functions

🚀 Your System Performance reports will now work with real data!
```

## 🔄 Updating Metrics

The system automatically updates metrics when you:
- Generate System Performance reports
- Access the Performance Monitor tab
- Run any performance-related API calls

## 📈 Next Steps

After setup, consider implementing:
1. **Real System Monitoring**: CPU, memory, disk usage from your server
2. **Automated Alerts**: Email/SMS notifications for critical issues
3. **Performance Dashboards**: Real-time monitoring displays
4. **Historical Analysis**: Trend analysis and capacity planning

---

**🎯 Result**: Your System Performance reports will show **real, live data** instead of fake numbers!
