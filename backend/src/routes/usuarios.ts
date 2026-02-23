import { Router } from "express";
import sql from "mssql";
import { poolPromise } from "../db";

const router = Router();

const getRoleColumn = async () => {
  const pool = await poolPromise;
  const result = await pool.request().query(`
    SELECT
      CASE
        WHEN COL_LENGTH('dbo.Usuario', 'lider') IS NOT NULL THEN 'lider'
        WHEN COL_LENGTH('dbo.Usuario', 'admin') IS NOT NULL THEN 'admin'
        ELSE NULL
      END AS RoleColumn
  `);

  const roleColumn = result.recordset?.[0]?.RoleColumn as
    | string
    | null
    | undefined;
  if (roleColumn === "lider" || roleColumn === "admin") {
    return roleColumn;
  }
  return null;
};

const isLider = async (userId: number) => {
  const pool = await poolPromise;
  const roleColumn = await getRoleColumn();
  if (!roleColumn) return false;

  const result = await pool
    .request()
    .input("UserId", sql.Int, userId)
    .query(`
      SELECT TOP 1
        UserId
      FROM [dbo].[Usuario]
      WHERE UserId = @UserId
        AND Activo = 1
        AND [${roleColumn}] = 1
    `);

  return Boolean(result.recordset[0]);
};

