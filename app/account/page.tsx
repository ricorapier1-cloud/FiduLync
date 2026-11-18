import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Personal Account',
  description: 'Private owner access for the FiduLync Personal Quant workspace.',
};

export default function PersonalAccountPage(): never {
  redirect('/owner');
}
