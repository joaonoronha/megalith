import { isCancelledEvent, isMeetingEvent } from "./events";

export interface CompletedEventFinancial {
  id: string;
  name: string;
  startDate: string | Date;
  formattedDate: string;
  monthKey: string;
  monthLabel: string;
  monthFullLabel: string;
  revenue: number;
  costs: number;
  profit: number;
  margin: number;
}

export interface MonthlyTrajectoryItem {
  monthKey: string;
  monthLabel: string;
  monthFullLabel: string;
  events: CompletedEventFinancial[];
  monthlyProfit: number;
  monthlyRevenue: number;
  monthlyCosts: number;
}

export interface CompletedEventsProfitData {
  events: CompletedEventFinancial[];
  totalProfit: number;
  totalRevenue: number;
  totalCosts: number;
  avgMargin: string;
  monthlyTrajectory: MonthlyTrajectoryItem[];
}

export function computeCompletedEventsProfit(
  eventsList: any[],
  activeMovements: any[]
): CompletedEventsProfitData {
  const completed = eventsList.filter((e) => {
    if (isCancelledEvent(e) || isMeetingEvent(e)) return false;
    const status = (e.status || "").toLowerCase().trim();
    return status === "concluido" || status === "concluído";
  });

  const monthNamesPt = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];
  const monthShortPt = [
    "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
    "Jul", "Ago", "Set", "Out", "Nov", "Dez"
  ];

  const eventsWithFinancials: CompletedEventFinancial[] = completed.map((e) => {
    const evMovements = activeMovements.filter((m) => m.eventId === e.id);
    const entradas = evMovements
      .filter((m) => m.type === "entrada")
      .reduce((sum, m) => sum + m.amount, 0);
    const saidas = evMovements
      .filter((m) => m.type === "saida" || m.type === "investimento")
      .reduce((sum, m) => sum + m.amount, 0);

    const customerPrice = Number(e.customerPrice) || 0;
    const budget = Number(e.totalBudget) || 0;

    const revenue = entradas > 0 ? entradas : customerPrice;
    const costs = saidas > 0 ? saidas : budget;
    const profit = revenue - costs;
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

    const d = new Date(e.startDate);
    const isValid = !isNaN(d.getTime());
    const monthKey = isValid
      ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      : "outros";
    const monthLabel = isValid
      ? `${monthShortPt[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`
      : "Outros";
    const monthFullLabel = isValid
      ? `${monthNamesPt[d.getMonth()]} ${d.getFullYear()}`
      : "Outros";
    const formattedDate = isValid
      ? `${String(d.getDate()).padStart(2, "0")} ${monthShortPt[d.getMonth()]} ${d.getFullYear()}`
      : "";

    return {
      id: e.id,
      name: e.name || "Evento sem nome",
      startDate: e.startDate,
      formattedDate,
      monthKey,
      monthLabel,
      monthFullLabel,
      revenue,
      costs,
      profit,
      margin,
    };
  });

  eventsWithFinancials.sort(
    (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
  );

  const totalProfit = eventsWithFinancials.reduce((sum, e) => sum + e.profit, 0);
  const totalRevenue = eventsWithFinancials.reduce((sum, e) => sum + e.revenue, 0);
  const totalCosts = eventsWithFinancials.reduce((sum, e) => sum + e.costs, 0);
  const avgMargin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : "0.0";

  const monthMap = new Map<string, MonthlyTrajectoryItem>();

  eventsWithFinancials.forEach((ev) => {
    const existing = monthMap.get(ev.monthKey);
    if (existing) {
      existing.events.push(ev);
      existing.monthlyProfit += ev.profit;
      existing.monthlyRevenue += ev.revenue;
      existing.monthlyCosts += ev.costs;
    } else {
      monthMap.set(ev.monthKey, {
        monthKey: ev.monthKey,
        monthLabel: ev.monthLabel,
        monthFullLabel: ev.monthFullLabel,
        events: [ev],
        monthlyProfit: ev.profit,
        monthlyRevenue: ev.revenue,
        monthlyCosts: ev.costs,
      });
    }
  });

  const monthlyTrajectory = Array.from(monthMap.values()).sort((a, b) =>
    a.monthKey.localeCompare(b.monthKey)
  );

  return {
    events: eventsWithFinancials,
    totalProfit,
    totalRevenue,
    totalCosts,
    avgMargin,
    monthlyTrajectory,
  };
}
