import { Router, Request, Response } from "express";
import sql from "mssql";
import { poolPromise } from "../db";

const router = Router();

type ProductRow = {
  ProductoId: number;
  CodigoBarra: string;
  NombreProducto: string;
  Marca?: string | null;
  Categoria?: string | null;
  MarcaId?: number | null;
  CategoriaId?: number | null;
  Imagen?: Buffer | null;
};

const mapProductRow = (row: ProductRow) => {
  const imageBuffer = row.Imagen as Buffer | null | undefined;
  const base64 = imageBuffer ? imageBuffer.toString("base64") : null;
  return {
    id: String(row.ProductoId),
    code: row.CodigoBarra,
    name: row.NombreProducto,
    description: row.Categoria ?? "",
    brand: row.Marca ?? "",
    category: row.Categoria ?? "",
    brandId: row.MarcaId ?? null,
    categoryId: row.CategoriaId ?? null,
    image: base64 ? `data:image/*;base64,${base64}` : undefined,
    createdAt: "",
  };
};

router.get("/", async (_req: Request, res: Response) => {
  try {
    const pool = await poolPromise;

    const result = await pool.request().query(`
      SELECT
        p.ProductoId,
        p.CodigoBarra,
        p.NombreProducto,
        p.MarcaId,
        p.CategoriaId,
        m.Nombre AS Marca,
        c.Nombre AS Categoria,
        p.Imagen,
        p.Activo
      FROM [dbo].[Producto] p
      LEFT JOIN [dbo].[Marcas] m
        ON m.MarcaId = p.MarcaId
      LEFT JOIN [dbo].[Categorias] c
        ON c.CategoriaId = p.CategoriaId
      WHERE p.Activo = 1
      ORDER BY p.NombreProducto ASC
    `);

    res.json({
      ok: true,
      data: result.recordset.map(mapProductRow),
    });
  } catch (error) {
    console.error("Error consultando productos:", error);
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
          p.ProductoId,
          p.CodigoBarra,
          p.NombreProducto,
          p.MarcaId,
          p.CategoriaId,
          m.Nombre AS Marca,
          c.Nombre AS Categoria,
          p.Imagen,
          p.Activo
        FROM [dbo].[Producto] p
        LEFT JOIN [dbo].[Marcas] m
          ON m.MarcaId = p.MarcaId
        LEFT JOIN [dbo].[Categorias] c
          ON c.CategoriaId = p.CategoriaId
        WHERE p.CodigoBarra = @CodigoBarra
      `);

    if (!result.recordset?.length) {
      return res.status(404).json({
        ok: false,
        message: "Producto no encontrado",
      });
    }

    res.json({
      ok: true,
      data: mapProductRow(result.recordset[0] as ProductRow),
    });
  } catch (error) {
    console.error("Error consultando producto:", error);
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
    console.error("Error consultando historial de precios:", error);
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
      MarcaId,
      CategoriaId,
      Imagen,
      code,
      name,
      brandId,
      categoryId,
      image,
    } = req.body;

    const codigo = CodigoBarra ?? code;
    const nombre = NombreProducto ?? name;
    const marcaId = Number(MarcaId ?? brandId);
    const categoriaId = Number(CategoriaId ?? categoryId);
    const imagenRaw = Imagen ?? image ?? null;

    if (!codigo || !nombre || !Number.isInteger(marcaId) || !Number.isInteger(categoriaId)) {
      return res.status(400).json({
        ok: false,
        message: "CodigoBarra, NombreProducto, MarcaId y CategoriaId son obligatorios",
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
      .input("MarcaId", sql.Int, marcaId)
      .input("CategoriaId", sql.Int, categoriaId)
      .input("Imagen", sql.VarBinary(sql.MAX), imagenBuffer)
      .query(`
        UPDATE [dbo].[Producto]
        SET
          CodigoBarra = @CodigoBarra,
          NombreProducto = @NombreProducto,
          MarcaId = @MarcaId,
          CategoriaId = @CategoriaId,
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
    console.error("Error actualizando producto:", error);
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
    console.error("Error eliminando producto:", error);
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
      MarcaId,
      CategoriaId,
      Imagen,
      code,
      name,
      brandId,
      categoryId,
      image,
    } = req.body;

    const codigo = CodigoBarra ?? code;
    const nombre = NombreProducto ?? name;
    const marcaId = Number(MarcaId ?? brandId);
    const categoriaId = Number(CategoriaId ?? categoryId);
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

    if (!codigo || !nombre || !Number.isInteger(marcaId) || !Number.isInteger(categoriaId)) {
      return res.status(400).json({
        ok: false,
        message: "CodigoBarra, NombreProducto, MarcaId y CategoriaId son obligatorios",
      });
    }

    const pool = await poolPromise;

    await pool
      .request()
      .input("CodigoBarra", sql.NVarChar(50), codigo)
      .input("NombreProducto", sql.NVarChar(150), nombre)
      .input("MarcaId", sql.Int, marcaId)
      .input("CategoriaId", sql.Int, categoriaId)
      .input("Imagen", sql.VarBinary(sql.MAX), imagenBuffer)
      .input("Activo", sql.Bit, activo).query(`
        INSERT INTO [dbo].[Producto]
        (CodigoBarra, NombreProducto, Imagen, Activo, CategoriaId, MarcaId)
        VALUES
        (@CodigoBarra, @NombreProducto, @Imagen, @Activo, @CategoriaId, @MarcaId)
      `);

    res.json({
      ok: true,
      message: "Producto insertado correctamente",
    });
  } catch (error) {
    console.error("Error insertando producto:", error);
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
