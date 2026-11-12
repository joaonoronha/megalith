import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

// 1. CFM Eventos Team Accounts
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").unique().notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["admin", "producer", "warehouse"] }).default("admin").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

// 2. Clients / CRM
export const clients = sqliteTable("clients", {
  id: text("id").primaryKey(),
  name: text("name").notNull(), // e.g. "Mastercard Portugal", "Marta Almeida"
  contactName: text("contact_name"), // e.g. "João Silva"
  email: text("email"),
  phone: text("phone"),
  nif: text("nif"),
  address: text("address"),
  notes: text("notes"),
  source: text("source").default("manual"), // "manual" | "calendly"
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

// 3. Inventory & Rental Stock
export const inventoryItems = sqliteTable("inventory_items", {
  id: text("id").primaryKey(),
  sku: text("sku").unique().notNull(), // e.g. "MOB-CHA-001"
  name: text("name").notNull(), // e.g. "Cadeira Chiavari Dourada"
  category: text("category").notNull(), // e.g. "Mobiliário / Cadeiras"
  totalQuantity: integer("total_quantity").notNull().default(1),
  minStock: integer("min_stock").default(0),
  warehouseLocation: text("warehouse_location"), // e.g. "Armazém A · B3 · P2"
  dimensions: text("dimensions"), // e.g. "40 × 45 × 92 cm"
  unitPrice: real("unit_price").default(0).notNull(), // rental price per unit
  replacementCost: real("replacement_cost").default(0),
  imageUrl: text("image_url"),
  damagedQuantity: integer("damaged_quantity").default(0),
  inMaintenanceQuantity: integer("in_maintenance_quantity").default(0),
});

// 4. Events Lifecycle & Production Pipeline
export const events = sqliteTable("events", {
  id: text("id").primaryKey(),
  name: text("name").notNull(), // e.g. "Mastercard Gala"
  clientId: text("client_id").references(() => clients.id),
  venue: text("venue"), // e.g. "Estufa Fria"
  startDate: integer("start_date", { mode: "timestamp" }).notNull(),
  endDate: integer("end_date", { mode: "timestamp" }),
  prepDate: integer("prep_date", { mode: "timestamp" }),
  returnDate: integer("return_date", { mode: "timestamp" }),
  status: text("status", { 
    enum: ["planeamento", "orcamento", "confirmado", "preparacao", "em_curso", "devolucao", "concluido", "cancelado"] 
  }).default("planeamento").notNull(),
  totalBudget: real("total_budget").default(0), // Total internal production budget
  customerPrice: real("customer_price").default(0), // Total amount customer is going to pay
  category: text("category").default("Geral"), // e.g. "Aniversário Infantil", "Casamento", "Corporativo", "Gala"
  theme: text("theme"), // e.g. "Winnie the Pooh", "Gatsby", "Boho Chic"
  vibeColors: text("vibe_colors"), // JSON string array of hex codes e.g. '["#E5A93C","#C93B2B","#5A8261","#F7E7C4"]'
  specialNeeds: text("special_needs"), // Dietary restrictions, noise limits, VIP asks, power needs
  notes: text("notes"),
  coverImageUrl: text("cover_image_url"),
  calendlyEventUri: text("calendly_event_uri"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

// 4.1 Action Items & Completion Checklist per Event
export const eventTasks = sqliteTable("event_tasks", {
  id: text("id").primaryKey(),
  eventId: text("event_id").references(() => events.id, { onDelete: "cascade" }).notNull(),
  title: text("title").notNull(),
  completed: integer("completed", { mode: "boolean" }).default(false).notNull(),
  dueDate: integer("due_date", { mode: "timestamp" }),
  priority: text("priority", { enum: ["baixa", "media", "alta", "urgente"] }).default("media"),
  assignedTo: text("assigned_to"),
  orderIndex: integer("order_index").default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

// 5. Temporal Stock Reservations (Prevents Double-Booking)
export const eventAllocations = sqliteTable("event_allocations", {
  id: text("id").primaryKey(),
  eventId: text("event_id").references(() => events.id, { onDelete: "cascade" }).notNull(),
  itemId: text("item_id").references(() => inventoryItems.id).notNull(),
  quantity: integer("quantity").notNull(),
  status: text("status", { 
    enum: ["reservado", "despachado", "devolvido", "danificado"] 
  }).default("reservado").notNull(),
  notes: text("notes"),
});

// 6. Commercial Quotes / Orçamentos
export const quotes = sqliteTable("quotes", {
  id: text("id").primaryKey(),
  quoteNumber: text("quote_number").unique().notNull(), // e.g. "ORC-2026-104"
  eventId: text("event_id").references(() => events.id),
  clientId: text("client_id").references(() => clients.id),
  accessToken: text("access_token").unique().notNull(), // Secret UUID for public approval URL
  status: text("status", { 
    enum: ["rascunho", "enviado", "aprovado", "recusado", "expirado"] 
  }).default("rascunho").notNull(),
  validityDays: integer("validity_days").default(15).notNull(),
  vatRate: real("vat_rate").default(23.0).notNull(), // Standard 23% in Portugal
  subtotal: real("subtotal").notNull(),
  vatAmount: real("vat_amount").notNull(),
  total: real("total").notNull(),
  signedAt: integer("signed_at", { mode: "timestamp" }),
  signatureData: text("signature_data"),
  approvedByIp: text("approved_by_ip"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

// 7. Quote Itemized Lines
export const quoteLines = sqliteTable("quote_lines", {
  id: text("id").primaryKey(),
  quoteId: text("quote_id").references(() => quotes.id, { onDelete: "cascade" }).notNull(),
  itemId: text("item_id").references(() => inventoryItems.id),
  description: text("description").notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: real("unit_price").notNull(),
  total: real("total").notNull(),
});

// 8. Financial Cash Flow Ledger (Movimentos)
export const financialMovements = sqliteTable("financial_movements", {
  id: text("id").primaryKey(),
  type: text("type", { enum: ["entrada", "saida", "investimento"] }).notNull(),
  category: text("category").notNull(), // "Evento", "Material / Stock", "Transporte", etc.
  description: text("description").notNull(),
  amount: real("amount").notNull(),
  date: integer("date", { mode: "timestamp" }).notNull(),
  eventId: text("event_id").references(() => events.id),
  clientId: text("client_id").references(() => clients.id),
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

// 9. Document & Media Attachments
export const documents = sqliteTable("documents", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  fileUrl: text("file_url").notNull(),
  fileType: text("file_type"),
  fileSize: integer("file_size"),
  eventId: text("event_id").references(() => events.id),
  clientId: text("client_id").references(() => clients.id),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

// 10. Quote Template Customization (Brand Settings)
export const quoteTemplates = sqliteTable("quote_templates", {
  id: text("id").primaryKey(),
  companyName: text("company_name").default("CFM EVENTOS").notNull(),
  tagline: text("tagline").default("Produção & decoração de eventos"),
  contactInfo: text("contact_info").default("geral@cfmeventos.pt · +351 912 345 678"),
  paymentTerms: text("payment_terms").default("50% adjudicação · 50% na desmontagem"),
  footerNotes: text("footer_notes").default("Obrigado pela preferência."),
  brandColor: text("brand_color").default("#111111").notNull(),
  logoUrl: text("logo_url"),
});