router.get("/", async (_req, res) => {
  try {
    const pool = await poolPromise;
    const roleColumn = await getRoleColumn();
    const roleSelect = roleColumn
      ? `, [${roleColumn}] AS [lider]`
      : ", CAST(0 AS bit) AS [lider]";

    const result = await pool.request().query(`
      SELECT
        UserId,
        Nombre,
        Email,
        FechaRegistro,
        NivelConfianza,
        Activo
        ${roleSelect}
      FROM [dbo].[Usuario]
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

router.get("/lider/list", async (req, res) => {
  const liderUserId = Number(req.query.liderUserId);
  if (!Number.isInteger(liderUserId) || liderUserId <= 0) {
    return res.status(400).json({
      ok: false,
      message: "liderUserId invalido",
    });
  }

  try {
    const allowed = await isLider(liderUserId);
    if (!allowed) {
      return res.status(403).json({
        ok: false,
        message: "No tienes permisos de lider",
      });
    }

    const pool = await poolPromise;
    const roleColumn = await getRoleColumn();
    const roleSelect = roleColumn
      ? `, [${roleColumn}] AS [lider]`
      : ", CAST(0 AS bit) AS [lider]";
    const roleOrder = roleColumn
      ? `CASE WHEN [${roleColumn}] = 1 THEN 0 ELSE 1 END,`
      : "";

    const result = await pool.request().query(`
      SELECT
        UserId,
        Nombre,
        Email,
        FechaRegistro,
        NivelConfianza,
        Activo
        ${roleSelect}
      FROM [dbo].[Usuario]
      ORDER BY
        ${roleOrder}
        Nombre ASC
    `);

    return res.json({
      ok: true,
      data: result.recordset,
    });
  } catch (error) {
    console.error("❌ Error consultando usuarios para administracion:", error);
    return res.status(500).json({
      ok: false,
      message: "Error consultando usuarios para administracion",
    });
  }
});

router.patch("/:id/activo", async (req, res) => {
  const userId = Number(req.params.id);
  const { activo, liderUserId } = req.body ?? {};

  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({
      ok: false,
      message: "UserId invalido",
    });
  }

  if (!Number.isInteger(Number(liderUserId)) || Number(liderUserId) <= 0) {
    return res.status(400).json({
      ok: false,
      message: "liderUserId invalido",
    });
  }

  if (typeof activo !== "boolean") {
    return res.status(400).json({
      ok: false,
      message: "activo debe ser booleano",
    });
  }

  try {
    const allowed = await isLider(Number(liderUserId));
    if (!allowed) {
      return res.status(403).json({
        ok: false,
        message: "No tienes permisos de lider",
      });
    }

    if (Number(liderUserId) === userId && activo === false) {
      return res.status(400).json({
        ok: false,
        message: "No puedes desactivar tu propia cuenta",
      });
    }

    const pool = await poolPromise;
    const roleColumn = await getRoleColumn();
    const roleSelect = roleColumn
      ? `, [${roleColumn}] AS [lider]`
      : ", CAST(0 AS bit) AS [lider]";

    const targetCheck = await pool
      .request()
      .input("UserId", sql.Int, userId)
      .query(`
        SELECT TOP 1
          UserId
          ${roleSelect}
        FROM [dbo].[Usuario]
        WHERE UserId = @UserId
      `);

    if (!targetCheck.recordset[0]) {
      return res.status(404).json({
        ok: false,
        message: "Usuario no encontrado",
      });
    }

    if (Number(targetCheck.recordset[0].lider) === 1 && activo === false) {
      return res.status(400).json({
        ok: false,
        message: "No se permite desactivar cuentas lider",
      });
    }

    await pool
      .request()
      .input("UserId", sql.Int, userId)
      .input("Activo", sql.Bit, activo)
      .query(`
        UPDATE [dbo].[Usuario]
        SET Activo = @Activo
        WHERE UserId = @UserId
      `);

    return res.json({
      ok: true,
      message: activo
        ? "Cuenta activada correctamente"
        : "Cuenta desactivada correctamente",
    });
  } catch (error) {
    console.error("❌ Error actualizando estado de usuario:", error);
    return res.status(500).json({
      ok: false,
      message: "Error actualizando estado de usuario",
    });
  }
});

router.patch("/:id/lider", async (req, res) => {
  const userId = Number(req.params.id);
  const { lider, liderUserId } = req.body ?? {};

  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({
      ok: false,
      message: "UserId invalido",
    });
  }

  if (!Number.isInteger(Number(liderUserId)) || Number(liderUserId) <= 0) {
    return res.status(400).json({
      ok: false,
      message: "liderUserId invalido",
    });
  }

  if (typeof lider !== "boolean") {
    return res.status(400).json({
      ok: false,
      message: "lider debe ser booleano",
    });
  }

  try {
    const allowed = await isLider(Number(liderUserId));
    if (!allowed) {
      return res.status(403).json({
        ok: false,
        message: "No tienes permisos de lider",
      });
    }

    if (Number(liderUserId) === userId && lider === false) {
      return res.status(400).json({
        ok: false,
        message: "No puedes quitarte el rol de administrador",
      });
    }

    const pool = await poolPromise;
    const roleColumn = await getRoleColumn();
    if (!roleColumn) {
      return res.status(500).json({
        ok: false,
        message: "No se encontro columna de rol (lider/admin) en Usuario",
      });
    }

    const targetCheck = await pool
      .request()
      .input("UserId", sql.Int, userId)
      .query(`
        SELECT TOP 1
          UserId
        FROM [dbo].[Usuario]
        WHERE UserId = @UserId
      `);

    if (!targetCheck.recordset[0]) {
      return res.status(404).json({
        ok: false,
        message: "Usuario no encontrado",
      });
    }

    await pool
      .request()
      .input("UserId", sql.Int, userId)
      .input("Lider", sql.Bit, lider)
      .query(`
        UPDATE [dbo].[Usuario]
        SET [${roleColumn}] = @Lider
        WHERE UserId = @UserId
      `);

    return res.json({
      ok: true,
      message: lider
        ? "Usuario promovido a administrador"
        : "Rol de administrador removido",
    });
  } catch (error) {
    console.error("❌ Error actualizando rol de usuario:", error);
    return res.status(500).json({
      ok: false,
      message: "Error actualizando rol de usuario",
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
    const roleColumn = await getRoleColumn();
    const roleSelect = roleColumn
      ? `, [${roleColumn}] AS [lider]`
      : ", CAST(0 AS bit) AS [lider]";

    const result = await pool.request().input("userId", userId).query(`
      SELECT TOP 1
        UserId,
        Nombre,
        Email,
        FechaRegistro,
        NivelConfianza,
        Activo
        ${roleSelect}
      FROM [dbo].[Usuario]
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
