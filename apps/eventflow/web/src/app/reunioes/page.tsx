import { redirect } from "next/navigation";

export default function ReunioesIndexPage() {
  // Meetings are presented alongside events on the calendar and accessible directly via /reunioes/[id]
  redirect("/calendario?filter=meetings");
}
