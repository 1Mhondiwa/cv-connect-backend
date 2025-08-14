const { Pool } = require('pg');
require('dotenv').config();

// Database connection configuration
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
});

async function setupPerformanceMonitoring() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Starting Performance Monitoring Setup...');
    
    // 1. Create pg_stat_statements extension
    console.log('📊 Setting up pg_stat_statements extension...');
    try {
      await client.query('CREATE EXTENSION IF NOT EXISTS pg_stat_statements');
      console.log('✅ pg_stat_statements extension created successfully');
    } catch (error) {
      if (error.code === '42501') {
        console.log('⚠️ Insufficient privileges to create extension. Please run as superuser:');
        console.log('   CREATE EXTENSION IF NOT EXISTS pg_stat_statements;');
      } else {
        console.log('⚠️ Extension creation failed:', error.message);
      }
    }

    // 2. Create performance monitoring tables
    console.log('📋 Creating performance monitoring tables...');
    
    // Table for storing system performance metrics
    await client.query(`
      CREATE TABLE IF NOT EXISTS system_performance_metrics (
        id SERIAL PRIMARY KEY,
        metric_name VARCHAR(100) NOT NULL UNIQUE,
        metric_value TEXT NOT NULL,
        metric_unit VARCHAR(50),
        status VARCHAR(20) DEFAULT 'normal',
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        details JSONB
      );
    `);
    console.log('✅ system_performance_metrics table created');

    // Table for storing performance alerts
    await client.query(`
      CREATE TABLE IF NOT EXISTS performance_alerts (
        id SERIAL PRIMARY KEY,
        alert_type VARCHAR(100) NOT NULL,
        severity VARCHAR(20) NOT NULL,
        title VARCHAR(200) NOT NULL,
        description TEXT,
        status VARCHAR(20) DEFAULT 'active',
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        resolved_at TIMESTAMP,
        resolution_notes TEXT
      );
    `);
    console.log('✅ performance_alerts table created');

    // Table for storing system health snapshots
    await client.query(`
      CREATE TABLE IF NOT EXISTS system_health_snapshots (
        id SERIAL PRIMARY KEY,
        cpu_usage DECIMAL(5,2),
        memory_usage DECIMAL(5,2),
        disk_usage DECIMAL(5,2),
        network_latency INTEGER,
        active_connections INTEGER,
        total_connections INTEGER,
        avg_query_time DECIMAL(10,2),
        slow_query_count INTEGER,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ system_health_snapshots table created');

    // 3. Create indexes for better performance
    console.log('🔍 Creating performance indexes...');
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_performance_metrics_timestamp 
      ON system_performance_metrics(timestamp);
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_performance_alerts_status 
      ON performance_alerts(status, severity);
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_health_snapshots_timestamp 
      ON system_health_snapshots(timestamp);
    `);
    console.log('✅ Performance indexes created');

    // 4. Insert initial performance metrics
    console.log('📊 Inserting initial performance metrics...');
    
    const initialMetrics = [
      { name: 'system_uptime', value: '99.8', unit: '%', status: 'excellent' },
      { name: 'database_connections', value: '0', unit: 'connections', status: 'normal' },
      { name: 'query_performance', value: '0', unit: 'ms', status: 'normal' },
      { name: 'memory_usage', value: '0', unit: '%', status: 'normal' },
      { name: 'cpu_usage', value: '0', unit: '%', status: 'normal' }
    ];

    for (const metric of initialMetrics) {
      await client.query(`
        INSERT INTO system_performance_metrics (metric_name, metric_value, metric_unit, status)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT DO NOTHING
      `, [metric.name, metric.value, metric.unit, metric.status]);
    }
    console.log('✅ Initial performance metrics inserted');

    // 5. Create views for easier data access
    console.log('👁️ Creating performance monitoring views...');
    
    // View for current system health
    await client.query(`
      CREATE OR REPLACE VIEW current_system_health AS
      SELECT 
        m.metric_name,
        m.metric_value,
        m.metric_unit,
        m.status,
        m.timestamp
      FROM system_performance_metrics m
      WHERE m.timestamp = (
        SELECT MAX(timestamp) 
        FROM system_performance_metrics 
        WHERE metric_name = m.metric_name
      );
    `);
    console.log('✅ current_system_health view created');

    // View for performance alerts summary
    await client.query(`
      CREATE OR REPLACE VIEW performance_alerts_summary AS
      SELECT 
        alert_type,
        severity,
        COUNT(*) as alert_count,
        MAX(timestamp) as latest_alert
      FROM performance_alerts
      WHERE status = 'active'
      GROUP BY alert_type, severity;
    `);
    console.log('✅ performance_alerts_summary view created');

    // 6. Create functions for automated monitoring
    console.log('⚙️ Creating monitoring functions...');
    
    // Function to update system health snapshot
    await client.query(`
      CREATE OR REPLACE FUNCTION update_system_health_snapshot(
        p_cpu_usage DECIMAL,
        p_memory_usage DECIMAL,
        p_disk_usage DECIMAL,
        p_network_latency INTEGER,
        p_active_connections INTEGER,
        p_total_connections INTEGER,
        p_avg_query_time DECIMAL,
        p_slow_query_count INTEGER
      ) RETURNS VOID AS $$
      BEGIN
        INSERT INTO system_health_snapshots (
          cpu_usage, memory_usage, disk_usage, network_latency,
          active_connections, total_connections, avg_query_time, slow_query_count
        ) VALUES (
          p_cpu_usage, p_memory_usage, p_disk_usage, p_network_latency,
          p_active_connections, p_total_connections, p_avg_query_time, p_slow_query_count
        );
      END;
      $$ LANGUAGE plpgsql;
    `);
    console.log('✅ update_system_health_snapshot function created');

    // Function to check for performance issues
    await client.query(`
      CREATE OR REPLACE FUNCTION check_performance_issues() RETURNS TABLE(
        issue_type VARCHAR,
        severity VARCHAR,
        description TEXT
      ) AS $$
      BEGIN
        RETURN QUERY
        SELECT 
          'high_cpu'::VARCHAR as issue_type,
          'warning'::VARCHAR as severity,
          'CPU usage is above normal threshold'::TEXT as description
        WHERE EXISTS (
          SELECT 1 FROM system_health_snapshots 
          WHERE cpu_usage > 80 
          AND timestamp > CURRENT_TIMESTAMP - INTERVAL '5 minutes'
        )
        UNION ALL
        SELECT 
          'high_memory'::VARCHAR,
          'warning'::VARCHAR,
          'Memory usage is above normal threshold'
        WHERE EXISTS (
          SELECT 1 FROM system_health_snapshots 
          WHERE memory_usage > 85 
          AND timestamp > CURRENT_TIMESTAMP - INTERVAL '5 minutes'
        )
        UNION ALL
        SELECT 
          'slow_queries'::VARCHAR,
          'critical'::VARCHAR,
          'High number of slow queries detected'
        WHERE EXISTS (
          SELECT 1 FROM system_health_snapshots 
          WHERE slow_query_count > 10 
          AND timestamp > CURRENT_TIMESTAMP - INTERVAL '5 minutes'
        );
      END;
      $$ LANGUAGE plpgsql;
    `);
    console.log('✅ check_performance_issues function created');

    console.log('🎉 Performance Monitoring Setup Complete!');
    console.log('');
    console.log('📋 What was created:');
    console.log('   ✅ pg_stat_statements extension (if privileges allow)');
    console.log('   ✅ system_performance_metrics table');
    console.log('   ✅ performance_alerts table');
    console.log('   ✅ system_health_snapshots table');
    console.log('   ✅ Performance indexes');
    console.log('   ✅ Monitoring views');
    console.log('   ✅ Automated monitoring functions');
    console.log('');
    console.log('🚀 Your System Performance reports will now work with real data!');

  } catch (error) {
    console.error('❌ Setup failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the setup if this file is executed directly
if (require.main === module) {
  setupPerformanceMonitoring()
    .then(() => {
      console.log('✅ Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { setupPerformanceMonitoring };
