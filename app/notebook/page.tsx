import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Portfolio & Accounts | MacroLync',
  description: 'Read-only MT5 account intelligence and trading history.',
};

export default function RetiredJournalRoute(): never {
  redirect('/accounts');
}
