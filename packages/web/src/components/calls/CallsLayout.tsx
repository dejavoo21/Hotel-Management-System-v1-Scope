import type { ReactNode } from 'react';

type Props = {
  left: ReactNode;
  main: ReactNode;
};

export default function CallsLayout({ left, main }: Props) {
  return (
    <div className="flex h-[calc(100vh-0px)] w-full bg-slate-50">
      <aside className="hidden w-[360px] border-r border-slate-200 bg-white p-4 lg:block">{left}</aside>
      <main className="flex-1">{main}</main>
    </div>
  );
}
