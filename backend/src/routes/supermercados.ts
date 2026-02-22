import { Router, Request, Response } from "express";
import sql from "mssql";
import { poolPromise } from "../db";

const router = Router();

router.get("/", async (_req: Request, res: Response) => {
  try {
    const pool = await poolPromise;

    const result = await pool.request().query(`
      SELECT
        SupermercadoId,
        Nombre,
        Logo,
        Pais,
        Activo
      FROM [dbo].[Supermercado]
      WHERE Activo = 1
      ORDER BY Nombre ASC
    `);

    res.json({
      ok: true,
      data: result.recordset,
    });
  } catch (error) {
    console.error("❌ Error consultando supermercados:", error);
    res.status(500).json({
      ok: false,
      message: "Error consultando supermercados",
    });
  }
});

router.get("/:id/ubicacion", async (req: Request, res: Response) => {
  const supermercadoId = Number(req.params.id);
  if (!Number.isInteger(supermercadoId) || supermercadoId <= 0) {
    return res.status(400).json({
      ok: false,
      message: "SupermercadoId invalido",
    });
  }

  try {
    const pool = await poolPromise;

    const hasCoordsResult = await pool.request().query(`
      SELECT
        SUM(CASE WHEN COLUMN_NAME = 'Latitud' THEN 1 ELSE 0 END) AS HasLatitud,
        SUM(CASE WHEN COLUMN_NAME = 'Longitud' THEN 1 ELSE 0 END) AS HasLongitud
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'dbo'
        AND TABLE_NAME = 'Supermercado'
        AND COLUMN_NAME IN ('Latitud', 'Longitud')
    `);

    const hasLatitud =
      Number(hasCoordsResult.recordset?.[0]?.HasLatitud ?? 0) > 0;
    const hasLongitud =
      Number(hasCoordsResult.recordset?.[0]?.HasLongitud ?? 0) > 0;

    const coordSelect =
      hasLatitud && hasLongitud
        ? ", CAST(s.Latitud AS float) AS Latitud, CAST(s.Longitud AS float) AS Longitud"
        : ", CAST(NULL AS float) AS Latitud, CAST(NULL AS float) AS Longitud";

    const marketResult = await pool.request()
      .input("SupermercadoId", sql.Int, supermercadoId)
      .query(`
        SELECT TOP 1
          s.SupermercadoId,
          s.Nombre,
          s.Logo,
          s.Pais
          ${coordSelect}
        FROM [dbo].[Supermercado] s
        WHERE s.SupermercadoId = @SupermercadoId
      `);

    if (!marketResult.recordset?.[0]) {
      return res.status(404).json({
        ok: false,
        message: "Supermercado no encontrado",
      });
    }

    const branchesResult = await pool.request()
      .input("SupermercadoId", sql.Int, supermercadoId)
      .query(`
        SELECT
          SucursalId,
          NombreSucursal,
          Direccion,
          Comuna,
          Region,
          CAST(Latitud AS float) AS Latitud,
          CAST(Longitud AS float) AS Longitud
        FROM [dbo].[Sucursal]
        WHERE SupermercadoId = @SupermercadoId
          AND Activo = 1
        ORDER BY NombreSucursal ASC
      `);

    const market = marketResult.recordset[0] as {
      SupermercadoId: number;
      Nombre: string;
      Logo?: string | null;
      Pais?: string | null;
      Latitud?: number | null;
      Longitud?: number | null;
    };

    const branches = branchesResult.recordset as Array<{
      SucursalId: number;
      NombreSucursal: string;
      Direccion?: string | null;
      Comuna?: string | null;
      Region?: string | null;
      Latitud?: number | null;
      Longitud?: number | null;
    }>;

    const marketLat = Number(market.Latitud);
    const marketLng = Number(market.Longitud);
    const hasMarketCoords =
      Number.isFinite(marketLat) &&
      Number.isFinite(marketLng) &&
      marketLat !== 0 &&
      marketLng !== 0;

    const validBranchCoords = branches.filter((branch) => {
      const lat = Number(branch.Latitud);
      const lng = Number(branch.Longitud);
      return (
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        lat !== 0 &&
        lng !== 0
      );
    });

    const fallbackLat =
      validBranchCoords.length > 0
        ? validBranchCoords.reduce((sum, b) => sum + Number(b.Latitud), 0) /
          validBranchCoords.length
        : null;
    const fallbackLng =
      validBranchCoords.length > 0
        ? validBranchCoords.reduce((sum, b) => sum + Number(b.Longitud), 0) /
          validBranchCoords.length
        : null;

    return res.json({
      ok: true,
      data: {
        ...market,
        Latitud: hasMarketCoords ? marketLat : fallbackLat,
        Longitud: hasMarketCoords ? marketLng : fallbackLng,
        Sucursales: branches,
      },
    });
  } catch (error) {
    console.error("❌ Error consultando ubicacion de supermercado:", error);
    return res.status(500).json({
      ok: false,
      message: "Error consultando ubicacion de supermercado",
    });
  }
});

router.get("/:id/productos-precios", async (req: Request, res: Response) => {
  const supermercadoId = Number(req.params.id);
  if (!Number.isInteger(supermercadoId) || supermercadoId <= 0) {
    return res.status(400).json({
      ok: false,
      message: "SupermercadoId invalido",
    });
  }

  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input("SupermercadoId", sql.Int, supermercadoId)
      .query(`
        WITH LatestPrice AS (
          SELECT
            rp.RegistroPrecioId,
            rp.ProductoId,
            rp.Precio,
            rp.FechaRegistro,
            rp.SucursalId,
            p.CodigoBarra,
            p.NombreProducto,
            p.Marca,
            p.Categoria,
            p.Imagen,
            s.NombreSucursal,
            ROW_NUMBER() OVER (
              PARTITION BY rp.ProductoId
              ORDER BY rp.FechaRegistro DESC, rp.RegistroPrecioId DESC
            ) AS RN
          FROM [dbo].[RegistroPrecio] rp
          INNER JOIN [dbo].[Sucursal] s
            ON s.SucursalId = rp.SucursalId
          INNER JOIN [dbo].[Producto] p
            ON p.ProductoId = rp.ProductoId
          WHERE s.SupermercadoId = @SupermercadoId
            AND rp.EsValido = 1
        )
        SELECT
          RegistroPrecioId,
          ProductoId,
          Precio,
          FechaRegistro,
          SucursalId,
          CodigoBarra,
          NombreProducto,
          Marca,
          Categoria,
          Imagen,
          NombreSucursal
        FROM LatestPrice
        WHERE RN = 1
        ORDER BY NombreProducto ASC
      `);

    const items = result.recordset.map((row) => {
      const imageBuffer = row.Imagen as Buffer | null | undefined;
      const base64 = imageBuffer ? imageBuffer.toString("base64") : null;
      return {
        ...row,
        Imagen: base64 ? `data:image/*;base64,${base64}` : null,
      };
    });

    return res.json({
      ok: true,
      data: items,
    });
  } catch (error) {
    console.error("❌ Error consultando precios por supermercado:", error);
    return res.status(500).json({
      ok: false,
      message: "Error consultando precios por supermercado",
    });
  }
});

export default router;

