import { Router } from "express";
import { poolPromise } from "../db";

const router = Router();

router.get("/db-test", async (req, res) => {
  try {
    const pool = await poolPromise;

    const result = await pool.request().query(`
      SELECT 
        @@SERVERNAME AS server,
        DB_NAME() AS databaseName,
        GETDATE() AS now
    `);

    res.json({
      ok: true,
      data: result.recordset[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      ok: false,
      error: "Error consultando la base de datos",
    });
  }
});

export default router;