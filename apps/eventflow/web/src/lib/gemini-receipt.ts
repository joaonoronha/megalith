import { db } from "@/db/client";
import { inventoryItems, storageLocations } from "@/db/schema";
import { isNull } from "drizzle-orm";
import { generateId, generateReferenceCode } from "@/lib/id";

export interface ExtractedReceiptLine {
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  skuOrCode?: string;
  suggestedCategory?: string;
  dimensions?: string;
}

export interface ExtractedReceipt {
  merchantName: string;
  merchantNif?: string;
  invoiceNumber?: string;
  date?: string; // YYYY-MM-DD
  currency: string;
  subtotal?: number;
  taxAmount?: number;
  totalAmount: number;
  items: ExtractedReceiptLine[];
}

export interface ReconciledReceiptItem {
  id: string; // temporary client key
  rawDescription: string;
  name: string;
  action: "add_to_existing" | "create_new" | "ignore";
  matchedItemId?: string;
  matchedItemName?: string;
  matchedItemSku?: string;
  currentStock?: number;
  sku: string;
  category: string;
  quantityToAdd: number;
  unitPurchasePrice: number;
  unitRentalPrice: number;
  locationId?: string;
  dimensions?: string;
  confidence: number;
}

export interface ParseReceiptResult {
  receipt: ExtractedReceipt;
  items: ReconciledReceiptItem[];
}

function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Computes token-based Jaccard similarity between two strings (0.0 to 1.0)
 */
function calculateSimilarity(strA: string, strB: string): number {
  const normA = normalizeString(strA);
  const normB = normalizeString(strB);

  if (normA === normB) return 1.0;
  if (normA.includes(normB) || normB.includes(normA)) {
    const minLen = Math.min(normA.length, normB.length);
    const maxLen = Math.max(normA.length, normB.length);
    if (minLen / maxLen > 0.6) return 0.85;
  }

  const tokensA = new Set(normA.split(" ").filter((t) => t.length > 2));
  const tokensB = new Set(normB.split(" ").filter((t) => t.length > 2));

  if (tokensA.size === 0 || tokensB.size === 0) return 0.0;

  let intersection = 0;
  tokensA.forEach((token) => {
    if (tokensB.has(token)) intersection++;
  });

  const union = new Set([...tokensA, ...tokensB]).size;
  return union === 0 ? 0.0 : intersection / union;
}

/**
 * Standardizes category into one of CFM Events standard categories
 */
function mapToEventCategory(rawCategory?: string, description?: string): string {
  const text = `${rawCategory || ""} ${description || ""}`.toLowerCase();

  if (text.includes("cadeira") || text.includes("mesa") || text.includes("sofa") || text.includes("banco") || text.includes("lounge") || text.includes("furniture") || text.includes("mobiliario")) {
    return "Mobiliário";
  }
  if (text.includes("toalha") || text.includes("guardanapo") || text.includes("almofada") || text.includes("cortina") || text.includes("tecido") || text.includes("textil")) {
    return "Têxteis";
  }
  if (text.includes("luz") || text.includes("lampada") || text.includes("foco") || text.includes("led") || text.includes("guirlanda") || text.includes("iluminacao") || text.includes("lighting")) {
    return "Iluminação";
  }
  if (text.includes("prato") || text.includes("copo") || text.includes("taca") || text.includes("talher") || text.includes("bandeja") || text.includes("catering") || text.includes("loica")) {
    return "Loiça & Catering";
  }
  if (text.includes("som") || text.includes("coluna") || text.includes("micro") || text.includes("cabo") || text.includes("audio") || text.includes("video") || text.includes("ecra") || text.includes("av")) {
    return "Som & AV";
  }
  if (text.includes("jarra") || text.includes("vela") || text.includes("espelho") || text.includes("flor") || text.includes("placa") || text.includes("decoracao")) {
    return "Decoração";
  }

  return "Decoração";
}

