import { Router, Request, Response } from "express";
import sql from "mssql";
import { poolPromise } from "../db";

type CompraItemInput = {
  ProductoId: number;
  PrecioUnitario: number;
  Cantidad: number;
};

const router = Router();

router.get("/user/:userId", async (req: Request, res: Response) => {
  const userId = Number(req.params.userId);
  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({
      ok: false,
      message: "UserId invalido",
    });
  }

  try {
    const pool = await poolPromise;
    const result = await pool.request().input("UserId", sql.Int, userId).query(`
      SELECT
        cu.CompraId,
        cu.UserId,
        cu.FechaCompra,
        cu.TotalCompra,
        cu.SucursalId,
        s.NombreSucursal,
        sup.Nombre AS NombreSupermercado,
        COUNT(dc.DetalleCompraId) AS TotalItems
      FROM [dbo].[CompraUsuario] cu
      LEFT JOIN [dbo].[Sucursal] s
        ON s.SucursalId = cu.SucursalId
      LEFT JOIN [dbo].[Supermercado] sup
        ON sup.SupermercadoId = s.SupermercadoId
      LEFT JOIN [dbo].[DetalleCompra] dc
        ON dc.CompraId = cu.CompraId
      WHERE cu.UserId = @UserId
      GROUP BY
        cu.CompraId,
        cu.UserId,
        cu.FechaCompra,
        cu.TotalCompra,
        cu.SucursalId,
        s.NombreSucursal,
        sup.Nombre
      ORDER BY cu.FechaCompra DESC, cu.CompraId DESC
    `);

    return res.json({
      ok: true,
      data: result.recordset,
    });
  } catch (error) {
    console.error("❌ Error consultando historial de compras:", error);
    return res.status(500).json({
      ok: false,
      message: "Error consultando historial de compras",
    });
  }
});

router.get("/:compraId/items", async (req: Request, res: Response) => {
  const compraId = Number(req.params.compraId);
  if (!Number.isInteger(compraId) || compraId <= 0) {
    return res.status(400).json({
      ok: false,
      message: "CompraId invalido",
    });
  }

  try {
    const pool = await poolPromise;
    const result = await pool.request().input("CompraId", sql.Int, compraId)
      .query(`
        SELECT
          dc.DetalleCompraId,
          dc.CompraId,
          dc.ProductoId,
          dc.PrecioUnitario,
          dc.Cantidad,
          dc.Subtotal,
          p.CodigoBarra,
          p.NombreProducto,
          m.Nombre AS Marca,
          c.Nombre AS Categoria,
          p.Imagen
        FROM [dbo].[DetalleCompra] dc
        LEFT JOIN [dbo].[Producto] p
          ON p.ProductoId = dc.ProductoId
        LEFT JOIN [dbo].[Marcas] m
          ON m.MarcaId = p.MarcaId
        LEFT JOIN [dbo].[Categorias] c
          ON c.CategoriaId = p.CategoriaId
        WHERE dc.CompraId = @CompraId
        ORDER BY dc.DetalleCompraId ASC
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
    console.error("❌ Error consultando detalle de compra:", error);
    return res.status(500).json({
      ok: false,
      message: "Error consultando detalle de compra",
    });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const { UserId, FechaCompra, TotalCompra, SucursalId, Items } = req.body as {
      UserId?: number;
      FechaCompra?: string;
      TotalCompra?: number;
      SucursalId?: number;
      Items?: CompraItemInput[];
    };

    if (!UserId || !FechaCompra || !SucursalId || !Array.isArray(Items)) {
      return res.status(400).json({
        ok: false,
        message:
          "UserId, FechaCompra, SucursalId e Items son obligatorios",
      });
    }

    if (Items.length === 0) {
      return res.status(400).json({
        ok: false,
        message: "Debe incluir al menos un producto",
      });
    }

    const pool = await poolPromise;
    const tx = new sql.Transaction(pool);
    await tx.begin();

    try {
      const total =
        typeof TotalCompra === "number"
          ? TotalCompra
          : Items.reduce(
              (sum, item) => sum + item.Cantidad * item.PrecioUnitario,
              0,
            );

      const headerResult = await new sql.Request(tx)
        .input("UserId", sql.Int, UserId)
        .input("FechaCompra", sql.Date, FechaCompra)
        .input("TotalCompra", sql.Decimal(18, 2), total)
        .input("SucursalId", sql.Int, SucursalId)
        .query(`
          INSERT INTO [dbo].[CompraUsuario]
            (UserId, FechaCompra, TotalCompra, SucursalId)
          OUTPUT INSERTED.CompraId
          VALUES
            (@UserId, @FechaCompra, @TotalCompra, @SucursalId)
        `);

      const compraId = headerResult.recordset?.[0]?.CompraId as
        | number
        | undefined;

      if (!compraId) {
        throw new Error("No se pudo crear la compra");
      }

      for (const item of Items) {
        const subtotal = item.Cantidad * item.PrecioUnitario;
        await new sql.Request(tx)
          .input("CompraId", sql.Int, compraId)
          .input("ProductoId", sql.Int, item.ProductoId)
          .input("PrecioUnitario", sql.Decimal(18, 2), item.PrecioUnitario)
          .input("Cantidad", sql.Int, item.Cantidad)
          .input("Subtotal", sql.Decimal(18, 2), subtotal)
          .query(`
            INSERT INTO [dbo].[DetalleCompra]
              (CompraId, ProductoId, PrecioUnitario, Cantidad, Subtotal)
            VALUES
              (@CompraId, @ProductoId, @PrecioUnitario, @Cantidad, @Subtotal)
          `);

        await new sql.Request(tx)
          .input("ProductoId", sql.Int, item.ProductoId)
          .input("SucursalId", sql.Int, SucursalId)
          .input("Precio", sql.Decimal(18, 2), item.PrecioUnitario)
          .input("FechaRegistro", sql.Date, FechaCompra)
          .input("UserId", sql.Int, UserId)
          .input("EsValido", sql.Bit, true)
          .query(`
            INSERT INTO [dbo].[RegistroPrecio]
              (ProductoId, SucursalId, Precio, FechaRegistro, UserId, EsValido)
            VALUES
              (@ProductoId, @SucursalId, @Precio, @FechaRegistro, @UserId, @EsValido)
          `);
      }

      await tx.commit();

      res.json({
        ok: true,
        data: { CompraId: compraId },
      });
    } catch (innerError) {
      await tx.rollback();
      throw innerError;
    }
  } catch (error) {
    console.error("❌ Error insertando compra:", error);
    res.status(500).json({
      ok: false,
      message: "Error insertando compra",
    });
  }
});

export default router;

