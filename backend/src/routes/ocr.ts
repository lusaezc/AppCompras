import { Router } from "express";

const router = Router();

const endpoint = (process.env.AZURE_DOC_INTELLIGENCE_ENDPOINT ?? "").trim();
const apiKey = (process.env.AZURE_DOC_INTELLIGENCE_KEY ?? "").trim();
const modelId = (
  process.env.AZURE_DOC_INTELLIGENCE_MODEL ?? "prebuilt-receipt"
).trim();

const parseDigitSetting = (rawValue: string | undefined, fallback: number) => {
  const parsed = Number(rawValue);
  if (!Number.isInteger(parsed)) {
    return fallback;
  }
  return Math.max(1, Math.min(32, parsed));
};

const barcodeMinDigits = parseDigitSetting(process.env.AZURE_OCR_MIN_DIGITS, 7);
const barcodeMaxDigits = Math.max(
  barcodeMinDigits,
  parseDigitSetting(process.env.AZURE_OCR_MAX_DIGITS, 14),
);
const barcodePattern = new RegExp(
  `\\b\\d{${barcodeMinDigits},${barcodeMaxDigits}}\\b`,
  "g",
);

type AnalyzeDocumentResult = {
  content?: string;
  pages?: Array<{
    lines?: Array<{
      content?: string;
    }>;
  }>;
  documents?: ReceiptDocument[];
};

type ReceiptDocument = {
  docType?: string;
  confidence?: number;
  fields?: Record<string, DocumentField>;
};

type DocumentCurrency = {
  amount?: number;
  currencyCode?: string;
  symbol?: string;
  currencySymbol?: string;
};

type DocumentField = {
  type?: string;
  content?: string;
  confidence?: number;
  valueString?: string;
  valueDate?: string;
  valueNumber?: number;
  valueCurrency?: DocumentCurrency;
  valueArray?: DocumentField[];
  valueObject?: Record<string, DocumentField>;
};

type AnalyzePoller = {
  pollUntilDone: () => Promise<{
    body?: {
      analyzeResult?: AnalyzeDocumentResult;
    };
  }>;
};

type AzureOcrClient = {
  path: (
    pathTemplate: "/documentModels/{modelId}:analyze",
    model: string,
  ) => {
    post: (request: {
      contentType: "application/json";
      body: {
        base64Source: string;
      };
    }) => Promise<unknown>;
  };
};

const createAzureOcrClient = (): AzureOcrClient => {
  try {
    const DocumentIntelligence = require("@azure-rest/ai-document-intelligence")
      .default as (
      endpointUrl: string,
      options: { key: string },
    ) => AzureOcrClient;
    const { getLongRunningPoller, isUnexpected } =
      require("@azure-rest/ai-document-intelligence") as {
        getLongRunningPoller: (
          client: AzureOcrClient,
          response: unknown,
        ) => AnalyzePoller;
        isUnexpected: (response: unknown) => boolean;
      };

    const client = DocumentIntelligence(endpoint, { key: apiKey });

    return Object.assign(client, {
      getLongRunningPoller,
      isUnexpected,
    }) as AzureOcrClient & {
      getLongRunningPoller: (
        client: AzureOcrClient,
        response: unknown,
      ) => AnalyzePoller;
      isUnexpected: (response: unknown) => boolean;
    };
  } catch (error) {
    console.error("Error cargando SDK de Azure OCR:", error);
    throw new Error(
      "Falta instalar el SDK oficial de Azure OCR (@azure-rest/ai-document-intelligence) en backend",
    );
  }
};

