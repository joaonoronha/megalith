import { db } from "./client";
import { sql, eq } from "drizzle-orm";
import {
  users,
  clients,
  storageLocations,
  inventoryItems,
  events,
  eventAllocations,
  eventTasks,
  quotes,
  quoteLines,
  financialMovements,
  quoteTemplates,
  auditLogs,
  eventMedia,
} from "./schema";

export async function seed() {
  console.log("🌱 Seeding EventFlow database from V23 prototype data...");

  // 1. Template
  await db.insert(quoteTemplates).values({
    id: "tpl-default",
    companyName: "CFM EVENTS",
    tagline: "Produção & Decoração de Eventos",
    contactInfo: "geral@cfmeventos.pt · +351 912 345 678",
    paymentTerms: "50% adjudicação · 50% desmontagem",
    footerNotes: "Obrigado pela preferência e confiança na CFM Events.",
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

  // 3.1 Storage Locations & Managers
  await db.insert(storageLocations).values([
    {
      id: "loc-principal",
      name: "Armazém Principal",
      code: "ARM-PRIN",
      address: "Sede CFM · Lisboa",
      managerUserId: "usr-admin-1",
      managerName: "Administrador CFM",
      managerContact: "admin@cfmeventos.pt · +351 912 345 678",
      notes: "Armazém central de receção e expedição de artigos.",
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
    },
    {
      id: "loc-armazem-a",
      name: "Armazém A",
      code: "ARM-A",
      address: "Pólo Logístico Loures - Pavilhão A",
      managerUserId: null,
      managerName: "Madalena Rosa",
      managerContact: "madalenasrosa99@gmail.com · +351 960 123 456",
      notes: "Mobiliário pesado, cadeiras Chiavari e estruturas de grande porte.",
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
    },
    {
      id: "loc-armazem-b",
      name: "Armazém B",
      code: "ARM-B",
      address: "Pólo Logístico Loures - Pavilhão B",
      managerUserId: "usr-admin-1",
      managerName: "Administrador CFM",
      managerContact: "admin@cfmeventos.pt",
      notes: "Área climatizada para têxteis, toalhas de linho, iluminação decorativa e copos.",
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
    },
  ]).onConflictDoNothing();

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

  // Additional Multi-Month Events (August, September, November 2026) for MoM analytics
  const eventSunsetAug = {
    id: "evt-sunset-aug",
    name: "Sunset Corporate Lounge · NOS",
    clientId: clientMastercard.id,
    venue: "SUD Lisboa Terrazza",
    startDate: new Date("2026-08-14T17:00:00Z"),
    endDate: new Date("2026-08-14T23:00:00Z"),
    status: "concluido" as const,
    totalBudget: 2800.00,
    customerPrice: 5200.00,
    category: "Corporativo",
    theme: "Sunset Warm Glow",
    vibeColors: JSON.stringify(["#E65100", "#FFB74D", "#212121"]),
    notes: "Evento corporate com bar exterior e iluminação de velas.",
    createdAt: new Date("2026-08-01"),
  };

  const eventWeddingAug = {
    id: "evt-wedding-aug",
    name: "Casamento Inês & Pedro",
    clientId: clientMarta.id,
    venue: "Quinta do Casal Novo",
    startDate: new Date("2026-08-22T13:00:00Z"),
    endDate: new Date("2026-08-23T03:00:00Z"),
    status: "concluido" as const,
    totalBudget: 5100.00,
    customerPrice: 9400.00,
    category: "Casamento",
    theme: "Olive Green & Gold",
    vibeColors: JSON.stringify(["#556B2F", "#D4AF37", "#FFFFFF"]),
    notes: "Banquete para 90 pessoas.",
    createdAt: new Date("2026-08-05"),
  };

  const eventTechSep = {
    id: "evt-tech-sep",
    name: "Tech Summit Lisboa · VIP Lounge",
    clientId: clientMastercard.id,
    venue: "Altice Arena, Lisboa",
    startDate: new Date("2026-09-11T09:00:00Z"),
    endDate: new Date("2026-09-11T19:00:00Z"),
    status: "concluido" as const,
    totalBudget: 3500.00,
    customerPrice: 6800.00,
    category: "Corporativo",
    theme: "Modern Tech Slate",
    vibeColors: JSON.stringify(["#007AFF", "#1C1C1E", "#E5E5EA"]),
    notes: "Mobiliário e zona lounge para networking executivo.",
    createdAt: new Date("2026-09-01"),
  };

  const eventBatizadoSep = {
    id: "evt-batizado-sep",
    name: "Batizado Santiago",
    clientId: clientMarta.id,
    venue: "Palácio da Cruz Quebrada",
    startDate: new Date("2026-09-19T12:00:00Z"),
    endDate: new Date("2026-09-19T18:00:00Z"),
    status: "concluido" as const,
    totalBudget: 1700.00,
    customerPrice: 3400.00,
    category: "Batizado",
    theme: "Pure White & Linen",
    vibeColors: JSON.stringify(["#FFFFFF", "#EEDC82", "#A0C4DF"]),
    notes: "Almoço familiar e mesa de doces.",
    createdAt: new Date("2026-09-05"),
  };

  const eventColecaoSep = {
    id: "evt-colecao-sep",
    name: "Apresentação Coleção Outono",
    clientId: clientLoreal.id,
    venue: "Lx Factory, Lisboa",
    startDate: new Date("2026-09-27T16:00:00Z"),
    endDate: new Date("2026-09-27T22:00:00Z"),
    status: "concluido" as const,
    totalBudget: 2300.00,
    customerPrice: 4600.00,
    category: "Jantar de Marca",
    theme: "Autumn Glow",
    vibeColors: JSON.stringify(["#C0392B", "#D35400", "#F39C12"]),
    notes: "Lançamento sazonal para influenciadores.",
    createdAt: new Date("2026-09-12"),
  };

  const eventNovGala = {
    id: "evt-nov-gala",
    name: "Gala Inovação & Sustentabilidade 2026",
    clientId: clientMastercard.id,
    venue: "Pátio da Galé, Lisboa",
    startDate: new Date("2026-11-07T18:30:00Z"),
    endDate: new Date("2026-11-07T23:59:00Z"),
    status: "concluido" as const,
    totalBudget: 3900.00,
    customerPrice: 7800.00,
    category: "Gala Corporativa",
    theme: "Green & Silver Prestige",
    vibeColors: JSON.stringify(["#2E7D32", "#CFD8DC", "#1A237E"]),
    notes: "Cerimónia formal com jantar volante para 150 participantes.",
    createdAt: new Date("2026-10-25"),
  };

  const eventNovAniversario = {
    id: "evt-nov-aniv",
    name: "Aniversário 40 Anos Privado",
    clientId: clientMarta.id,
    venue: "Villa Tamariz, Cascais",
    startDate: new Date("2026-11-21T19:00:00Z"),
    endDate: new Date("2026-11-22T02:00:00Z"),
    status: "confirmado" as const,
    totalBudget: 2100.00,
    customerPrice: 4200.00,
    category: "Aniversário",
    theme: "Midnight Chic",
    vibeColors: JSON.stringify(["#0B0C10", "#1F2833", "#C5C6C7", "#66FCF1"]),
    notes: "Festa privada com pista de dança e lounge.",
    createdAt: new Date("2026-11-02"),
  };

  await db.insert(events).values([
    eventPooh,
    eventGala,
    eventWedding,
    eventLoreal,
    eventSunsetAug,
    eventWeddingAug,
    eventTechSep,
    eventBatizadoSep,
    eventColecaoSep,
    eventNovGala,
    eventNovAniversario,
  ]).onConflictDoUpdate({
    target: events.id,
    set: {
      category: sql`excluded.category`,
      theme: sql`excluded.theme`,
      vibeColors: sql`excluded.vibe_colors`,
      customerPrice: sql`excluded.customer_price`,
      specialNeeds: sql`excluded.special_needs`,
    },
  });

  // 6. Allocations (Mastercard Gala, Pooh, Wedding, Loreal & Multi-Month events)
  await db.insert(eventAllocations).values([
    // Gala
    { id: "alc-1", eventId: eventGala.id, itemId: chairItem.id, quantity: 18, status: "reservado" },
    { id: "alc-2", eventId: eventGala.id, itemId: candleItem.id, quantity: 72, status: "reservado" },
    { id: "alc-3", eventId: eventGala.id, itemId: tableItem.id, quantity: 8, status: "reservado" },
    // Pooh
    { id: "alc-p1", eventId: eventPooh.id, itemId: chairItem.id, quantity: 30, status: "reservado", notes: "Cadeiras Chiavari para zona infantil" },
    { id: "alc-p2", eventId: eventPooh.id, itemId: tableItem.id, quantity: 4, status: "reservado", notes: "Mesas para banquete e mesa do bolo" },
    { id: "alc-p3", eventId: eventPooh.id, itemId: candleItem.id, quantity: 12, status: "reservado", notes: "Velas LED seguras para o fim de tarde" },
    { id: "alc-p4", eventId: eventPooh.id, itemId: glassItem.id, quantity: 40, status: "reservado", notes: "Copos para bar de sumos naturais" },
    // Casamento Marta & João
    { id: "alc-w1", eventId: eventWedding.id, itemId: chairItem.id, quantity: 120, status: "reservado", notes: "Cadeiras para cerimónia e banquete" },
    { id: "alc-w2", eventId: eventWedding.id, itemId: tableItem.id, quantity: 12, status: "reservado", notes: "Mesas redondas para sala principal" },
    { id: "alc-w3", eventId: eventWedding.id, itemId: candleItem.id, quantity: 60, status: "reservado", notes: "Centros de mesa iluminados" },
    { id: "alc-w4", eventId: eventWedding.id, itemId: glassItem.id, quantity: 110, status: "reservado", notes: "Copos de boas-vindas e brinde" },
    // L'Oréal Dinner
    { id: "alc-l1", eventId: eventLoreal.id, itemId: chairItem.id, quantity: 24, status: "reservado" },
    { id: "alc-l2", eventId: eventLoreal.id, itemId: tableItem.id, quantity: 3, status: "reservado" },
    { id: "alc-l3", eventId: eventLoreal.id, itemId: candleItem.id, quantity: 35, status: "reservado" },
    { id: "alc-l4", eventId: eventLoreal.id, itemId: glassItem.id, quantity: 50, status: "reservado" },
    // August Events
    { id: "alc-aug1", eventId: eventSunsetAug.id, itemId: chairItem.id, quantity: 40, status: "devolvido" },
    { id: "alc-aug2", eventId: eventSunsetAug.id, itemId: candleItem.id, quantity: 45, status: "devolvido" },
    { id: "alc-aug3", eventId: eventSunsetAug.id, itemId: glassItem.id, quantity: 80, status: "devolvido" },
    { id: "alc-aug4", eventId: eventWeddingAug.id, itemId: chairItem.id, quantity: 90, status: "devolvido" },
    { id: "alc-aug5", eventId: eventWeddingAug.id, itemId: tableItem.id, quantity: 10, status: "devolvido" },
    { id: "alc-aug6", eventId: eventWeddingAug.id, itemId: candleItem.id, quantity: 50, status: "devolvido" },
    // September Events
    { id: "alc-sep1", eventId: eventTechSep.id, itemId: chairItem.id, quantity: 50, status: "devolvido" },
    { id: "alc-sep2", eventId: eventTechSep.id, itemId: tableItem.id, quantity: 6, status: "devolvido" },
    { id: "alc-sep3", eventId: eventTechSep.id, itemId: candleItem.id, quantity: 30, status: "devolvido" },
    { id: "alc-sep4", eventId: eventBatizadoSep.id, itemId: chairItem.id, quantity: 35, status: "devolvido" },
    { id: "alc-sep5", eventId: eventBatizadoSep.id, itemId: tableItem.id, quantity: 4, status: "devolvido" },
    { id: "alc-sep6", eventId: eventColecaoSep.id, itemId: candleItem.id, quantity: 40, status: "devolvido" },
    { id: "alc-sep7", eventId: eventColecaoSep.id, itemId: glassItem.id, quantity: 70, status: "devolvido" },
    // November Events
    { id: "alc-nov1", eventId: eventNovGala.id, itemId: chairItem.id, quantity: 80, status: "reservado" },
    { id: "alc-nov2", eventId: eventNovGala.id, itemId: tableItem.id, quantity: 8, status: "reservado" },
    { id: "alc-nov3", eventId: eventNovGala.id, itemId: candleItem.id, quantity: 65, status: "reservado" },
    { id: "alc-nov4", eventId: eventNovGala.id, itemId: glassItem.id, quantity: 100, status: "reservado" },
    { id: "alc-nov5", eventId: eventNovAniversario.id, itemId: chairItem.id, quantity: 40, status: "reservado" },
    { id: "alc-nov6", eventId: eventNovAniversario.id, itemId: candleItem.id, quantity: 30, status: "reservado" },
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

  // 8. Financial Movements (Month-over-Month Entradas, Saídas & Despesas Mensais)
  await db.insert(financialMovements).values([
    // --- Agosto 2026 ---
    { id: "mov-aug-1", type: "entrada", category: "Evento", description: "Liquidação Sunset Corporate NOS", amount: 5200.00, date: new Date("2026-08-15"), eventId: eventSunsetAug.id, clientId: clientMastercard.id },
    { id: "mov-aug-2", type: "entrada", category: "Evento", description: "Liquidação Casamento Inês & Pedro", amount: 9400.00, date: new Date("2026-08-23"), eventId: eventWeddingAug.id, clientId: clientMarta.id },
    { id: "mov-aug-3", type: "saida", category: "Fornecedor", description: "Equipa de som e DJ exterior", amount: 2800.00, date: new Date("2026-08-16") },
    { id: "mov-aug-4", type: "saida", category: "Transporte", description: "Furgão alugado e combustível Agosto", amount: 620.00, date: new Date("2026-08-20") },
    { id: "mov-aug-5", type: "saida", category: "Rendas & Instalações", description: "Renda Armazém Loures - Agosto", amount: 1200.00, date: new Date("2026-08-01") },
    { id: "mov-aug-6", type: "saida", category: "Utilidades", description: "Eletricidade e Comunicações - Agosto", amount: 380.00, date: new Date("2026-08-05") },
    { id: "mov-aug-7", type: "investimento", category: "Material / Stock", description: "Lote de 40x Copos Martini", amount: 480.00, date: new Date("2026-08-10") },

    // --- Setembro 2026 ---
    { id: "mov-sep-1", type: "entrada", category: "Evento", description: "Liquidação Tech Summit VIP Lounge", amount: 6800.00, date: new Date("2026-09-12"), eventId: eventTechSep.id, clientId: clientMastercard.id },
    { id: "mov-sep-2", type: "entrada", category: "Evento", description: "Liquidação Batizado Santiago", amount: 3400.00, date: new Date("2026-09-20"), eventId: eventBatizadoSep.id, clientId: clientMarta.id },
    { id: "mov-sep-3", type: "entrada", category: "Evento", description: "Liquidação Coleção Outono", amount: 4600.00, date: new Date("2026-09-28"), eventId: eventColecaoSep.id, clientId: clientLoreal.id },
    { id: "mov-sep-4", type: "saida", category: "Fornecedor", description: "Técnicos de AV e iluminação de palco", amount: 3100.00, date: new Date("2026-09-13") },
    { id: "mov-sep-5", type: "saida", category: "Transporte", description: "Logística e portagens Setembro", amount: 520.00, date: new Date("2026-09-22") },
    { id: "mov-sep-6", type: "saida", category: "Rendas & Instalações", description: "Renda Armazém Loures - Setembro", amount: 1200.00, date: new Date("2026-09-01") },
    { id: "mov-sep-7", type: "saida", category: "Utilidades", description: "Eletricidade e Comunicações - Setembro", amount: 410.00, date: new Date("2026-09-05") },
    { id: "mov-sep-8", type: "saida", category: "Subscrições & Software", description: "Software Gestão Eventos - Setembro", amount: 180.00, date: new Date("2026-09-02") },

    // --- Outubro 2026 ---
    { id: "mov-1", type: "entrada", category: "Evento", description: "Adiantamento 50% Mastercard Gala", amount: 1365.30, date: new Date("2026-10-01"), eventId: eventGala.id, clientId: clientMastercard.id },
    { id: "mov-2", type: "entrada", category: "Evento", description: "Liquidação Casamento Marta & João", amount: 7950.00, date: new Date("2026-10-03"), eventId: eventWedding.id, clientId: clientMarta.id },
    { id: "mov-oct-3", type: "entrada", category: "Evento", description: "Liquidação L'Oréal Brand Dinner", amount: 6200.00, date: new Date("2026-10-10"), eventId: eventLoreal.id, clientId: clientLoreal.id },
    { id: "mov-oct-4", type: "entrada", category: "Evento", description: "Adiantamento Aniversário Martim", amount: 1925.00, date: new Date("2026-10-15"), eventId: eventPooh.id, clientId: clientMarta.id },
    { id: "mov-3", type: "saida", category: "Transporte", description: "Carrinha de transporte e gasóleo Outubro", amount: 480.00, date: new Date("2026-10-04") },
    { id: "mov-4", type: "saida", category: "Fornecedor", description: "Equipa externa de som e luzes", amount: 3900.00, date: new Date("2026-10-05") },
    { id: "mov-5", type: "investimento", category: "Material / Stock", description: "Aquisição de 20x Cadeiras Chiavari", amount: 2150.00, date: new Date("2026-10-02") },
    { id: "mov-oct-6", type: "saida", category: "Rendas & Instalações", description: "Renda Armazém Loures - Outubro", amount: 1200.00, date: new Date("2026-10-01") },
    { id: "mov-oct-7", type: "saida", category: "Utilidades", description: "Eletricidade e Comunicações - Outubro", amount: 390.00, date: new Date("2026-10-05") },
    { id: "mov-oct-8", type: "saida", category: "Subscrições & Software", description: "Software Gestão Eventos - Outubro", amount: 180.00, date: new Date("2026-10-02") },

    // --- Novembro 2026 ---
    { id: "mov-nov-1", type: "entrada", category: "Evento", description: "Liquidação Gala Inovação & Sustentabilidade", amount: 7800.00, date: new Date("2026-11-08"), eventId: eventNovGala.id, clientId: clientMastercard.id },
    { id: "mov-nov-2", type: "entrada", category: "Evento", description: "Sinal 50% Aniversário 40 Anos Privado", amount: 2100.00, date: new Date("2026-11-03"), eventId: eventNovAniversario.id, clientId: clientMarta.id },
    { id: "mov-nov-3", type: "saida", category: "Fornecedor", description: "Equipa audiovisual e montagem Pátio da Galé", amount: 2400.00, date: new Date("2026-11-08") },
    { id: "mov-nov-4", type: "saida", category: "Rendas & Instalações", description: "Renda Armazém Loures - Novembro", amount: 1200.00, date: new Date("2026-11-01") },
    { id: "mov-nov-5", type: "saida", category: "Utilidades", description: "Eletricidade e Comunicações - Novembro", amount: 350.00, date: new Date("2026-11-05") },
    { id: "mov-nov-6", type: "saida", category: "Subscrições & Software", description: "Software Gestão Eventos - Novembro", amount: 180.00, date: new Date("2026-11-02") },
    { id: "mov-nov-7", type: "saida", category: "Transporte", description: "Combustível e portagens Novembro", amount: 320.00, date: new Date("2026-11-09") },
  ]).onConflictDoNothing();

  // 9. Audit Logs (Histórico inicial de alterações)
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
  const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

  // Update initial last updated metadata
  await db.update(events).set({
    updatedAt: twoHoursAgo,
    lastUpdatedByName: "Administrador CFM",
  }).where(eq(events.id, eventWedding.id));

  await db.update(events).set({
    updatedAt: fourHoursAgo,
    lastUpdatedByName: "Sofia Ribeiro",
  }).where(eq(events.id, eventGala.id));

  await db.update(events).set({
    updatedAt: yesterday,
    lastUpdatedByName: "Sofia Ribeiro",
  }).where(eq(events.id, eventPooh.id));

  await db.update(events).set({
    updatedAt: threeDaysAgo,
    lastUpdatedByName: "Administrador CFM",
  }).where(eq(events.id, eventLoreal.id));

  await db.update(inventoryItems).set({
    updatedAt: twoHoursAgo,
    lastUpdatedByName: "Sofia Ribeiro",
  }).where(eq(inventoryItems.id, chairItem.id));

  await db.update(inventoryItems).set({
    updatedAt: yesterday,
    lastUpdatedByName: "Administrador CFM",
  }).where(eq(inventoryItems.id, candleItem.id));

  await db.update(inventoryItems).set({
    updatedAt: twoDaysAgo,
    lastUpdatedByName: "João Silva",
  }).where(eq(inventoryItems.id, tableItem.id));

  await db.update(inventoryItems).set({
    updatedAt: threeDaysAgo,
    lastUpdatedByName: "Sofia Ribeiro",
  }).where(eq(inventoryItems.id, glassItem.id));

  await db.update(quotes).set({
    updatedAt: yesterday,
    lastUpdatedByName: "Administrador CFM",
  }).where(eq(quotes.id, quote104.id));

  // Seed sample audit log timeline
  await db.insert(auditLogs).values([
    // Casamento Marta & João
    {
      id: "log-w-1",
      entityType: "event",
      entityId: eventWedding.id,
      action: "alterou_estado",
      title: "Estado alterado",
      details: 'Estado alterado para "Confirmado" após recepção e validação do sinal de adjudicação.',
      userName: "Administrador CFM",
      userRole: "admin",
      createdAt: twoHoursAgo,
    },
    {
      id: "log-w-2",
      entityType: "event",
      entityId: eventWedding.id,
      action: "alocou_material",
      title: "Material alocado",
      details: "Alocadas 120x Cadeiras Chiavari Douradas e 12x Mesas Redondas 180 ao evento.",
      userName: "Sofia Ribeiro",
      userRole: "producer",
      createdAt: yesterday,
    },
    {
      id: "log-w-3",
      entityType: "event",
      entityId: eventWedding.id,
      action: "criado",
      title: "Evento criado",
      details: "Evento criado com orçamento base de €7.950,00 na Quinta da Serra.",
      userName: "Administrador CFM",
      userRole: "admin",
      createdAt: threeDaysAgo,
    },

    // Mastercard Gala
    {
      id: "log-g-1",
      entityType: "event",
      entityId: eventGala.id,
      action: "alterou_estado",
      title: "Estado alterado",
      details: 'Estado alterado para "Preparação". Equipa técnica destacada para montagem.',
      userName: "Sofia Ribeiro",
      userRole: "producer",
      createdAt: fourHoursAgo,
    },
    {
      id: "log-g-2",
      entityType: "event",
      entityId: eventGala.id,
      action: "tarefa",
      title: "Tarefa concluída",
      details: 'Tarefa "Testes de projeção e áudio para a cerimónia" validada com sucesso.',
      userName: "Sofia Ribeiro",
      userRole: "producer",
      createdAt: yesterday,
    },
    {
      id: "log-g-3",
      entityType: "event",
      entityId: eventGala.id,
      action: "orcamento",
      title: "Orçamento emitido",
      details: "Orçamento ORC-2026-104 (€2.730,60) associado ao evento e enviado ao cliente.",
      userName: "Administrador CFM",
      userRole: "admin",
      createdAt: twoDaysAgo,
    },

    // Winnie the Pooh
    {
      id: "log-p-1",
      entityType: "event",
      entityId: eventPooh.id,
      action: "atualizado",
      title: "Tema & Cores atualizados",
      details: 'Tema definido para "Winnie the Pooh" com paleta inspirada no Bosque dos Cem Acres.',
      userName: "Sofia Ribeiro",
      userRole: "producer",
      createdAt: yesterday,
    },
    {
      id: "log-p-2",
      entityType: "event",
      entityId: eventPooh.id,
      action: "criado",
      title: "Evento criado",
      details: "Festa de aniversário infantil criada para 40 convidados no Jardim das Amoreiras.",
      userName: "Administrador CFM",
      userRole: "admin",
      createdAt: twoDaysAgo,
    },

    // L'Oréal Brand Dinner
    {
      id: "log-l-1",
      entityType: "event",
      entityId: eventLoreal.id,
      action: "atualizado",
      title: "Planeamento atualizado",
      details: "Horário ajustado para as 19h30 no Palácio do Grilo.",
      userName: "Administrador CFM",
      userRole: "admin",
      createdAt: threeDaysAgo,
    },

    // Cadeira Chiavari
    {
      id: "log-i-1",
      entityType: "inventory",
      entityId: chairItem.id,
      action: "triagem",
      title: "Dano registado",
      details: "3 cadeiras retiradas temporariamente para verificação e polimento.",
      userName: "Sofia Ribeiro",
      userRole: "producer",
      createdAt: twoHoursAgo,
    },
    {
      id: "log-i-2",
      entityType: "inventory",
      entityId: chairItem.id,
      action: "atualizado",
      title: "Stock reforçado",
      details: "Entrada de 20 novas unidades adquiridas. Total em armazém: 60 un.",
      userName: "Administrador CFM",
      userRole: "admin",
      createdAt: threeDaysAgo,
    },

    // Vela LED
    {
      id: "log-i-3",
      entityType: "inventory",
      entityId: candleItem.id,
      action: "alocou_material",
      title: "Reserva de material",
      details: "72 unidades reservadas para o evento Mastercard Gala (#evt-gala).",
      userName: "Administrador CFM",
      userRole: "admin",
      createdAt: yesterday,
    },

    // Mesa Redonda 180
    {
      id: "log-i-4",
      entityType: "inventory",
      entityId: tableItem.id,
      action: "alocou_material",
      title: "Reserva de material",
      details: "8 unidades reservadas para o evento Mastercard Gala (#evt-gala).",
      userName: "João Silva",
      userRole: "producer",
      createdAt: twoDaysAgo,
    },

    // Copo Martini
    {
      id: "log-i-5",
      entityType: "inventory",
      entityId: glassItem.id,
      action: "alocou_material",
      title: "Reserva de material",
      details: "40 unidades alocadas para o evento Aniversário Martim (#evt-pooh).",
      userName: "Sofia Ribeiro",
      userRole: "producer",
      createdAt: threeDaysAgo,
    },

    // Quote ORC-2026-104
    {
      id: "log-q-1",
      entityType: "quote",
      entityId: quote104.id,
      action: "criado",
      title: "Orçamento emitido",
      details: "Emitido orçamento comercial ORC-2026-104 para Mastercard Portugal no valor de €2.730,60 com link público de aprovação.",
      userName: "Administrador CFM",
      userRole: "admin",
      createdAt: yesterday,
    },
    {
      id: "log-q-2",
      entityType: "quote",
      entityId: quote104.id,
      action: "atualizado",
      title: "Rascunho configurado",
      details: "Inseridas linhas de mobiliário (120 cadeiras, 12 mesas) e produção técnica.",
      userName: "Administrador CFM",
      userRole: "admin",
      createdAt: twoDaysAgo,
    },
  ]).onConflictDoNothing();

  // 10. Event Media: Idea Boards & Final Outcomes
  await db.insert(eventMedia).values([
    // Casamento Marta & João - Idea Boards
    {
      id: "med-w-idea-1",
      eventId: eventWedding.id,
      type: "idea_board",
      title: "Paleta Terracotta & Flores Silvestres",
      description: "Inspiração para caminhos de mesa em linho e flores secas com tons terracota e eucalipto.",
      imageUrl: "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=800&q=80",
      tag: "Flores",
      orderIndex: 1,
      uploadedByName: "Sofia Ribeiro",
      createdAt: threeDaysAgo,
    },
    {
      id: "med-w-idea-2",
      eventId: eventWedding.id,
      type: "idea_board",
      title: "Mesa de Honra com Cadeiras Chiavari",
      description: "Disposição clássica em formato oval com iluminação intimista e velas âmbar.",
      imageUrl: "https://images.unsplash.com/photo-1549497538-303791108f95?auto=format&fit=crop&w=800&q=80",
      tag: "Mobiliário",
      orderIndex: 2,
      uploadedByName: "Administrador CFM",
      createdAt: twoDaysAgo,
    },
    {
      id: "med-w-idea-3",
      eventId: eventWedding.id,
      type: "idea_board",
      title: "Iluminação Suspensa & Lanternas",
      description: "Efeito céu estrelado com cordões micro-LED sob a pérgula exterior.",
      imageUrl: "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=800&q=80",
      tag: "Iluminação",
      orderIndex: 3,
      uploadedByName: "Sofia Ribeiro",
      createdAt: yesterday,
    },

    // Casamento Marta & João - Final Outcomes (Actual Photos Taken)
    {
      id: "med-w-out-1",
      eventId: eventWedding.id,
      type: "final_outcome",
      title: "Montagem da Cerimónia no Jardim da Quinta",
      description: "Foto real tirada após montagem do altar botânico e 120 cadeiras alinhadas.",
      imageUrl: "https://images.unsplash.com/photo-1519225421980-715cb0215aed?auto=format&fit=crop&w=800&q=80",
      tag: "Cerimónia",
      orderIndex: 1,
      uploadedByName: "Administrador CFM",
      createdAt: twoHoursAgo,
    },
    {
      id: "med-w-out-2",
      eventId: eventWedding.id,
      type: "final_outcome",
      title: "Mesas Postas ao Pôr-do-Sol",
      description: "Resultado final dos centros de mesa com iluminação de velas LED e louça personalizada.",
      imageUrl: "https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?auto=format&fit=crop&w=800&q=80",
      tag: "Copo de Água",
      orderIndex: 2,
      uploadedByName: "Sofia Ribeiro",
      createdAt: twoHoursAgo,
    },

    // Mastercard Gala - Idea Boards
    {
      id: "med-g-idea-1",
      eventId: eventGala.id,
      type: "idea_board",
      title: "Conceito Black & Gold Minimalist",
      description: "Linhas retas e contraste forte com estruturas metálicas pretas e detalhes em ouro escovado.",
      imageUrl: "https://images.unsplash.com/photo-1505373877841-8d25f7d46678?auto=format&fit=crop&w=800&q=80",
      tag: "Conceito",
      orderIndex: 1,
      uploadedByName: "Sofia Ribeiro",
      createdAt: fourHoursAgo,
    },
    {
      id: "med-g-idea-2",
      eventId: eventGala.id,
      type: "idea_board",
      title: "Lounge VIP Corporate",
      description: "Zona de networking executivo com sofás aveludados e iluminação pontual.",
      imageUrl: "https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=800&q=80",
      tag: "Lounge",
      orderIndex: 2,
      uploadedByName: "Administrador CFM",
      createdAt: threeDaysAgo,
    },

    // Mastercard Gala - Final Outcomes
    {
      id: "med-g-out-1",
      eventId: eventGala.id,
      type: "final_outcome",
      title: "Palco Principal & Iluminação Cénica",
      description: "Resultado real na Estufa Fria com projeção de mapping e mesas redondas prontas.",
      imageUrl: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=800&q=80",
      tag: "Palco",
      orderIndex: 1,
      uploadedByName: "Sofia Ribeiro",
      createdAt: fourHoursAgo,
    },

    // Winnie the Pooh - Idea Boards & Final Outcomes
    {
      id: "med-p-idea-1",
      eventId: eventPooh.id,
      type: "idea_board",
      title: "Bosque dos Cem Acres - Tons Mel & Madeira",
      description: "Referências rústicas infantis com potes de mel cerâmicos e toalhas xadrez suaves.",
      imageUrl: "https://images.unsplash.com/photo-1530103862676-de8c9debad1d?auto=format&fit=crop&w=800&q=80",
      tag: "Mesa de Bolo",
      orderIndex: 1,
      uploadedByName: "Sofia Ribeiro",
      createdAt: yesterday,
    },
    {
      id: "med-p-out-1",
      eventId: eventPooh.id,
      type: "final_outcome",
      title: "Candy Bar e Painel Decorativo Real",
      description: "Foto tirada na montagem do Jardim das Amoreiras com balões mostarda e doces temáticos.",
      imageUrl: "https://images.unsplash.com/photo-1527529482837-4698179dc6ce?auto=format&fit=crop&w=800&q=80",
      tag: "Mesa Principal",
      orderIndex: 1,
      uploadedByName: "Sofia Ribeiro",
      createdAt: yesterday,
    },
  ]).onConflictDoNothing();

  console.log("✅ Seeding completed successfully with audit logs and event media!");
}

if (import.meta.url.endsWith(process.argv[1])) {
  seed().then(() => process.exit(0)).catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  });
}
