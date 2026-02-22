import { Router, Request, Response } from "express";
import sql from "mssql";
import { poolPromise } from "../db";

const router = Router();

router.get("/", async (_req: Request, res: Response) => {
  try {
    const pool = await poolPromise;

    const result = await pool.request().query(`
      SELECT
        ProductoId,
        CodigoBarra,
        NombreProducto,
        Marca,
        Categoria,
        Imagen,
        Activo
      FROM [dbo].[Producto]
      WHERE Activo = 1
      ORDER BY NombreProducto ASC
    `);

    const products = result.recordset.map((row) => {
      const imageBuffer = row.Imagen as Buffer | null | undefined;
      const base64 = imageBuffer ? imageBuffer.toString("base64") : null;
      return {
        id: String(row.ProductoId),
        code: row.CodigoBarra,
        name: row.NombreProducto,
        description: row.Categoria ?? "",
        brand: row.Marca ?? "",
        category: row.Categoria ?? "",
        image: base64 ? `data:image/*;base64,${base64}` : undefined,
        createdAt: "",
      };
    });

    res.json({
      ok: true,
      data: products,
    });
  } catch (error) {
    console.error("❌ Error consultando productos:", error);
    res.status(500).json({
      ok: false,
      message: "Error consultando productos",
    });
  }
});

router.get("/codigo/:code", async (req: Request, res: Response) => {
  try {
    const rawCode = req.params.code;
    if (!rawCode) {
      return res.status(400).json({
        ok: false,
        message: "codigo invalido",
      });
    }

    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("CodigoBarra", sql.NVarChar(50), rawCode)
      .query(`
        SELECT TOP 1
          ProductoId,
          CodigoBarra,
          NombreProducto,
          Marca,
          Categoria,
          Imagen,
          Activo
        FROM [dbo].[Producto]
        WHERE CodigoBarra = @CodigoBarra
      `);

    if (!result.recordset?.length) {
      return res.status(404).json({
        ok: false,
        message: "Producto no encontrado",
      });
    }

    const row = result.recordset[0];
    const imageBuffer = row.Imagen as Buffer | null | undefined;
    const base64 = imageBuffer ? imageBuffer.toString("base64") : null;
    const product = {
      id: String(row.ProductoId),
      code: row.CodigoBarra,
      name: row.NombreProducto,
      description: row.Categoria ?? "",
      brand: row.Marca ?? "",
      category: row.Categoria ?? "",
      image: base64 ? `data:image/*;base64,${base64}` : undefined,
      createdAt: "",
    };

    res.json({
      ok: true,
      data: product,
    });
  } catch (error) {
    console.error("❌ Error consultando producto:", error);
    res.status(500).json({
      ok: false,
      message: "Error consultando producto",
    });
  }
});

router.get("/:id/historial-precios", async (req: Request, res: Response) => {
  try {
    const productoId = Number(req.params.id);
    if (Number.isNaN(productoId)) {
      return res.status(400).json({
        ok: false,
        message: "id invalido",
      });
    }

    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("ProductoId", sql.Int, productoId)
      .query(`
        SELECT
          rp.RegistroPrecioId,
          rp.ProductoId,
          rp.SucursalId,
          rp.Precio,
          rp.FechaRegistro,
          rp.UserId,
          rp.EsValido,
          s.NombreSucursal,
          u.Nombre AS NombreUsuario
        FROM [dbo].[RegistroPrecio] rp
        LEFT JOIN [dbo].[Sucursal] s
          ON s.SucursalId = rp.SucursalId
        LEFT JOIN [dbo].[Usuario] u
          ON u.UserId = rp.UserId
        WHERE rp.ProductoId = @ProductoId
        ORDER BY rp.FechaRegistro DESC, rp.RegistroPrecioId DESC
      `);

    res.json({
      ok: true,
      data: result.recordset,
    });
  } catch (error) {
    console.error("❌ Error consultando historial de precios:", error);
    res.status(500).json({
      ok: false,
      message: "Error consultando historial de precios",
    });
  }
});

