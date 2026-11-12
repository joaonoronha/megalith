import { db } from "./client";
import { sql } from "drizzle-orm";
import {
  users,
  clients,
  inventoryItems,
  events,
  eventAllocations,
  eventTasks,
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
    passwordHash: "$2b$10$.Ip5sNNfFBhvE6w7pQ9W8u0nChg0z1BCZWuF8TxNqx9PJBOWfSzh2",
    role: "admin",
    createdAt: new Date(),
  }).onConflictDoUpdate({
    target: users.id,
    set: {
      passwordHash: "$2b$10$.Ip5sNNfFBhvE6w7pQ9W8u0nChg0z1BCZWuF8TxNqx9PJBOWfSzh2",
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
    notes: "Casamento particular e festas de família.",
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

  // Featured Winnie the Pooh Event
  const eventPooh = {
    id: "evt-pooh",
    name: "Aniversário Martim · Winnie the Pooh",
    clientId: clientMarta.id,
    venue: "Jardim das Amoreiras, Lisboa",
    startDate: new Date("2026-10-18T14:30:00Z"),
    endDate: new Date("2026-10-18T19:30:00Z"),
    prepDate: new Date("2026-10-18T10:00:00Z"),
    returnDate: new Date("2026-10-18T21:00:00Z"),
    status: "confirmado" as const,
    totalBudget: 1850.00,
    customerPrice: 3850.00,
    category: "Aniversário Infantil",
    theme: "Winnie the Pooh",
    vibeColors: JSON.stringify(["#F5A623", "#D32F2F", "#5C7658", "#FFF8DC"]),
    specialNeeds: "Alergias severas: sem frutos secos no catering. Mesa do bolo decorada com inspiração no Bosque dos Cem Acres com potes de mel cerâmicos. Ponto de energia 220V para a máquina de algodão doce e som.",
    coverImageUrl: "https://images.unsplash.com/photo-1530103862676-de8c9debad1d?auto=format&fit=crop&w=600&q=80",
    notes: "Festa de 4º aniversário do Martim. 40 convidados (25 adultos, 15 crianças).",
    createdAt: now,
  };

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
    customerPrice: 4950.00,
    category: "Gala Corporativa",
    theme: "Black & Gold Minimalist",
    vibeColors: JSON.stringify(["#111111", "#D4AF37", "#2C3E50", "#E0E0E0"]),
    specialNeeds: "Entrada VIP reservada pelo pórtico norte. Equipamento AV calibrado para transmissão ao vivo às 20h30.",
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
    customerPrice: 12500.00,
    category: "Casamento",
    theme: "Romântico Botânico & Terracotta",
    vibeColors: JSON.stringify(["#C97A63", "#E3C9B8", "#687B65", "#FAF6F0"]),
    specialNeeds: "Noiva com alergia a lírios. Zona lounge exterior coberta em caso de vento.",
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
    customerPrice: 6200.00,
    category: "Jantar de Marca",
    theme: "Rose Gold Glamour",
    vibeColors: JSON.stringify(["#B76E79", "#2E151B", "#E8D8D8", "#C0C0C0"]),
    specialNeeds: "Iluminação quente focada nos photowalls para criação de conteúdo dos influenciadores.",
    coverImageUrl: "https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&w=600&q=80",
    notes: "Jantar de imprensa e influenciadores.",
    createdAt: now,
  };

  await db.insert(events).values([eventPooh, eventGala, eventWedding, eventLoreal]).onConflictDoUpdate({
    target: events.id,
    set: {
      category: sql`excluded.category`,
      theme: sql`excluded.theme`,
      vibeColors: sql`excluded.vibe_colors`,
      customerPrice: sql`excluded.customer_price`,
      specialNeeds: sql`excluded.special_needs`,
    },
  });

  // 6. Allocations (Mastercard Gala & Winnie the Pooh)
  await db.insert(eventAllocations).values([
    { id: "alc-1", eventId: eventGala.id, itemId: chairItem.id, quantity: 18, status: "reservado" },
    { id: "alc-2", eventId: eventGala.id, itemId: candleItem.id, quantity: 72, status: "reservado" },
    { id: "alc-3", eventId: eventGala.id, itemId: tableItem.id, quantity: 8, status: "reservado" },
    { id: "alc-p1", eventId: eventPooh.id, itemId: chairItem.id, quantity: 30, status: "reservado", notes: "Cadeiras Chiavari para zona infantil" },
    { id: "alc-p2", eventId: eventPooh.id, itemId: tableItem.id, quantity: 4, status: "reservado", notes: "Mesas para banquete e mesa do bolo" },
    { id: "alc-p3", eventId: eventPooh.id, itemId: candleItem.id, quantity: 12, status: "reservado", notes: "Velas LED seguras para o fim de tarde" },
    { id: "alc-p4", eventId: eventPooh.id, itemId: glassItem.id, quantity: 40, status: "reservado", notes: "Copos para bar de sumos naturais" },
  ]).onConflictDoNothing();

  // 6.1 Action Items Checklist
  await db.insert(eventTasks).values([
    { id: "tsk-p1", eventId: eventPooh.id, title: "Aprovar maqueta e paleta de cores Winnie the Pooh com o cliente", completed: true, priority: "alta", orderIndex: 1 },
    { id: "tsk-p2", eventId: eventPooh.id, title: "Alocar 30x cadeiras, 4x mesas e toalhas no armazém", completed: true, priority: "alta", orderIndex: 2 },
    { id: "tsk-p3", eventId: eventPooh.id, title: "Confirmar ausência de frutos secos com serviço de catering", completed: true, priority: "urgente", orderIndex: 3 },
    { id: "tsk-p4", eventId: eventPooh.id, title: "Validar recebimento do sinal de 50% (€1.925,00)", completed: true, priority: "media", orderIndex: 4 },
    { id: "tsk-p5", eventId: eventPooh.id, title: "Montagem do arco de balões temático e potes de mel (10h00)", completed: false, priority: "alta", orderIndex: 5 },
    { id: "tsk-p6", eventId: eventPooh.id, title: "Chegada dos animadores e teste de som infantil (13h30)", completed: false, priority: "media", orderIndex: 6 },
    { id: "tsk-p7", eventId: eventPooh.id, title: "Desmontagem, contagem de inventário e liquidação dos 50% finais", completed: false, priority: "alta", orderIndex: 7 },
    { id: "tsk-w1", eventId: eventWedding.id, title: "Degustação de menu e alinhamento do cronograma com a quinta", completed: true, priority: "alta", orderIndex: 1 },
    { id: "tsk-w2", eventId: eventWedding.id, title: "Alocar 120x cadeiras e 12x mesas redondas", completed: true, priority: "alta", orderIndex: 2 },
    { id: "tsk-w3", eventId: eventWedding.id, title: "Briefing da equipa de montagem e transporte", completed: false, priority: "media", orderIndex: 3 },
    { id: "tsk-g1", eventId: eventGala.id, title: "Testes de projeção e áudio para a cerimónia", completed: true, priority: "urgente", orderIndex: 1 },
    { id: "tsk-g2", eventId: eventGala.id, title: "Check-in do staff técnico e hospedeiras", completed: false, priority: "alta", orderIndex: 2 },
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