const extractBarcodeCandidates = (lines: string[]) => {
  const counts = new Map<string, number>();

  for (const line of lines) {
    const matches = line.match(barcodePattern) ?? [];
    for (const code of matches) {
      counts.set(code, (counts.get(code) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([code, count]) => ({ code, count }));
};

type FallbackReceiptItem = {
  code: string | null;
  name: string;
  quantity: number | null;
  price: null;
  totalPrice: {
    amount: number;
    currencyCode: null;
    symbol: string | null;
    confidence: null;
  } | null;
};

const parseAmountFromLine = (line: string) => {
  const match = line.match(
    /([$€£])?\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})|\d+)/,
  );
  if (!match) {
    return null;
  }

  const symbol = String(match[1] ?? "").trim() || null;
  const raw = String(match[2] ?? "").trim();
  const normalized =
    raw.includes(",") && raw.includes(".")
      ? raw.replace(/\./g, "").replace(",", ".")
      : raw.includes(",")
        ? raw.replace(",", ".")
        : raw;
  const amount = Number(normalized);

  if (!Number.isFinite(amount)) {
    return null;
  }

  return {
    amount,
    currencyCode: null,
    symbol,
    confidence: null,
  };
};

const buildReceiptItemsFromLines = (lines: string[]): FallbackReceiptItem[] => {
  const reCodeAndText = /^(\d{4,14})\s+(.+)$/;
  const reOnlyCode = /^\d{4,14}$/;
  const rePrice = /^([$€£])?\s*\d/;
  const reDiscount = /^Club\s+Unimarc\b/i;
  const reQty = /(×|x\s*\d+|\bc\/u\b|\bKG\b|\bKGV\b|\bUN\b)/i;
  const reCutSection =
    /^(TOTAL|Desglose del Total:|Neto|IVA|DETALLE DE PAGOS|TARJETA|TOTAL PAGOS|CODIGO|DESC\.ARTICULO|VALOR|CANT\.)/i;

  const items: FallbackReceiptItem[] = [];
  let current: FallbackReceiptItem | null = null;

  const flush = () => {
    if (!current) {
      return;
    }

    current.name = current.name.replace(/\s+/g, " ").trim();
    if (current.name) {
      items.push(current);
    }
    current = null;
  };

  for (const raw of lines) {
    const line = String(raw ?? "").trim();
    if (!line) {
      continue;
    }

    if (reCutSection.test(line)) {
      flush();
      break;
    }

    if (reDiscount.test(line)) {
      continue;
    }

    if (rePrice.test(line)) {
      if (current && !current.totalPrice) {
        current.totalPrice = parseAmountFromLine(line);
      }
      flush();
      continue;
    }

    if (reQty.test(line)) {
      continue;
    }

    const matchCodeAndText = line.match(reCodeAndText);
    if (matchCodeAndText) {
      flush();
      current = {
        code: String(matchCodeAndText[1] ?? "").trim() || null,
        name: String(matchCodeAndText[2] ?? "").trim(),
        quantity: null,
        price: null,
        totalPrice: null,
      };
      continue;
    }

    if (reOnlyCode.test(line)) {
      flush();
      current = {
        code: line,
        name: "",
        quantity: null,
        price: null,
        totalPrice: null,
      };
      continue;
    }

    if (!current) {
      current = {
        code: null,
        name: line,
        quantity: null,
        price: null,
        totalPrice: null,
      };
      continue;
    }

    current.name = current.name ? `${current.name} ${line}` : line;
  }

  flush();
  return items;
};

const getFieldText = (field?: DocumentField) =>
  String(field?.valueString ?? field?.content ?? "").trim();

const getFieldNumber = (field?: DocumentField) =>
  typeof field?.valueNumber === "number" ? field.valueNumber : null;

const getFieldCurrency = (field?: DocumentField) => {
  const currency = field?.valueCurrency;
  const amount = currency?.amount;
  if (typeof amount !== "number") {
    return null;
  }

  return {
    amount,
    currencyCode: String(currency?.currencyCode ?? "").trim() || null,
    symbol:
      String(currency?.symbol ?? currency?.currencySymbol ?? "").trim() || null,
    confidence: field?.confidence ?? null,
  };
};

const getObjectField = (
  source: Record<string, DocumentField>,
  keys: string[],
) => {
  for (const key of keys) {
    const field = source[key];
    if (field) {
      return field;
    }
  }

  return undefined;
};