/**
 * Calls Gemini multimodal API to extract structured invoice/receipt data
 */
export async function parseReceiptWithGemini(input: {
  buffer?: Buffer;
  mimeType?: string;
  textContent?: string;
}): Promise<ExtractedReceipt> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY não configurada no ambiente. Configure a chave nas variáveis de ambiente.");
  }

  const systemInstruction = `És um assistente especializado em processamento e reconciliação de faturas, recibos e guias de compra de materiais para uma empresa de produção e decoração de eventos (CFM Events).
Analisa o documento fornecido (imagem, PDF ou texto) e extrai com rigor:
1. Nome do fornecedor / comerciante (merchantName)
2. NIF / Número fiscal (merchantNif), se visível
3. Número do documento / fatura / recibo (invoiceNumber)
4. Data do documento em formato YYYY-MM-DD (date)
5. Moeda (EUR)
6. Subtotal, valor de IVA (taxAmount) e Total da fatura (totalAmount)
7. Lista de itens comprados (items):
   - description: Descrição clara do artigo (em português)
   - quantity: Quantidade numérica (mínimo 1)
   - unitPrice: Preço unitário sem IVA ou valor total a dividir pela quantidade
   - totalPrice: Valor total da linha
   - skuOrCode: Código de artigo, referência ou código de barras se presente
   - suggestedCategory: Categoria sugerida (ex: Mobiliário, Decoração, Iluminação, Têxteis, Loiça & Catering, Som & AV)
   - dimensions: Dimensões se indicadas na fatura

Ignora taxas puras de portes ou arredondamentos como itens de stock se não forem materiais físicos. Se houver portes, podes omitir dos artigos de stock.
Responde estritamente em formato JSON válido conforme o esquema.`;

  const contents: any[] = [];
  const parts: any[] = [];

  if (input.buffer && input.mimeType) {
    parts.push({
      inlineData: {
        mimeType: input.mimeType,
        data: input.buffer.toString("base64"),
      },
    });
  }

  const promptText = input.textContent
    ? `Texto da fatura/recibo:\n\n${input.textContent}\n\nExtrai todos os dados da fatura e os artigos listados:`
    : `Analisa este documento e extrai todos os dados da fatura e os respetivos artigos de material:`;

  parts.push({ text: promptText });
  contents.push({ parts });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  const responseSchema = {
    type: "OBJECT",
    properties: {
      merchantName: { type: "STRING" },
      merchantNif: { type: "STRING" },
      invoiceNumber: { type: "STRING" },
      date: { type: "STRING" },
      currency: { type: "STRING" },
      subtotal: { type: "NUMBER" },
      taxAmount: { type: "NUMBER" },
      totalAmount: { type: "NUMBER" },
      items: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            description: { type: "STRING" },
            quantity: { type: "NUMBER" },
            unitPrice: { type: "NUMBER" },
            totalPrice: { type: "NUMBER" },
            skuOrCode: { type: "STRING" },
            suggestedCategory: { type: "STRING" },
            dimensions: { type: "STRING" },
          },
          required: ["description", "quantity", "unitPrice", "totalPrice"],
        },
      },
    },
    required: ["merchantName", "totalAmount", "items"],
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents,
      systemInstruction: { parts: [{ text: systemInstruction }] },
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema,
        temperature: 0.1,
      },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("Gemini receipt extraction failed:", response.status, errorBody);
    throw new Error(`Falha na extração com Gemini (HTTP ${response.status}): ${errorBody}`);
  }

  const jsonResponse = await response.json();
  const rawText = jsonResponse.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!rawText) {
    throw new Error("O Gemini não retornou nenhum conteúdo válido para a fatura.");
  }

  const parsed: ExtractedReceipt = JSON.parse(rawText);

  // Safety sanitization
  if (!parsed.currency) parsed.currency = "EUR";
  if (!parsed.items || !Array.isArray(parsed.items)) parsed.items = [];

  parsed.items = parsed.items.map((it) => ({
    description: it.description || "Artigo sem descrição",
    quantity: Math.max(1, Math.round(Number(it.quantity) || 1)),
    unitPrice: Math.max(0, Number(it.unitPrice) || 0),
    totalPrice: Math.max(0, Number(it.totalPrice) || 0),
    skuOrCode: it.skuOrCode || undefined,
    suggestedCategory: it.suggestedCategory || undefined,
    dimensions: it.dimensions || undefined,
  }));

  return parsed;
}

