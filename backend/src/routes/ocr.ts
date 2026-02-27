import { Router } from "express";

const router = Router();

const endpoint = (process.env.AZURE_DOC_INTELLIGENCE_ENDPOINT ?? "").trim();
const apiKey = (process.env.AZURE_DOC_INTELLIGENCE_KEY ?? "").trim();
const apiVersion = (process.env.AZURE_DOC_INTELLIGENCE_API_VERSION ?? "2024-11-30").trim();
const modelId = (process.env.AZURE_DOC_INTELLIGENCE_MODEL ?? "prebuilt-read").trim();

type AnalyzeResult = {
  status?: string;
  analyzeResult?: {
    content?: string;
    pages?: Array<{
      lines?: Array<{
        content?: string;
      }>;
    }>;
  };
};

const buildAnalyzeUrl = () => {
  const normalizedEndpoint = endpoint.replace(/\/+$/, "");
  return `${normalizedEndpoint}/documentintelligence/documentModels/${encodeURIComponent(modelId)}:analyze?api-version=${encodeURIComponent(apiVersion)}`;
};

const extractBarcodeCandidates = (lines: string[]) => {
  const counts = new Map<string, number>();

  for (const line of lines) {
    const matches = line.match(/\b\d{8,14}\b/g) ?? [];
    for (const code of matches) {
      counts.set(code, (counts.get(code) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([code, count]) => ({ code, count }));
};

const pollAnalyzeResult = async (operationLocation: string) => {
  for (let attempt = 0; attempt < 15; attempt += 1) {
    const response = await fetch(operationLocation, {
      headers: {
        "Ocp-Apim-Subscription-Key": apiKey,
      },
    });

    const data = (await response.json()) as AnalyzeResult & { error?: { message?: string } };

    if (!response.ok) {
      throw new Error(data.error?.message ?? "Error consultando resultado OCR");
    }

    const status = String(data.status ?? "").toLowerCase();
    if (status === "succeeded") {
      return data;
    }

    if (status === "failed") {
      throw new Error("Azure OCR no pudo procesar la imagen");
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  throw new Error("Azure OCR excedio el tiempo de espera");
};

router.post("/read", async (req, res) => {
  const imageBase64 = String(req.body?.imageBase64 ?? "").trim();

  if (!endpoint || !apiKey) {
    return res.status(500).json({
      ok: false,
      message: "Azure OCR no esta configurado en el servidor",
    });
  }

  if (!imageBase64) {
    return res.status(400).json({
      ok: false,
      message: "Debes enviar imageBase64",
    });
  }

  try {
    const analyzeResponse = await fetch(buildAnalyzeUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Ocp-Apim-Subscription-Key": apiKey,
      },
      body: JSON.stringify({
        base64Source: imageBase64,
      }),
    });

    if (!analyzeResponse.ok) {
      const errorPayload = (await analyzeResponse.json().catch(() => null)) as
        | { error?: { message?: string } }
        | null;
      return res.status(502).json({
        ok: false,
        message:
          errorPayload?.error?.message ?? "Azure OCR rechazo la solicitud",
      });
    }

    const operationLocation = analyzeResponse.headers.get("operation-location");
    if (!operationLocation) {
      return res.status(502).json({
        ok: false,
        message: "Azure OCR no devolvio operation-location",
      });
    }

    const result = await pollAnalyzeResult(operationLocation);
    const lines = (result.analyzeResult?.pages ?? [])
      .flatMap(page => page.lines ?? [])
      .map(line => String(line.content ?? "").trim())
      .filter(Boolean);

    const content = String(result.analyzeResult?.content ?? "").trim();
    const barcodeCandidates = extractBarcodeCandidates(lines);

    return res.json({
      ok: true,
      data: {
        content,
        lines,
        barcodeCandidates,
      },
    });
  } catch (error) {
    console.error("Error ejecutando Azure OCR:", error);
    return res.status(500).json({
      ok: false,
      message: error instanceof Error ? error.message : "Error ejecutando Azure OCR",
    });
  }
});

export default router;
