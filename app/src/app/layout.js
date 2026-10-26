import './globals.css';
import Link from 'next/link';
import { currentUser, isAdmin } from '@/lib/auth';

export const metadata = {
  title: 'TaskFlow — задачи и сотрудники',
  description: 'Демонстрационный проект: трекер задач и сотрудников.',
};

function Logo() {
  // Собственная простая геометрия: три «дорожки» задач, сходящиеся в точку.
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
      <rect x="1" y="1" width="30" height="30" rx="9" fill="#14213D" />
      <path d="M8 11h11M8 16h15M8 21h8" stroke="#2F6BFF" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="24.5" cy="21" r="3.2" fill="#17B890" />
    </svg>
  );
}

export default async function RootLayout({ children }) {
  const user = await currentUser();
  return (
    <html lang="ru">
      <body className="min-h-screen bg-paper text-ink antialiased">
        <div
          role="note"
          style={{ background: '#fef3c7', color: '#78350f', textAlign: 'center', fontSize: '13px', lineHeight: 1.4, padding: '7px 12px', borderBottom: '1px solid #f59e0b' }}
        >
          Демонстрационный проект. Сотрудники, задачи и данные вымышлены и показаны как пример.
        </div>
        {user && (
          <header className="border-b border-slate-200 bg-white">
            <div className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-3">
              <Link href="/tasks" className="flex items-center gap-2 font-extrabold tracking-tight">
                <Logo /> TaskFlow
              </Link>
              <nav className="flex items-center gap-4 text-sm font-medium text-slate-600">
                <Link href="/tasks" className="hover:text-sky">Задачи</Link>
                <Link href="/tasks/new" className="hover:text-sky">Новая задача</Link>
                {isAdmin(user) && <Link href="/admin" className="hover:text-sky">Сотрудники</Link>}
              </nav>
              <div className="ml-auto flex items-center gap-3 text-sm">
                <span className="text-slate-500">
                  {user.full_name} · {user.role === 'admin' ? 'администратор' : 'сотрудник'}
                </span>
                <form action="/api/logout" method="post">
                  <button className="btn-ghost px-3 py-1.5 text-xs" type="submit">Выйти</button>
                </form>
              </div>
            </div>
          </header>
        )}
        <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
