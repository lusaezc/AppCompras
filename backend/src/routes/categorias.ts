import { Router } from "express";
import sql from "mssql";
import { poolPromise } from "../db";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT
        CategoriaId,
        Nombre,
        Descripcion,
        Activo,
        FechaCreacion,
        FechaModificacion
      FROM [dbo].[Categorias]
      WHERE Activo = 1
      ORDER BY Nombre ASC
    `);

    return res.json({
      ok: true,
      data: result.recordset,
    });
  } catch (error) {
    console.error("Error consultando categorias:", error);
    return res.status(500).json({
      ok: false,
      message: "Error consultando categorias",
    });
  }
});

router.post("/", async (req, res) => {
  const { Nombre, Descripcion, nombre, descripcion } = req.body ?? {};
  const finalNombre = String(Nombre ?? nombre ?? "").trim();
  const finalDescripcion = String(Descripcion ?? descripcion ?? "").trim();

  if (!finalNombre) {
    return res.status(400).json({
      ok: false,
      message: "Nombre es obligatorio",
    });
  }

  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("Nombre", sql.NVarChar(120), finalNombre)
      .input(
        "Descripcion",
        sql.NVarChar(300),
        finalDescripcion.length > 0 ? finalDescripcion : null,
      )
      .query(`
        INSERT INTO [dbo].[Categorias]
          (Nombre, Descripcion, Activo, FechaCreacion, FechaModificacion)
        OUTPUT INSERTED.CategoriaId, INSERTED.Nombre, INSERTED.Descripcion, INSERTED.Activo
        VALUES
          (@Nombre, @Descripcion, 1, GETDATE(), GETDATE())
      `);

    return res.status(201).json({
      ok: true,
      data: result.recordset?.[0] ?? null,
      message: "Categoria creada correctamente",
    });
  } catch (error) {
    console.error("Error creando categoria:", error);
    const sqlError = error as { number?: number } | null;
    if (sqlError?.number === 2627 || sqlError?.number === 2601) {
      return res.status(409).json({
        ok: false,
        message: "La categoria ya existe",
      });
    }
    return res.status(500).json({
      ok: false,
      message: "Error creando categoria",
    });
  }
});

export default router;