/**
 * Reconciles extracted receipt items with existing inventory in the database.
 * Identifies duplicate/existing items and suggests new item templates.
 */
export async function reconcileReceiptWithInventory(
  receipt: ExtractedReceipt
): Promise<ParseReceiptResult> {
  const [existingItems, locations] = await Promise.all([
    db.query.inventoryItems.findMany({
      where: isNull(inventoryItems.deletedAt),
    }),
    db.query.storageLocations.findMany(),
  ]);

  const defaultLocationId = locations[0]?.id || undefined;

  const reconciledItems: ReconciledReceiptItem[] = receipt.items.map((rawItem, idx) => {
    let bestMatch: (typeof existingItems)[0] | null = null;
    let highestScore = 0;

    // 1. Direct SKU match if code provided on invoice
    if (rawItem.skuOrCode) {
      const cleanCode = rawItem.skuOrCode.trim().toUpperCase();
      const skuMatch = existingItems.find(
        (ex) => ex.sku.toUpperCase() === cleanCode
      );
      if (skuMatch) {
        bestMatch = skuMatch;
        highestScore = 1.0;
      }
    }

    // 2. Fuzzy name matching
    if (!bestMatch) {
      for (const item of existingItems) {
        const score = calculateSimilarity(rawItem.description, item.name);
        if (score > highestScore) {
          highestScore = score;
          bestMatch = item;
        }
      }
    }

    const matched = highestScore >= 0.55 && bestMatch !== null ? bestMatch : null;
    const isMatch = matched !== null;
    const category = matched
      ? matched.category
      : mapToEventCategory(rawItem.suggestedCategory, rawItem.description);

    // Calculate proposed rental price (unitPrice in inventory is the rental price per event)
    let unitRentalPrice = 0;
    if (matched && matched.unitPrice > 0) {
      unitRentalPrice = matched.unitPrice;
    } else {
      // Default rule of thumb in event rentals: rental price is ~20%-35% of acquisition cost
      unitRentalPrice = Math.max(1, Math.round(rawItem.unitPrice * 0.25 * 10) / 10);
    }

    // Auto-generate clean SKU for new items
    const skuPrefix = category.slice(0, 3).toUpperCase().replace(/[^A-Z]/g, "ART");
    const generatedSku = matched
      ? matched.sku
      : `${skuPrefix}-${generateReferenceCode("ITM")}`;

    return {
      id: `rcpt-item-${idx}-${Date.now()}`,
      rawDescription: rawItem.description,
      name: matched ? matched.name : rawItem.description,
      action: isMatch ? "add_to_existing" : "create_new",
      matchedItemId: matched ? matched.id : undefined,
      matchedItemName: matched ? matched.name : undefined,
      matchedItemSku: matched ? matched.sku : undefined,
      currentStock: matched ? matched.totalQuantity : undefined,
      sku: generatedSku,
      category,
      quantityToAdd: rawItem.quantity,
      unitPurchasePrice: rawItem.unitPrice,
      unitRentalPrice,
      locationId: matched ? (matched.locationId || defaultLocationId) : defaultLocationId,
      dimensions: rawItem.dimensions || (matched ? matched.dimensions || undefined : undefined),
      confidence: Math.round(highestScore * 100),
    };
  });

  return {
    receipt,
    items: reconciledItems,
  };
}
