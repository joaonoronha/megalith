import { db } from "./client";
import {
  users,
  clients,
  inventoryItems,
  events,
  eventAllocations,
  quotes,
  quoteLines,
  financialMovements,
  quoteTemplates,
} from "./schema";

export async function seed() {
  console.log("🌱 Seeding EventFlow database from V23 prototype data...");

  // 1. Template
  await db.insert(quoteTemplates).values({
    id: "tpl-default",
    companyName: "CFM EVENTOS",
    tagline: "Produção & Decoração de Eventos",
    contactInfo: "geral@cfmeventos.pt · +351 912 345 678",
    paymentTerms: "50% adjudicação · 50% desmontagem",
    footerNotes: "Obrigado pela preferência e confiança na CFM Eventos.",
    brandColor: "#111111",
  }).onConflictDoNothing();

  // 2. Admin User
  await db.insert(users).values({
    id: "usr-admin-1",
    name: "Administrador CFM",
    email: "admin@cfmeventos.pt",
    passwordHash: "$2b$10$gecd5wrGUNDqja3JnT6zDuF3d3HpjXfTS1H91s7iIVesuM3/WzDAG",
    role: "admin",
    createdAt: new Date(),
  }).onConflictDoUpdate({
    target: users.id,
    set: {
      passwordHash: "$2b$10$gecd5wrGUNDqja3JnT6zDuF3d3HpjXfTS1H91s7iIVesuM3/WzDAG",
      email: "admin@cfmeventos.pt",
      role: "admin",
    },
  });

  // 3. Clients
  const clientMastercard = {
    id: "cli-mastercard",
    name: "Mastercard Portugal",
    contactName: "João Silva",
    email: "joao@mastercard.pt",
    phone: "+351 910 111 222",
    nif: "501234567",
    notes: "Cliente corporate recorrente. Eventos anuais e galas de prémios.",
    source: "manual",
    createdAt: new Date("2026-01-15"),
  };

  const clientMarta = {
    id: "cli-marta",
    name: "Marta Almeida",
    contactName: "Marta Almeida",
    email: "marta.almeida@gmail.com",
    phone: "+351 960 333 444",
    notes: "Casamento particular Quinta da Serra.",
    source: "calendly",
    createdAt: new Date("2026-03-10"),
  };

  const clientLoreal = {
    id: "cli-loreal",
    name: "L'Oréal Portugal",
    contactName: "Ana Costa",
    email: "ana.costa@loreal.com",
    phone: "+351 930 555 666",
    nif: "508765432",
    notes: "Lançamento de produto e jantares de marca.",
    source: "manual",
    createdAt: new Date("2026-05-20"),
  };

  await db.insert(clients).values([clientMastercard, clientMarta, clientLoreal]).onConflictDoNothing();

  // 4. Inventory
  const chairItem = {
    id: "itm-chair",
    sku: "MOB-CHA-001",
    name: "Cadeira Chiavari Dourada",
    category: "Mobiliário / Cadeiras",
    totalQuantity: 60,
    minStock: 15,
    warehouseLocation: "Armazém A · B3 · P2",
    dimensions: "40 × 45 × 92 cm",
    unitPrice: 6.0,
    replacementCost: 45.0,
    imageUrl: "https://images.unsplash.com/photo-1549497538-303791108f95?auto=format&fit=crop&w=400&q=80",
  };

  const candleItem = {
    id: "itm-candle",
    sku: "DEC-VEL-014",
    name: "Vela LED Âmbar",
    category: "Decoração / Iluminação",
    totalQuantity: 80,
    minStock: 20,
    warehouseLocation: "Armazém A · C1 · P4",
    dimensions: "8 × 15 cm",
    unitPrice: 2.5,
    replacementCost: 8.0,
    imageUrl: "https://images.unsplash.com/photo-1572883454114-1cf0031ede2a?auto=format&fit=crop&w=400&q=80",
  };

  const tableItem = {
    id: "itm-table",
    sku: "MOB-MES-008",
    name: "Mesa Redonda 180",
    category: "Mobiliário / Mesas",
    totalQuantity: 30,
    minStock: 5,
    warehouseLocation: "Armazém B · A2 · P1",
    dimensions: "180 × 75 cm",
    unitPrice: 25.0,
    replacementCost: 180.0,
    imageUrl: "https://images.unsplash.com/photo-1530629013299-6cb10d168419?auto=format&fit=crop&w=400&q=80",
  };

  const glassItem = {
    id: "itm-glass",
    sku: "DEC-COP-021",
    name: "Copo Martini",
    category: "Copos / Vidro",
    totalQuantity: 120,
    minStock: 30,
    warehouseLocation: "Armazém A · D1 · P3",
    dimensions: "12 × 18 cm",
    unitPrice: 1.2,
    replacementCost: 4.5,
    imageUrl: "https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=400&q=80",
  };

  await db.insert(inventoryItems).values([chairItem, candleItem, tableItem, glassItem]).onConflictDoNothing();

  // 5. Events
  const now = new Date();
  const eventGala = {
    id: "evt-gala",
    name: "Mastercard Gala",
    clientId: clientMastercard.id,
    venue: "Estufa Fria, Lisboa",
    startDate: new Date("2026-10-06T18:00:00Z"),
    endDate: new Date("2026-10-06T23:59:00Z"),
    prepDate: new Date("2026-10-05T09:00:00Z"),
    returnDate: new Date("2026-10-07T12:00:00Z"),
    status: "preparacao" as const,
    totalBudget: 2730.60,
    coverImageUrl: "https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?auto=format&fit=crop&w=600&q=80",
    notes: "Gala anual corporate. Montagem técnica e decoração floral.",
    createdAt: now,
  };

  const eventWedding = {
    id: "evt-wedding",
    name: "Casamento Marta & João",
    clientId: clientMarta.id,
    venue: "Quinta da Serra",
    startDate: new Date("2026-10-03T14:00:00Z"),
    endDate: new Date("2026-10-04T04:00:00Z"),
    prepDate: new Date("2026-10-02T10:00:00Z"),
    returnDate: new Date("2026-10-04T16:00:00Z"),
    status: "confirmado" as const,
    totalBudget: 7950.00,
    coverImageUrl: "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=600&q=80",
    notes: "Cerimónia exterior e banquete na sala principal.",
    createdAt: now,
  };

  const eventLoreal = {
    id: "evt-loreal",
    name: "L'Oréal Brand Dinner",
    clientId: clientLoreal.id,
    venue: "Palácio do Grilo, Lisboa",
    startDate: new Date("2026-10-09T19:30:00Z"),
    endDate: new Date("2026-10-09T23:30:00Z"),
    status: "planeamento" as const,
    totalBudget: 3400.00,
    coverImageUrl: "https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&w=600&q=80",
    notes: "Jantar de imprensa e influenciadores.",
    createdAt: now,
  };

  await db.insert(events).values([eventGala, eventWedding, eventLoreal]).onConflictDoNothing();

  // 6. Allocations (Mastercard Gala)
  await db.insert(eventAllocations).values([
    { id: "alc-1", eventId: eventGala.id, itemId: chairItem.id, quantity: 18, status: "reservado" },
    { id: "alc-2", eventId: eventGala.id, itemId: candleItem.id, quantity: 72, status: "reservado" },
    { id: "alc-3", eventId: eventGala.id, itemId: tableItem.id, quantity: 8, status: "reservado" },
  ]).onConflictDoNothing();

  // 7. Quote (#ORC-2026-104)
  const quote104 = {
    id: "qte-104",
    quoteNumber: "ORC-2026-104",
    eventId: eventGala.id,
    clientId: clientMastercard.id,
    accessToken: "orc-2026-104-demo-token",
    status: "enviado" as const,
    validityDays: 15,
    vatRate: 23.0,
    subtotal: 2220.00,
    vatAmount: 510.60,
    total: 2730.60,
    createdAt: new Date("2026-09-30"),
  };

  await db.insert(quotes).values(quote104).onConflictDoNothing();

  await db.insert(quoteLines).values([
    { id: "ql-1", quoteId: quote104.id, itemId: chairItem.id, description: "Cadeira Chiavari Dourada", quantity: 120, unitPrice: 6.00, total: 720.00 },
    { id: "ql-2", quoteId: quote104.id, itemId: tableItem.id, description: "Mesa Redonda 180", quantity: 12, unitPrice: 25.00, total: 300.00 },
    { id: "ql-3", quoteId: quote104.id, itemId: null, description: "Produção e montagem técnica", quantity: 1, unitPrice: 1200.00, total: 1200.00 },
  ]).onConflictDoNothing();

  // 8. Financial Movements
  await db.insert(financialMovements).values([
    { id: "mov-1", type: "entrada", category: "Evento", description: "Adiantamento 50% Mastercard Gala", amount: 1365.30, date: new Date("2026-10-01"), eventId: eventGala.id, clientId: clientMastercard.id },
    { id: "mov-2", type: "entrada", category: "Evento", description: "Liquidação Casamento Marta & João", amount: 7950.00, date: new Date("2026-10-03"), eventId: eventWedding.id, clientId: clientMarta.id },
    { id: "mov-3", type: "saida", category: "Transporte", description: "Carrinha de transporte e gasóleo", amount: 480.00, date: new Date("2026-10-04") },
    { id: "mov-4", type: "saida", category: "Fornecedor", description: "Equipa externa de som e luzes", amount: 3900.00, date: new Date("2026-10-05") },
    { id: "mov-5", type: "investimento", category: "Material / Stock", description: "Aquisição de 20x Cadeiras Chiavari", amount: 2150.00, date: new Date("2026-10-02") },
  ]).onConflictDoNothing();

  console.log("✅ Seeding completed successfully!");
}

if (import.meta.url.endsWith(process.argv[1])) {
  seed().then(() => process.exit(0)).catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  });
}
