import { Router } from "express";
import { poolPromise } from "../db";

type LoginBody = {
  usuario?: string;
  contrasena?: string;
};

const router = Router();

router.post("/login", async (req, res) => {
  const { usuario, contrasena } = (req.body ?? {}) as LoginBody;

  if (!usuario || !contrasena) {
    return res.status(400).json({
      ok: false,
      message: "Debes enviar usuario y contrasena.",
    });
  }

  try {
    const pool = await poolPromise;

    const result = await pool
      .request()
      .input("usuario", usuario)
      .input("contrasena", contrasena).query(`
        SELECT TOP 1
          UserId,
          Nombre,
          Email,
          FechaRegistro,
          NivelConfianza,
          Activo
        FROM [dbo].[Usuario]
        WHERE [usuario] = @usuario
          AND [contraseña] = @contrasena
          AND Activo = 1
      `);

    if (!result.recordset[0]) {
      return res.status(401).json({
        ok: false,
        message: "Credenciales invalidas.",
      });
    }

    return res.json({
      ok: true,
      data: result.recordset[0],
    });
  } catch (error) {
    console.error("❌ Error en login:", error);
    return res.status(500).json({
      ok: false,
      message: "Error autenticando usuario",
    });
  }
});

export default router;

