import { redirect } from 'next/navigation';
import { getAuthenticatedUser } from '@/lib/auth';
import { TelegramLinkPanel } from '@/components/telegram-link-panel';

export const dynamic = 'force-dynamic';
export const metadata = { title: "Telegram-кабинет — Пар'ИМБА'нк" };

export default async function TelegramPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect('/login?return_to=%2Ftelegram');
  return <TelegramLinkPanel/>;
}
