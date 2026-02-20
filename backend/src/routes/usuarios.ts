import { Router } from "express";
import { poolPromise } from "../db";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    const pool = await poolPromise;

    const result = await pool.request().query(`
      SELECT
        UserId,
        Nombre,
        Email,
        FechaRegistro,
        NivelConfianza,
        Activo
      FROM [ProductScannerDB].[dbo].[Usuario]
      WHERE Activo = 1
      ORDER BY Nombre ASC
    `);

    res.json({
      ok: true,
      data: result.recordset,
    });
  } catch (error) {
    console.error("❌ Error consultando usuarios:", error);
    res.status(500).json({
      ok: false,
      message: "Error consultando usuarios",
    });
  }
});

router.get("/:id", async (req, res) => {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({
      ok: false,
      message: "UserId invalido",
    });
  }

  try {
    const pool = await poolPromise;
    const result = await pool.request().input("userId", userId).query(`
      SELECT TOP 1
        UserId,
        Nombre,
        Email,
        FechaRegistro,
        NivelConfianza,
        Activo
      FROM [ProductScannerDB].[dbo].[Usuario]
      WHERE UserId = @userId
    `);

    if (!result.recordset[0]) {
      return res.status(404).json({
        ok: false,
        message: "Usuario no encontrado",
      });
    }

    return res.json({
      ok: true,
      data: result.recordset[0],
    });
  } catch (error) {
    console.error("❌ Error consultando usuario por id:", error);
    return res.status(500).json({
      ok: false,
      message: "Error consultando usuario",
    });
  }
});

export default router;
