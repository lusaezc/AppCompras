import dotenv from "dotenv";
dotenv.config();

import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import productosRoutes from "./routes/productos";
import testRoutes from "./routes/test";
import supermercadosRoutes from "./routes/supermercados";
import usuariosRoutes from "./routes/usuarios";
import sucursalesRoutes from "./routes/sucursales";
import comprasRoutes from "./routes/compras";
import authRoutes from "./routes/auth";
import preciosRoutes from "./routes/precios";
import marcasRoutes from "./routes/marcas";
import categoriasRoutes from "./routes/categorias";
import ocrRoutes from "./routes/ocr";

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

app.use("/api", testRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/productos", productosRoutes);
app.use("/api/supermercados", supermercadosRoutes);
app.use("/api/usuarios", usuariosRoutes);
app.use("/api/sucursales", sucursalesRoutes);
app.use("/api/compras", comprasRoutes);
app.use("/api/precios", preciosRoutes);
app.use("/api/marcas", marcasRoutes);
app.use("/api/categorias", categoriasRoutes);
app.use("/api/ocr", ocrRoutes);

app.use((err: Error & { type?: string }, _req: Request, res: Response, next: NextFunction) => {
  if (err?.type === "entity.too.large") {
    return res.status(413).json({
      ok: false,
      message: "Payload demasiado grande. Intenta con una imagen mas liviana.",
    });
  }
  next(err);
});

const PORT = Number(process.env.PORT) || 3001;
const HOST = "0.0.0.0";
app.listen(PORT, HOST, () => {
  console.log(`🚀 API corriendo en puerto ${PORT}`);
});
