import sql from "mssql";
import dotenv from "dotenv";

dotenv.config();

async function test() {
  try {
    const pool = await sql.connect({
      server: process.env.DB_SERVER!,
      database: process.env.DB_DATABASE!,
      options: {
        trustServerCertificate: true,
        instanceName: process.env.DB_INSTANCE,
      },
      authentication: {
        type: "ntlm",
        options: {
          userName: "",
          password: "",
          domain: "",
        },
      },
    });

    const result = await pool.request().query("SELECT GETDATE() as now");
    console.log("✅ OK:", result.recordset);
  } catch (err) {
    console.error("❌ ERROR DIRECTO:", err);
  }
}

test();