router.put("/:id", async (req: Request, res: Response) => {
  try {
    const productoId = Number(req.params.id);
    if (Number.isNaN(productoId)) {
      return res.status(400).json({
        ok: false,
        message: "id invalido",
      });
    }

    const {
      CodigoBarra,
      NombreProducto,
      Marca,
      Categoria,
      Imagen,
      code,
      name,
      brand,
      category,
      image,
    } = req.body;

    const codigo = CodigoBarra ?? code;
    const nombre = NombreProducto ?? name;
    const marca = Marca ?? brand ?? null;
    const categoria = Categoria ?? category ?? null;
    const imagenRaw = Imagen ?? image ?? null;

    if (!codigo || !nombre) {
      return res.status(400).json({
        ok: false,
        message: "CodigoBarra y NombreProducto son obligatorios",
      });
    }

    let imagenBuffer: Buffer | null = null;
    if (typeof imagenRaw === "string" && imagenRaw.length > 0) {
      const base64 = imagenRaw.includes(",")
        ? (imagenRaw.split(",")[1] ?? "")
        : imagenRaw;
      try {
        imagenBuffer = base64 ? Buffer.from(base64, "base64") : null;
      } catch {
        imagenBuffer = null;
      }
    }

    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("ProductoId", sql.Int, productoId)
      .input("CodigoBarra", sql.NVarChar(50), codigo)
      .input("NombreProducto", sql.NVarChar(150), nombre)
      .input("Marca", sql.NVarChar(100), marca)
      .input("Categoria", sql.NVarChar(100), categoria)
      .input("Imagen", sql.VarBinary(sql.MAX), imagenBuffer)
      .query(`
        UPDATE [dbo].[Producto]
        SET
          CodigoBarra = @CodigoBarra,
          NombreProducto = @NombreProducto,
          Marca = @Marca,
          Categoria = @Categoria,
          Imagen = @Imagen
        WHERE ProductoId = @ProductoId
      `);

    if (!result.rowsAffected?.[0]) {
      return res.status(404).json({
        ok: false,
        message: "Producto no encontrado",
      });
    }

    res.json({
      ok: true,
      message: "Producto actualizado",
    });
  } catch (error) {
    console.error("❌ Error actualizando producto:", error);
    const sqlError = error as { number?: number; code?: string } | null;
    const isDuplicate =
      sqlError?.number === 2627 ||
      sqlError?.number === 2601 ||
      sqlError?.code === "EREQUEST";
    if (isDuplicate) {
      return res.status(409).json({
        ok: false,
        message: "El codigo de barras ya esta registrado",
      });
    }
    res.status(500).json({
      ok: false,
      message: "Error actualizando producto",
    });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const rawId = req.params.id;
    const productoId = Number(rawId);
    if (Number.isNaN(productoId)) {
      return res.status(400).json({
        ok: false,
        message: "id invalido",
      });
    }

    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("ProductoId", sql.Int, productoId)
      .query(`
        DELETE FROM [dbo].[Producto]
        WHERE ProductoId = @ProductoId
      `);

    if (!result.rowsAffected?.[0]) {
      return res.status(404).json({
        ok: false,
        message: "Producto no encontrado",
      });
    }

    res.json({
      ok: true,
      message: "Producto eliminado",
    });
  } catch (error) {
    console.error("❌ Error eliminando producto:", error);
    res.status(500).json({
      ok: false,
      message: "Error eliminando producto",
    });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const {
      CodigoBarra,
      NombreProducto,
      Marca,
      Categoria,
      Imagen,
      code,
      name,
      description,
      image,
    } = req.body;

    const codigo = CodigoBarra ?? code;
    const nombre = NombreProducto ?? name;
    const marca = Marca ?? null;
    const categoria = Categoria ?? description ?? null;
    const activo = true;

    let imagenBuffer: Buffer | null = null;
    const imagenRaw = Imagen ?? image ?? null;
    if (typeof imagenRaw === "string" && imagenRaw.length > 0) {
      const base64 = imagenRaw.includes(",")
        ? (imagenRaw.split(",")[1] ?? "")
        : imagenRaw;
      try {
        imagenBuffer = base64 ? Buffer.from(base64, "base64") : null;
      } catch {
        imagenBuffer = null;
      }
    }

    // Validaciones mínimas
    if (!codigo || !nombre || activo === undefined) {
      return res.status(400).json({
        ok: false,
        message: "CodigoBarra, NombreProducto y Activo son obligatorios",
      });
    }

    const pool = await poolPromise;

    await pool
      .request()
      .input("CodigoBarra", sql.NVarChar(50), codigo)
      .input("NombreProducto", sql.NVarChar(150), nombre)
      .input("Marca", sql.NVarChar(100), marca)
      .input("Categoria", sql.NVarChar(100), categoria)
      .input("Imagen", sql.VarBinary(sql.MAX), imagenBuffer)
      .input("Activo", sql.Bit, activo).query(`
        INSERT INTO Producto
        (CodigoBarra, NombreProducto, Marca, Categoria, Imagen, Activo)
        VALUES
        (@CodigoBarra, @NombreProducto, @Marca, @Categoria, @Imagen, @Activo)
      `);

    res.json({
      ok: true,
      message: "Producto insertado correctamente",
    });
  } catch (error) {
    console.error("❌ Error insertando producto:", error);
    const sqlError = error as { number?: number; code?: string } | null;
    const isDuplicate =
      sqlError?.number === 2627 ||
      sqlError?.number === 2601 ||
      sqlError?.code === "EREQUEST";
    if (isDuplicate) {
      return res.status(409).json({
        ok: false,
        message: "El producto ya esta registrado en el sistema",
      });
    }
    res.status(500).json({
      ok: false,
      message: "Error insertando producto",
    });
  }
});

export default router;

