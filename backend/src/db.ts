import sql from "mssql";

const config: sql.config = {
  server: process.env.DB_SERVER as string,
  database: process.env.DB_DATABASE as string,
  user: process.env.DB_USER as string,
  password: process.env.DB_PASSWORD as string,
  options: {
    encrypt: process.env.DB_ENCRYPT === "true",
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERT === "true",
  },
};

export const poolPromise = new sql.ConnectionPool(config)
  .connect()
  .then(pool => {
    console.log("✅ Conectado a SQL Server");
    return pool;
  })
  .catch(err => {
    console.error("❌ Error conectando a SQL:", err);
    throw err;
  });

export { sql };