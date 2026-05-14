var mysql = require('mysql');
const { promisify } = require("util");
const winston = require("./winston");
const enviroment = require("./config");

const config = {
    timezone: 'utc',
    host: enviroment.HOST_BD,
    user: enviroment.USER_BD,
    password: enviroment.PASSWORD_BD,
    database: enviroment.DATABASE,
    port: enviroment.PORT_BD,

    // Pool settings
    connectionLimit: 10,
    waitForConnections: true,
    queueLimit: 100,          // fail fast after 100 queued requests instead of queueing forever
    connectTimeout: 10000,    // 10s to establish a new connection to MySQL

    multipleStatements: true,
    typeCast: function castField(field, useDefaultTypeCasting) {
        if ((field.type === "BIT") && (field.length === 1)) {
            var bytes = field.buffer();
            return (bytes[0] === 1);
        }
        return (useDefaultTypeCasting());
    }
};

function createPool() {
    const pool = mysql.createPool(config);

    pool.on('error', (err) => {
        winston.error('Pool error: ' + err.code + ' - ' + err.message);
        if (err.fatal) {
            winston.error('Fatal pool error, recreating pool...');
        }
    });

    pool.getConnection((err, connection) => {
        if (err) {
            if (err.code === 'PROTOCOL_CONNECTION_LOST') winston.error('Database connection lost');
            else if (err.code === 'ER_CON_COUNT_ERROR') winston.error('Too many database connections');
            else if (err.code === 'ECONNREFUSED') winston.error('Database connection refused');
            else if (err.code === 'ER_ACCESS_DENIED_ERROR') winston.error('Database access denied: ' + err.message);
            else winston.error('Database connection error: ' + err.message);
            return;
        }
        if (connection) {
            connection.release();
            winston.info('Database connection successful');
        }
    });

    // Wrap query to add a per-query timeout and proper error propagation
    const originalQuery = promisify(pool.query.bind(pool));
    pool.query = function (sql, values) {
        return Promise.race([
            originalQuery(sql, values),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('DB query timeout after 30s')), 30000)
            )
        ]);
    };

    return pool;
}

const mysqlPool = createPool();
module.exports = mysqlPool;