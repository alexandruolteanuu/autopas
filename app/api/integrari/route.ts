// Raportează dacă cheile curierilor sunt configurate (fără să le expună).
import { NextResponse } from "next/server";
import { fanCourierConfigurat, samedayConfigurat } from "@/lib/couriers";

export async function GET() {
  return NextResponse.json({ fan: fanCourierConfigurat(), sameday: samedayConfigurat() });
}
