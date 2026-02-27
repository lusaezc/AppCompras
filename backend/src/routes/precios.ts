import { Router } from "express";
import sql from "mssql";
import { poolPromise } from "../db";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const limitRaw = Number(req.query.limit ?? 120);
    const limit = Number.isFinite(limitRaw)
      ? Math.max(20, Math.min(300, Math.trunc(limitRaw)))
      : 120;
    const searchRaw = String(req.query.q ?? "").trim();
    const search = searchRaw.length > 0 ? `%${searchRaw}%` : null;

    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("Limit", sql.Int, limit)
      .input("Search", sql.NVarChar(120), search).query(`
        SELECT TOP (@Limit)
          rp.RegistroPrecioId,
          rp.ProductoId,
          rp.SucursalId,
          rp.Precio,
          rp.FechaRegistro,
          rp.UserId,
          rp.EsValido,
          p.CodigoBarra,
          p.NombreProducto,
          m.Nombre AS Marca,
          c.Nombre AS Categoria,
          s.NombreSucursal,
          sup.Nombre AS NombreSupermercado,
          u.Nombre AS NombreUsuario
        FROM [dbo].[RegistroPrecio] rp
        LEFT JOIN [dbo].[Producto] p
          ON p.ProductoId = rp.ProductoId
        LEFT JOIN [dbo].[Marcas] m
          ON m.MarcaId = p.MarcaId
        LEFT JOIN [dbo].[Categorias] c
          ON c.CategoriaId = p.CategoriaId
        LEFT JOIN [dbo].[Sucursal] s
          ON s.SucursalId = rp.SucursalId
        LEFT JOIN [dbo].[Supermercado] sup
          ON sup.SupermercadoId = s.SupermercadoId
        LEFT JOIN [dbo].[Usuario] u
          ON u.UserId = rp.UserId
        WHERE rp.EsValido = 1
          AND (
            @Search IS NULL
            OR p.NombreProducto LIKE @Search
            OR p.CodigoBarra LIKE @Search
            OR u.Nombre LIKE @Search
            OR sup.Nombre LIKE @Search
          )
        ORDER BY rp.FechaRegistro DESC, rp.RegistroPrecioId DESC
      `);

    return res.json({
      ok: true,
      data: result.recordset,
      meta: {
        limit,
        count: result.recordset.length,
      },
    });
  } catch (error) {
    console.error("❌ Error consultando feed de precios:", error);
    return res.status(500).json({
      ok: false,
      message: "Error consultando feed de precios",
    });
  }
});

export default router;
