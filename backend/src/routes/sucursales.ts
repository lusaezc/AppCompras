import { Router } from "express";
import sql from "mssql";
import { poolPromise } from "../db";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const { supermercadoId } = req.query;

    if (!supermercadoId) {
      return res.status(400).json({
        ok: false,
        message: "supermercadoId es obligatorio",
      });
    }

    const supermercadoIdNum = Number(supermercadoId);
    if (Number.isNaN(supermercadoIdNum)) {
      return res.status(400).json({
        ok: false,
        message: "supermercadoId invalido",
      });
    }

    const pool = await poolPromise;

    const result = await pool
      .request()
      .input("SupermercadoId", sql.Int, supermercadoIdNum).query(`
        SELECT
          SucursalId,
          SupermercadoId,
          NombreSucursal,
          Direccion,
          Comuna,
          Region,
          Latitud,
          Longitud,
          Activo
        FROM [ProductScannerDB].[dbo].[Sucursal]
        WHERE Activo = 1 AND SupermercadoId = @SupermercadoId
        ORDER BY NombreSucursal ASC
      `);

    res.json({
      ok: true,
      data: result.recordset,
    });
  } catch (error) {
    console.error("❌ Error consultando sucursales:", error);
    res.status(500).json({
      ok: false,
      message: "Error consultando sucursales",
    });
  }
});

export default router;
