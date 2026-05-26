import { Loader2 } from 'lucide-react';

export function LoadingTable({ cols = 5 }: { cols?: number }) {
  return (
    <tr>
      <td colSpan={cols} className="py-12 text-center text-[#505050]">
        <Loader2 className="w-6 h-6 mx-auto animate-spin mb-2" />
        <p className="text-sm">Carregando...</p>
      </td>
    </tr>
  );
}
