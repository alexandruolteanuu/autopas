// Ecranul de așteptare al listării. Vezi components/Schelete.tsx pentru de ce
// sunt schelete și nu un cerc rotitor.
import { ScheletAntetListare, ScheletGrila } from "@/components/Schelete";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <ScheletAntetListare />
      <div className="mt-6"><ScheletGrila cate={12} /></div>
    </div>
  );
}