const mapReceiptItem = (field: DocumentField) => {
  const item = field.valueObject ?? {};
  const codeField = getObjectField(item, ["ProductCode", "Code", "Barcode"]);
  const descriptionField = getObjectField(item, [
    "Description",
    "Name",
    "ItemName",
    "ProductName",
  ]);
  const quantityField = getObjectField(item, ["Quantity", "Count"]);
  const priceField = getObjectField(item, ["Price", "UnitPrice"]);
  const totalPriceField = getObjectField(item, ["TotalPrice", "Amount"]);
  const fallbackName = String(field.content ?? "")
    .replace(/\s+/g, " ")
    .trim();

  return {
    code: getFieldText(codeField) || null,
    description: getFieldText(descriptionField) || fallbackName || null,
    descriptionConfidence: descriptionField?.confidence ?? null,
    quantity: getFieldNumber(quantityField),
    quantityConfidence: quantityField?.confidence ?? null,
    price: getFieldCurrency(priceField),
    totalPrice: getFieldCurrency(totalPriceField),
  };
};

const mapReceiptDocument = (receipt: ReceiptDocument) => {
  const fields = receipt.fields ?? {};
  const itemsField = fields.Items;
  const items = Array.isArray(itemsField?.valueArray)
    ? itemsField.valueArray.map(mapReceiptItem)
    : [];

  return {
    receiptType: String(receipt.docType ?? "").trim() || null,
    confidence: receipt.confidence ?? null,
    merchantName: {
      value: getFieldText(fields.MerchantName) || null,
      confidence: fields.MerchantName?.confidence ?? null,
    },
    transactionDate: {
      value: String(fields.TransactionDate?.valueDate ?? "").trim() || null,
      confidence: fields.TransactionDate?.confidence ?? null,
    },
    items,
    subtotal: getFieldCurrency(fields.Subtotal),
    tax: getFieldCurrency(fields.TotalTax),
    tip: getFieldCurrency(fields.Tip),
    total: getFieldCurrency(fields.Total),
  };
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
    const client = createAzureOcrClient() as AzureOcrClient & {
      getLongRunningPoller: (
        sdkClient: AzureOcrClient,
        response: unknown,
      ) => AnalyzePoller;
      isUnexpected: (response: unknown) => boolean;
    };

    if (!Buffer.from(imageBase64, "base64").length) {
      return res.status(400).json({
        ok: false,
        message: "La imagen base64 no es valida",
      });
    }

    const initialResponse = await client
      .path("/documentModels/{modelId}:analyze", modelId)
      .post({
        contentType: "application/json",
        body: {
          base64Source: imageBase64,
        },
      });

    if (client.isUnexpected(initialResponse)) {
      throw new Error("Azure OCR rechazo la solicitud");
    }

    const poller = client.getLongRunningPoller(client, initialResponse);
    const finalResponse = await poller.pollUntilDone();
    const result = finalResponse.body?.analyzeResult;

    if (!result) {
      return res.status(502).json({
        ok: false,
        message: "Azure OCR no devolvio resultados",
      });
    }

    const lines = (result.pages ?? [])
      .flatMap((page) => page.lines ?? [])
      .map((line) => String(line.content ?? "").trim())
      .filter(Boolean);

    const content = String(result.content ?? "").trim();
    const barcodeCandidates = extractBarcodeCandidates(lines);
    const receipts = Array.isArray(result.documents)
      ? result.documents.map(mapReceiptDocument)
      : [];
    const receiptItems = receipts.flatMap((receipt) =>
      receipt.items
        .filter(
          (item) =>
            Boolean(item.description) ||
            item.quantity !== null ||
            item.price !== null ||
            item.totalPrice !== null,
        )
        .map((item) => ({
          code: item.code ?? null,
          name: item.description,
          quantity: item.quantity,
          price: item.price,
          totalPrice: item.totalPrice,
        })),
    );
    const fallbackReceiptItems =
      receiptItems.length > 0 ? [] : buildReceiptItemsFromLines(lines);

    return res.json({
      ok: true,
      data: {
        content,
        lines,
        barcodeCandidates,
        receipts,
        receiptItems:
          receiptItems.length > 0 ? receiptItems : fallbackReceiptItems,
      },
    });
  } catch (error) {
    console.error("Error ejecutando Azure OCR:", error);
    return res.status(500).json({
      ok: false,
      message:
        error instanceof Error ? error.message : "Error ejecutando Azure OCR",
    });
  }
});

export default router;
