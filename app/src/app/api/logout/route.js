import { NextResponse } from 'next/server';
import { destroySession } from '@/lib/auth';

export async function POST(request) {
  await destroySession();
  // Редирект с относительным Location: браузер разрешает его относительно
  // текущего origin, поэтому адрес остаётся правильным на любом домене.
  // Origin из request.url брать нельзя: за reverse-proxy там внутренний адрес
  // приложения (например http://localhost:3002), а не адрес сайта.
  return new NextResponse(null, { status: 303, headers: { Location: '/login' } });
}
